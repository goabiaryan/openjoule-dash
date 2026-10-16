import { amps, cfm, derivePlan, formatNum, lpm, round100, tons } from "../calc.js";
import { coolingClassLabel } from "../build/plan.js";
import { getBlock } from "../catalog/blocks.js";
import { stackIssues } from "../catalog/compat.js";
import { primaryGpu } from "../build/gpuMix.js";

const BUSWAY_A = 1200;
const SLAB_KG_M2 = 1500;

function rackWeightKg(slots) {
  const rack = getBlock(slots.rack);
  if (rack?.spec?.weightKgPerRack) return rack.spec.weightKgPerRack;
  return rack?.spec?.integrated ? 1400 : 700;
}

function gpuWantsLiquid(slots) {
  const gpu = primaryGpu(slots);
  const m = gpu?.spec?.coolingMethod;
  return m === "liquid";
}

export function analyzeFacility(plan, slots, optionalIds) {
  const d = derivePlan(plan);
  const site = getBlock(slots.site);
  const row = getBlock(slots.row);
  const rackA = amps(plan.rackKw);
  const rowA = amps(plan.rowKw);
  const hallLoopLpm = Math.round(lpm(plan.hallKw));
  const heatTons = Math.round(tons(plan.hallKw));
  const designHallKw = plan.hallKw * (1 + plan.sparePct / 100);
  const designSiteMw = (designHallKw * plan.pue) / 1000;
  const weightKg = rackWeightKg(slots) * d.racks;
  const floorLoad = weightKg / plan.areaM2;
  const hasCdu = optionalIds.has("cool-cdu");
  const hasLeaf = optionalIds.has("net-leaf-64");
  const cduPerRow = row?.spec?.cduCount ?? 1;
  const leafPorts = 32;
  const leafCount = Math.ceil(d.gpus / leafPorts);
  const fabric64 = (64 * 64) / 2;
  const fabricTiers = d.gpus <= fabric64 ? 2 : 3;

  const warnings = [...stackIssues(slots)];

  if (gpuWantsLiquid(slots) && plan.coolingClass === "air") {
    warnings.push({
      level: "high",
      title: "Cooling interface mismatch",
      detail:
        "GPU block expects liquid, but the rack program is air-only. Cold plates or a liquid rack domain are required before you lock MEP.",
    });
  }
  if (plan.rackKw > 50 && plan.coolingClass !== "direct_liquid") {
    warnings.push({
      level: "high",
      title: "Density above practical air ceiling",
      detail: `${formatNum(plan.rackKw, 0)} kW/rack usually needs direct liquid or immersion, not room air alone.`,
    });
  }
  if (plan.rackKw > 20 && plan.coolingClass === "air") {
    warnings.push({
      level: "medium",
      title: "Contained aisles required",
      detail: "Above ~20 kW/rack, plan hot/cold containment and prove CFM at the rack front before structural sign-off.",
    });
  }
  if (plan.coolingClass !== "air" && !hasCdu) {
    warnings.push({
      level: "medium",
      title: "No CDU in program",
      detail: "Liquid or rear-door programs need CDUs or door HX skids in the row · add the in-row CDU block or specify central plant interface.",
    });
  }
  if (rackA > 100) {
    warnings.push({
      level: "medium",
      title: "Rack feed exceeds typical PDU",
      detail: `~${formatNum(Math.round(rackA))} A/rack at 400 V · budget busway taps and whips, not vertical PDUs.`,
    });
  }
  if (rowA > BUSWAY_A * 0.85) {
    warnings.push({
      level: "high",
      title: "Row ampacity",
      detail: `Row draw ~${formatNum(Math.round(rowA))} A approaches ${BUSWAY_A} A busway · split the row or upsize feed.`,
    });
  }
  if (floorLoad > SLAB_KG_M2 * 0.75) {
    warnings.push({
      level: "medium",
      title: "Floor loading",
      detail: `~${formatNum(Math.round(floorLoad))} kg/m² average · confirm slab rating and spreader plates for liquid racks.`,
    });
  }
  if (plan.feedRedundancy === "2N" && plan.hallKw > 500) {
    warnings.push({
      level: "low",
      title: "2N path length",
      detail: "Dual feeds double switchgear and UPS footprint · show A/B paths on the floor plan before permit set.",
    });
  }
  if (!hasLeaf && d.gpus > 64) {
    warnings.push({
      level: "low",
      title: "Fabric not pinned",
      detail: `${formatNum(d.gpus)} GPU ports need ~${leafCount} leaf switches · add the leaf block or attach a network BOQ.`,
    });
  }

  const bom = [
    {
      trade: "IT",
      item: plan.integrated ? "Liquid compute rack" : "GPU server",
      qty: plan.integrated ? d.racks : d.racks * plan.serversPerRack,
      unit: plan.integrated ? "rack" : "server",
      note: plan.integrated ? `${plan.gpusPerRack} GPUs each` : `${plan.gpusPerServer} GPUs each`,
    },
    {
      trade: "IT",
      item: "Rack enclosure",
      qty: plan.integrated ? 0 : d.racks,
      unit: "ea",
      note: plan.integrated ? "Included in integrated rack" : `${plan.rackKw.toFixed(0)} kW class`,
    },
    {
      trade: "Power",
      item: "Busway + taps",
      qty: plan.rows,
      unit: "row run",
      note: `${plan.feedRedundancy} feed, ~${formatNum(Math.round(rowA))} A/row`,
    },
    {
      trade: "Power",
      item: "UPS block",
      qty: 1,
      unit: "system",
      note: `${site?.spec?.upsTopology ?? "N+1"} · ${formatNum(designSiteMw, 2)} MW design (incl. ${plan.sparePct}% spare)`,
    },
    {
      trade: "Power",
      item: "Standby generator",
      qty: 1,
      unit: "plant",
      note: `~${formatNum(Math.ceil((designHallKw * plan.pue) / 100) * 100)} kW class (rule-of-thumb)`,
    },
    {
      trade: "Cooling",
      item: plan.coolingClass === "air" ? "CRAH / in-row air" : "CDU + CHW interface",
      qty: plan.coolingClass === "air" ? Math.ceil(d.racks / 6) : plan.rows * cduPerRow,
      unit: plan.coolingClass === "air" ? "unit" : "CDU",
      note:
        plan.coolingClass === "air"
          ? `~${formatNum(round100(cfm(plan.rackKw)))} CFM/rack reference`
          : `~${formatNum(hallLoopLpm)} L/min hall loop`,
    },
    {
      trade: "Cooling",
      item: "Heat rejection",
      qty: Math.max(1, Math.ceil(heatTons / 400)),
      unit: "chiller train",
      note: `${formatNum(heatTons)} tons IT + ${site?.spec?.heatRejection ?? "plant"}`,
    },
    {
      trade: "Network",
      item: "Leaf switch (64p class)",
      qty: hasLeaf ? leafCount : Math.ceil(leafCount / 2),
      unit: "ea",
      note: `${fabricTiers}-tier fabric · ${formatNum(d.gpus)} endpoints`,
    },
    {
      trade: "Network",
      item: "Spine switch",
      qty: Math.max(2, Math.ceil(leafCount / 16)),
      unit: "ea",
      note: "Adjust for oversubscription target",
    },
    {
      trade: "Space",
      item: "White space (incl. aisles)",
      qty: Math.round(plan.areaM2),
      unit: "m²",
      note: `${d.racks} racks @ 3 m²/rack model`,
    },
  ].filter((line) => line.qty > 0);

  const brief = buildBrief(plan, d, site, designSiteMw, hallLoopLpm, heatTons);

  const commission = [
    {
      phase: "Program",
      tasks: [
        "Freeze IT kW/rack and GPU count per rack",
        `Sign ${plan.sparePct}% growth headroom on electrical and cooling`,
        "Agree PUE target and heat rejection type with utility",
      ],
    },
    {
      phase: "Design development",
      tasks: [
        "Single-line: utility → UPS → busway → rack",
        `CHW / air diagram with ${coolingClassLabel(plan.coolingClass)} at rack`,
        "Floor plan: containment, network row, delivery path",
      ],
    },
    {
      phase: "Construction",
      tasks: [
        "Pour and test slab for rack loads",
        "Busway and dual feeds if 2N",
        "Leak detection and glycol loop fill points at each row",
      ],
    },
    {
      phase: "Commissioning",
      tasks: [
        "Integrated system test at partial IT load",
        "Prove ΔT and flow at each CDU / rear door",
        "Fabric BER test GPU ↔ leaf ↔ spine",
      ],
    },
    {
      phase: "Operations handoff",
      tasks: [
        "Runbooks per ISA layer (watch / usual failures)",
        "BMS points tied to hall_it_kw and loop_flow_lpm",
        "Spare parts: optics, pumps, PSU, quick-connects",
      ],
    },
  ];

  const mep = buildMepSteps(plan, site, d, designSiteMw, hallLoopLpm, hasCdu);

  return {
    warnings,
    bom,
    brief,
    commission,
    mep,
    stats: {
      designSiteMw,
      hallLoopLpm,
      heatTons,
      leafCount,
      fabricTiers,
      floorLoad,
    },
  };
}

function buildBrief(plan, d, site, designSiteMw, hallLoopLpm, heatTons) {
  const scale =
    d.racks <= 8 ? "pod" : d.racks <= 24 ? "hall" : "multi-hall tranche";
  return (
    `Facility program: ${scale} with ${formatNum(d.racks)} racks (${formatNum(d.gpus)} GPUs), ` +
    `${formatNum(d.hallKw)} kW IT (${formatNum(designSiteMw, 2)} MW design at ${formatNum(plan.pue, 2)} PUE including ${plan.sparePct}% headroom). ` +
    `Cooling: ${coolingClassLabel(plan.coolingClass)} · reject ~${formatNum(heatTons)} tons, ` +
    `${plan.coolingClass === "air" ? "air-side" : "~" + formatNum(hallLoopLpm) + " L/min liquid loop"}. ` +
    `Power: ${plan.feedRedundancy} feeds to ${plan.rows} row busways. ` +
    `Plant: ${site?.spec?.heatRejection ?? "TBD"} rejection, UPS ${site?.spec?.upsTopology ?? "N+1"}.`
  );
}

function buildMepSteps(plan, site, d, designSiteMw, hallLoopLpm, hasCdu) {
  const power = [
    { id: "utility", label: "Utility feed", sub: `${formatNum(designSiteMw, 2)} MW` },
    { id: "xfmr", label: "MV transformer", sub: "Medium voltage" },
    { id: "ups", label: "UPS", sub: site?.spec?.upsTopology ?? "N+1" },
    { id: "bus", label: "Busway", sub: `${plan.feedRedundancy} · ${plan.rows} rows` },
    { id: "rackp", label: "Rack feed", sub: `~${formatNum(Math.round(amps(plan.rackKw)))} A` },
    { id: "it", label: "IT load", sub: `${formatNum(d.hallKw)} kW` },
  ];

  const cool = [
    { id: "rackc", label: "Rack heat", sub: `${formatNum(plan.rackKw, 0)} kW` },
    {
      id: "edge",
      label: plan.coolingClass === "air" ? "Room air" : hasCdu ? "CDU skid" : "Door / CDU",
      sub: coolingClassLabel(plan.coolingClass),
    },
    { id: "loop", label: "Building loop", sub: plan.coolingClass === "air" ? "CRAH" : `${formatNum(hallLoopLpm)} L/min` },
    { id: "plant", label: "Central plant", sub: site?.spec?.heatRejection ?? "Chiller" },
    { id: "reject", label: "Rejection", sub: "Dry / evap / tower" },
  ];

  return { power, cool };
}
