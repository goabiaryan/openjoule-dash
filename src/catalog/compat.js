import { getBlock } from "./blocks.js";
import { normalizeGpuMix, primaryGpu } from "../build/gpuMix.js";

/** Module / socket family · must match server baseboard. */
export function gpuHostKind(gpu) {
  if (!gpu) return "pcie";
  const ff = String(gpu.isa?.form_factor ?? "");
  if (/OAM/i.test(ff) || /mi3/i.test(gpu.id)) return "oam";
  if (/SXM/i.test(ff) || /sxm/i.test(gpu.id)) return "sxm";
  if (gpu.spec?.coolingMethod === "liquid" && /NVL|Blackwell/i.test(gpu.name ?? "")) return "sxm";
  return "pcie";
}

export function gpuCoolingFits(gpu, server) {
  const req = server?.spec?.gpuCooling ?? "any";
  if (req === "any") return true;
  const m = gpu?.spec?.coolingMethod ?? "air";
  if (req === "liquid") return m === "liquid" || m === "cold_plate";
  if (req === "air") return m === "air";
  if (req === "air_assist") return m === "air" || m === "cold_plate";
  return true;
}

export function serverHosting(server) {
  return server?.spec?.hosting ?? "pcie";
}

export function gpuServerCompatible(gpu, server) {
  if (!gpu || !server) return true;
  const need = serverHosting(server);
  if (need !== "either" && gpuHostKind(gpu) !== need) return false;
  return gpuCoolingFits(gpu, server);
}

export function preferredGpusPerServer(gpu) {
  const kind = gpuHostKind(gpu);
  const w = gpu?.spec?.boardPowerW ?? 150;
  if (kind === "sxm" || kind === "oam") return 8;
  if (w >= 275) return 4;
  if (w >= 120) return 2;
  return 1;
}

export function integratedGpuAllowed(rack, gpu) {
  if (!rack?.spec?.integrated) return true;
  const allowed = rack.spec.pairedGpuIds;
  if (!allowed?.length) return true;
  return allowed.includes(gpu?.id);
}

export function pickServerForGpu(gpuId, serverIds) {
  const gpu = getBlock(gpuId);
  if (!gpu) return serverIds[0] ?? null;
  const want = preferredGpusPerServer(gpu);
  const compatible = serverIds.filter((id) => gpuServerCompatible(gpu, getBlock(id)));
  if (!compatible.length) return serverIds[0] ?? null;
  const exact = compatible.find((id) => getBlock(id)?.spec?.gpusPerServer === want);
  if (exact) return exact;
  return compatible[0];
}

export function pickGpuForRack(rackId, gpuIds) {
  const rack = getBlock(rackId);
  if (!rack?.spec?.integrated) return null;
  const preferred = rack.spec.defaultGpuId;
  if (preferred && gpuIds.includes(preferred)) return preferred;
  const allowed = rack.spec.pairedGpuIds;
  if (allowed?.length) {
    const hit = allowed.find((id) => gpuIds.includes(id));
    if (hit) return hit;
  }
  return gpuIds[0] ?? null;
}

export function stackIssues(slots) {
  const issues = [];
  const gpu = primaryGpu(slots);
  const server = getBlock(slots.server);
  const rack = getBlock(slots.rack);
  const mix = normalizeGpuMix(slots.gpuMix);

  if (rack?.spec?.integrated) {
    if (mix.length > 1) {
      issues.push({
        level: "medium",
        title: "Integrated rack · one GPU SKU",
        detail: "NVL / integrated racks are single-SKU domains · use one chip in the mix.",
      });
    }
    if (!integratedGpuAllowed(rack, gpu)) {
      issues.push({
        level: "high",
        title: "GPU / rack domain mismatch",
        detail: `${gpu?.name ?? "GPU"} is not in the ${rack.name} paired SKU set · pick a matching GPU or change rack.`,
      });
    }
    return issues;
  }

  for (const m of mix) {
    const g = getBlock(m.id);
    if (g && server && !gpuServerCompatible(g, server)) {
      issues.push({
        level: "high",
        title: "GPU / server form factor",
        detail: `${g.name} (${gpuHostKind(g)}) does not fit ${server.name} (${serverHosting(server)} baseboard).`,
      });
    }
  }

  if (server && rack && !rack.spec?.integrated) {
    const liqRack = rack.spec?.coolingClass === "direct_liquid";
    const liqSrv = server.spec?.gpuCooling === "liquid";
    const airOnlySrv = server.spec?.gpuCooling === "air";
    if (liqRack && airOnlySrv) {
      issues.push({
        level: "high",
        title: "Server / rack cooling",
        detail: `${server.name} is air-only but ${rack.name} expects direct liquid · pick a liquid-class server or change rack.`,
      });
    }
    if (rack.spec?.coolingClass === "air" && liqSrv) {
      issues.push({
        level: "medium",
        title: "Liquid server in air rack",
        detail: `${server.name} needs facility liquid; ${rack.name} is room-air · use rear-door or liquid row.`,
      });
    }
  }

  const maxGpu = server?.spec?.maxGpusPerServer;
  if (maxGpu && gpu && server?.spec?.gpusPerServer > maxGpu) {
    issues.push({
      level: "medium",
      title: "GPU count vs server",
      detail: `Server block assumes ${server.spec.gpusPerServer} GPUs · verify against platform limit ${maxGpu}.`,
    });
  }

  return issues;
}
