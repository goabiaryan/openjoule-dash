import { formulas } from "../calc.js";
import { defaultSlots, getBlock } from "../catalog/blocks.js";
import { mergeProgram } from "./program.js";
import { hallTotalsFromMix, primaryGpu } from "./gpuMix.js";
import { deriveRackKwDisaggregated, deriveServerKw } from "./power.js";

/** Turn chosen block IDs into numeric plan for derivations and charts. */
export function planFromSlots(slots = defaultSlots) {
  const gpu = primaryGpu(slots);
  const server = getBlock(slots.server);
  const rack = getBlock(slots.rack);
  const row = getBlock(slots.row);
  const hall = getBlock(slots.hall);
  const site = getBlock(slots.site);

  const integrated = rack?.spec?.integrated === true;

  const plan = {
    label: integrated ? rack.name : `${gpu?.name} · ${server?.name}`,
    integrated,
    gpuKw: (gpu?.spec.boardPowerW || 700) / 1000,
    pue: site?.spec.pue ?? 1.3,
    coolingClass: rack?.spec.coolingClass ?? "air_rear_door",
  };

  const scale = mergeProgram({
    rows: hall?.spec.rows ?? 4,
    racksPerRow: row?.spec.racksPerRow ?? 6,
  });
  plan.rows = scale.rows;
  plan.racksPerRow = scale.racksPerRow;
  plan.sparePct = site?.spec?.sparePct ?? 15;
  plan.feedRedundancy = site?.spec?.feedRedundancy === "N" ? "N" : "2N";
  plan.includeNetworkRow = scale.includeNetworkRow;

  if (integrated) {
    plan.rackKw = rack.spec.rackKw;
    plan.gpusPerRack = rack.spec.gpusPerRack;
    plan.serverKw = plan.rackKw;
    plan.gpusPerServer = plan.gpusPerRack;
    plan.serversPerRack = 1;
  } else {
    plan.gpusPerServer = server?.spec.gpusPerServer ?? 8;
    plan.serverKw = deriveServerKw(gpu, server);
    plan.serversPerRack = rack?.spec.serversPerRack ?? 4;
    plan.rackKw = deriveRackKwDisaggregated(gpu, server, rack);
    plan.gpusPerRack = plan.gpusPerServer * plan.serversPerRack;
  }

  plan.racks = plan.racksPerRow * plan.rows;
  plan.rowKw = plan.rackKw * plan.racksPerRow;
  plan.hallKw = plan.rackKw * plan.racks;
  plan.siteKw = plan.hallKw * plan.pue;
  plan.gpus = plan.gpusPerRack * plan.racks;
  plan.areaM2 = plan.racks * formulas.m2PerRack;

  const mixed = hallTotalsFromMix(slots, plan);
  if (mixed.segments) {
    plan.gpuMixSegments = mixed.segments;
    plan.gpus = mixed.gpus;
    plan.hallKw = mixed.hallKw;
    plan.siteKw = plan.hallKw * plan.pue;
    plan.rackKw = mixed.hallKw / plan.racks;
    plan.rowKw = mixed.hallKw / plan.rows;
    plan.gpuKw = mixed.gpuKw;
    plan.label = mixed.segments.map((s) => s.name).join(" + ");
  } else {
    plan.gpuMixSegments = null;
  }

  return plan;
}

export function coolingClassLabel(c) {
  if (c === "air") return "Air";
  if (c === "air_rear_door") return "Air + rear-door heat exchanger";
  if (c === "direct_liquid") return "Direct-to-chip liquid";
  return c;
}
