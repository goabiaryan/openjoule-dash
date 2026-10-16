import { getBlock } from "../catalog/blocks.js";
import { primaryGpu } from "../build/gpuMix.js";
import { derivePlan, formatNum } from "../calc.js";

const LEAF_DOWNLINKS = 32;
const DEFAULT_LEAF_PORTS = 64;
const DEFAULT_UPLINK_Gbps = 400;
const DEFAULT_UPLINKS_PER_LEAF = 4;

/** Training-fabric sizing from Build stack (explicit assumptions · not vendor BOM). */
export function deriveFabric(plan, slots, optionalIds) {
  const d = derivePlan(plan);
  const gpu = primaryGpu(slots);
  const server = getBlock(slots.server);
  const leafIsa = getBlock("net-leaf-64")?.isa ?? {};
  const leafPinned = optionalIds?.has("net-leaf-64");

  const portSpeedGbps = leafIsa.port_speed_gbps ?? DEFAULT_UPLINK_Gbps;
  const leafPorts = leafIsa.leaf_ports ?? DEFAULT_LEAF_PORTS;
  const uplinksPerLeaf = leafIsa.uplinks_per_leaf ?? DEFAULT_UPLINKS_PER_LEAF;

  const scaleOutGbps = gpu?.spec?.scaleOutGbps ?? 100;
  const nicPortsPerServer = server?.spec?.nicPorts ?? plan.gpusPerServer;
  const serversPerRack = plan.integrated ? 1 : plan.serversPerRack;
  const gpusPerRack = plan.integrated ? plan.gpusPerRack : plan.gpusPerServer * plan.serversPerRack;

  const gbpsPerRack = scaleOutGbps * gpusPerRack;
  const gbpsPerServer = scaleOutGbps * plan.gpusPerServer;

  const gpuPorts = d.gpus;
  const serverNicLinks = plan.integrated ? 0 : d.racks * plan.serversPerRack * nicPortsPerServer;
  const torSwitches = plan.integrated ? 0 : d.racks * 2;

  const leafCount = Math.ceil(d.gpus / LEAF_DOWNLINKS);
  const spineCount = Math.max(2, Math.ceil(leafCount / 16));
  const fabricTiers = d.gpus <= 2048 ? 2 : 3;

  const leafUplinkGbps = uplinksPerLeaf * portSpeedGbps;
  const leafDownlinkGbps = LEAF_DOWNLINKS * portSpeedGbps;
  const oversubDownToUp = leafUplinkGbps > 0 ? leafDownlinkGbps / leafUplinkGbps : null;

  const downlinksPerRack = plan.integrated ? gpusPerRack : plan.serversPerRack * nicPortsPerServer;
  const rackToLeafCables = downlinksPerRack * d.racks;
  const leafToSpineFibers = leafCount * uplinksPerLeaf;

  const hops = [];
  hops.push({
    id: "gpu",
    label: "GPU scale-out",
    sub: `${formatNum(scaleOutGbps)} Gbps/GPU · ${gpu?.name ?? "GPU"}`,
    qty: d.gpus,
    unit: "ports",
    media: gpu?.isa?.scale_up_link?.includes("NVLink") ? "NVLink / NVSwitch in domain" : "PCIe to NIC",
  });

  if (!plan.integrated) {
    hops.push({
      id: "nic",
      label: "Server NIC",
      sub: `${nicPortsPerServer}× ${formatNum(scaleOutGbps)}G-class / server`,
      qty: serverNicLinks,
      unit: "host links",
      media: "DAC ≤3 m or AOC in rack",
    });
    hops.push({
      id: "tor",
      label: "ToR in rack",
      sub: "2× ToR typical · east/west",
      qty: torSwitches,
      unit: "switches",
      media: "400G breakout to server",
    });
  } else {
    hops.push({
      id: "intra",
      label: "In-rack fabric",
      sub: `${gpusPerRack} GPU in integrated domain`,
      qty: d.racks,
      unit: "domains",
      media: "NVLink / NVSwitch internal",
    });
  }

  hops.push({
    id: "leaf",
    label: leafPinned ? "Leaf (pinned)" : "Leaf (planned)",
    sub: `${LEAF_DOWNLINKS} GPU down / leaf · ${portSpeedGbps}G`,
    qty: leafCount,
    unit: "switches",
    media: leafPinned ? "Optical to spine" : "Add leaf block in Build",
  });

  if (fabricTiers >= 2) {
    hops.push({
      id: "spine",
      label: "Spine",
      sub: `${uplinksPerLeaf}× ${portSpeedGbps}G uplink / leaf`,
      qty: spineCount,
      unit: "switches",
      media: "Optical OSFP/QSFP-DD",
    });
  }

  hops.push({
    id: "wan",
    label: "Site / WAN",
    sub: "Dual carrier handoff",
    qty: 2,
    unit: "paths",
    media: "DWDM or IP transit",
  });

  const cableRows = [
    {
      segment: "Rack → row leaf",
      qty: rackToLeafCables,
      unit: "links",
      type: plan.integrated ? "Breakout from integrated domain" : "DAC or short AOC (1–5 m)",
      note: `${formatNum(downlinksPerRack)} per rack · ${formatNum(gbpsPerRack)} Gbps/rack demand`,
    },
    {
      segment: "Leaf → spine",
      qty: leafToSpineFibers,
      unit: "fibers",
      type: `${portSpeedGbps}G optical (DR4/FR4 class)`,
      note: oversubDownToUp
        ? `~${formatNum(oversubDownToUp, 1)}:1 down:up oversub at leaf`
        : "Uplink count from leaf ISA block",
    },
    {
      segment: "GPU training mesh",
      qty: gpuPorts,
      unit: "endpoints",
      type: "Counted 1:1 GPU ↔ fabric port",
      note: `Aggregate ~${formatNum(d.gpus * scaleOutGbps)} Gbps GPU-side (nameplate)`,
    },
  ];

  return {
    scaleOutGbps,
    gbpsPerRack,
    gbpsPerServer,
    gpusPerRack,
    downlinksPerRack,
    leafCount,
    spineCount,
    fabricTiers,
    leafPinned,
    portSpeedGbps,
    uplinksPerLeaf,
    oversubDownToUp,
    hops,
    cableRows,
    summary: `${formatNum(d.gpus)} GPU ports · ${formatNum(leafCount)} leaf · ${formatNum(spineCount)} spine · ${fabricTiers}-tier · ~${formatNum(gbpsPerRack)} Gbps/rack`,
  };
}
