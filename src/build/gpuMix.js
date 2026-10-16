import { getBlock } from "../catalog/blocks.js";
import { deriveRackKwDisaggregated, deriveServerKw } from "./power.js";

export function normalizeGpuMix(mix) {
  if (!mix?.length) return [{ id: "gpu-h100", pct: 100 }];
  const cleaned = mix.filter((m) => m?.id && m.pct > 0);
  if (!cleaned.length) return [{ id: mix[0]?.id ?? "gpu-h100", pct: 100 }];
  const sum = cleaned.reduce((s, m) => s + Number(m.pct) || 0, 0);
  if (sum <= 0) return [{ id: cleaned[0].id, pct: 100 }];
  return cleaned.map((m) => ({ id: m.id, pct: (100 * (Number(m.pct) || 0)) / sum }));
}

export function primaryGpuId(slots) {
  return normalizeGpuMix(slots.gpuMix)[0]?.id ?? "gpu-h100";
}

export function primaryGpu(slots) {
  return getBlock(primaryGpuId(slots));
}

/** Split hall racks across SKUs; last line absorbs rounding. */
export function gpuMixSegments(slots, plan) {
  const mix = normalizeGpuMix(slots.gpuMix);
  const totalRacks = plan.racks;
  const totalGpusPerRack = plan.gpusPerRack;
  let assignedRacks = 0;
  const segments = mix.map((m, i) => {
    const gpu = getBlock(m.id);
    let racks =
      i === mix.length - 1
        ? totalRacks - assignedRacks
        : Math.round((totalRacks * m.pct) / 100);
    assignedRacks += racks;
    const gpus = racks * totalGpusPerRack;
    const rackKw = plan.integrated
      ? plan.rackKw
      : deriveRackKwDisaggregated(gpu, getBlock(slots.server), getBlock(slots.rack));
    return {
      id: m.id,
      name: gpu?.name ?? m.id,
      pct: m.pct,
      racks,
      gpus,
      rackKw,
      hallKw: racks * rackKw,
      boardPowerW: gpu?.spec?.boardPowerW ?? 700,
    };
  });
  return segments;
}

export function hallTotalsFromMix(slots, plan) {
  if (plan.integrated || normalizeGpuMix(slots.gpuMix).length <= 1) {
    return {
      gpus: plan.gpus,
      hallKw: plan.hallKw,
      rackKw: plan.rackKw,
      gpuKw: plan.gpuKw,
      segments: null,
    };
  }
  const segments = gpuMixSegments(slots, plan);
  const gpus = segments.reduce((s, x) => s + x.gpus, 0);
  const hallKw = segments.reduce((s, x) => s + x.hallKw, 0);
  const boardSum = segments.reduce((s, x) => s + x.gpus * x.boardPowerW, 0);
  return {
    gpus,
    hallKw,
    rackKw: gpus > 0 ? (hallKw / plan.racks) : plan.rackKw,
    gpuKw: gpus > 0 ? boardSum / gpus / 1000 : plan.gpuKw,
    segments,
  };
}

export function rebalanceMixEven(mix) {
  const ids = mix.map((m) => m.id);
  const each = 100 / ids.length;
  return ids.map((id) => ({ id, pct: each }));
}

export function toggleGpuInMix(mix, gpuId) {
  const norm = normalizeGpuMix(mix);
  const idx = norm.findIndex((m) => m.id === gpuId);
  if (idx >= 0) {
    if (norm.length <= 1) return norm;
    const next = norm.filter((m) => m.id !== gpuId);
    return rebalanceMixEven(next);
  }
  return rebalanceMixEven([...norm, { id: gpuId, pct: 0 }]);
}
