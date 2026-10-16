import { getBlock } from "../catalog/blocks.js";
import { primaryGpu } from "../build/gpuMix.js";
import { amps, derivePlan, formatNum, formulas, lpm, tons } from "../calc.js";
import { coolingClassLabel } from "../build/plan.js";
import { analyzeFacility } from "../architect/facility.js";
import { term } from "../guide/glossary.js";
import { renderScaleTab } from "../size/render.js";
import { deriveFabric } from "../scale/fabric.js";
import { renderLayerWatchRows, wireLayerWatchTable } from "../operator/layerWatchTable.js";

const LAYER_ORDER = ["gpu", "server", "rack", "row", "hall", "site"];

let layerFocusHandler = null;

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function codeLabel(code) {
  const hint = term(code)
    ? ` <button type="button" class="term-hint term-hint-inline" data-term-id="${code}" aria-label="Explain ${code}">?</button>`
    : "";
  return `<code>${code}</code>${hint}`;
}

function fieldLine(code, value, unit = "") {
  if (value === undefined || value === null) {
    return `<span class="field-line">${codeLabel(code)}<span class="field-hint">declare</span></span>`;
  }
  const display =
    typeof value === "number"
      ? `${formatNum(value, value < 10 && value % 1 ? 1 : 0)}${unit ? " " + unit : ""}`
      : `${value}${unit ? " " + unit : ""}`;
  return `<span class="field-line">${codeLabel(code)}<span class="field-eq">=</span><span class="field-val">${display}</span></span>`;
}

function matrixCell(lines) {
  return lines.filter(Boolean).join("");
}

function matrixHighlight(text, sub) {
  return `<span class="matrix-highlight">${text}</span>${sub ? `<span class="matrix-sub">${sub}</span>` : ""}`;
}

export function renderSpecSections(plan, slots, optionalIds, ctx = {}) {
  layerFocusHandler = ctx.onLayerFocus || null;
  const d = derivePlan(plan);
  const f = analyzeFacility(plan, slots, optionalIds);
  const activeLayer = ctx.activeLayer || null;

  renderScaleTab(plan, slots, optionalIds, f.stats);
  renderMatrix(plan, slots, d, f.stats, optionalIds, activeLayer);
  renderOperate(slots, plan, activeLayer);
}

function renderMatrix(plan, slots, d, facilityStats, optionalIds, activeLayer) {
  const gpu = primaryGpu(slots);
  const server = getBlock(slots.server);
  const rack = getBlock(slots.rack);
  const row = getBlock(slots.row);
  const hall = getBlock(slots.hall);
  const site = getBlock(slots.site);
  const fabric = deriveFabric(plan, slots, optionalIds);
  const leafCount = fabric.leafCount;
  const hallLpm = Math.round(lpm(d.hallKw));

  const rows = [];

  rows.push({
    layer: "gpu",
    power: matrixCell([
      fieldLine("board_power_w", gpu?.spec.boardPowerW, "W"),
      fieldLine("power_cap_range_w", null),
    ]),
    cool: matrixCell([
      fieldLine("cooling_method", null),
      `<span class="field-line"><code>max_temp_c</code><span class="field-val">${gpu?.spec.maxTempC ?? "-"} °C</span></span>`,
    ]),
    net: matrixCell([
      fieldLine("scale_out_gbps", fabric.scaleOutGbps, "Gbps"),
      fieldLine("scale_up_link", plan.integrated ? "in-rack" : gpu?.isa?.scale_up_link ?? "PCIe/NVL"),
    ]),
    space: matrixCell([
      fieldLine("form_factor", "SXM/PCIe"),
      fieldLine("memory_gb", gpu?.spec.memoryGb, "GB"),
    ]),
  });

  if (!plan.integrated) {
    rows.push({
      layer: "server",
      power: matrixCell([
        fieldLine("server_power_w", Math.round(plan.serverKw * 1000), "W"),
        fieldLine("input_voltage", formulas.volts, "V 3φ"),
      ]),
      cool: matrixCell([
        fieldLine("airflow_cfm", server?.spec.airflowCfm, "CFM"),
        fieldLine("inlet_temp_c", 18, "°C"),
      ]),
      net: matrixCell([
        fieldLine("server_fabric_gbps", fabric.gbpsPerServer, "Gbps"),
        fieldLine("nic_ports", server?.spec.nicPorts),
      ]),
      space: matrixCell([fieldLine("rack_units", server?.spec.rackUnits, "U")]),
    });
  }

  rows.push({
    layer: "rack",
    power: matrixCell([
      fieldLine("rack_kw", plan.rackKw, "kW"),
      fieldLine("feed_amps", Math.round(amps(plan.rackKw)), "A"),
    ]),
    cool: matrixCell([
      `<span class="field-line"><code>cooling_class</code><span class="field-val">${coolingClassLabel(plan.coolingClass)}</span></span>`,
      fieldLine("coolant_lpm", Math.round(lpm(plan.rackKw)), "L/min"),
    ]),
    net: matrixCell([
      fieldLine("fabric_gbps_per_rack", Math.round(fabric.gbpsPerRack), "Gbps"),
      fieldLine("downlinks_per_rack", fabric.downlinksPerRack),
      fieldLine("tor_switches", plan.integrated ? 0 : 2),
    ]),
    space: matrixCell([
      fieldLine("rack_height_u", rack?.spec.rackHeightU, "U"),
      fieldLine("rack_weight_kg", rack?.spec.weightKgPerRack, "kg"),
    ]),
  });

  rows.push({
    layer: "row",
    power: matrixCell([
      fieldLine("row_kw", plan.rowKw, "kW"),
      fieldLine("busway_amps", Math.round(amps(plan.rowKw)), "A"),
      `<span class="field-line"><code>feed_redundancy</code><span class="field-val">${plan.feedRedundancy}</span></span>`,
    ]),
    cool: matrixCell([
      fieldLine("containment", row?.spec.containment?.replace(/_/g, " ") ?? "hot/cold"),
      fieldLine("cdu_count", optionalIds?.has("cool-cdu") ? row?.spec.cduCount : 0),
    ]),
    net: matrixCell([
      fieldLine("leaf_switches", leafCount),
      fieldLine("uplinks_per_leaf", fabric.uplinksPerLeaf),
      fieldLine("leaf_port_speed_gbps", fabric.portSpeedGbps, "Gbps"),
      fabric.leafPinned
        ? `<span class="field-line"><code>leaf_block</code><span class="field-val">pinned</span></span>`
        : `<span class="field-line"><code>leaf_block</code><span class="field-hint">add in Build</span></span>`,
    ]),
    space: matrixCell([
      fieldLine("racks_per_row", plan.racksPerRow),
      fieldLine("row_length_m", (plan.racksPerRow * 1.2).toFixed(1), "m"),
    ]),
  });

  rows.push({
    layer: "hall",
    power: matrixCell([
      fieldLine("hall_it_kw", d.hallKw, "kW"),
      fieldLine("ups_feeds", plan.feedRedundancy === "2N" ? 2 : 1),
    ]),
    cool: matrixCell([
      fieldLine("loop_flow_lpm", hallLpm, "L/min"),
      fieldLine("heat_to_reject_kw", d.hallKw, "kW"),
    ]),
    net: matrixCell([
      fieldLine("fabric_tiers", fabric.fabricTiers),
      fieldLine("spine_switches", fabric.spineCount),
    ]),
    space: matrixCell([
      fieldLine("floor_area_m2", Math.round(d.areaM2), "m²"),
      fieldLine("ceiling_height_m", hall?.spec.ceilingHeightM, "m"),
    ]),
  });

  rows.push({
    layer: "site",
    power: matrixCell([
      fieldLine("grid_mw", (d.siteKw / 1000).toFixed(2), "MW"),
      fieldLine("pue", plan.pue),
      `<span class="field-line"><code>ups_topology</code><span class="field-val">${site?.spec.upsTopology ?? "N+1"}</span></span>`,
    ]),
    cool: matrixCell([
      `<span class="field-line"><code>heat_rejection</code><span class="field-val">${site?.spec.heatRejection ?? "-"}</span></span>`,
      fieldLine("heat_reject_tons", Math.round(tons(d.hallKw)), "tons"),
    ]),
    net: matrixCell([
      fieldLine("wan_paths", 2),
      fieldLine("fabric_endpoints", d.gpus, "GPU"),
    ]),
    space: matrixCell([
      fieldLine("land_m2", Math.round(d.areaM2 * 2.5), "m²"),
      `<span class="field-line"><code>floor_load_kg_m2</code><span class="field-val">~${formatNum(Math.round(facilityStats.floorLoad))}</span></span>`,
    ]),
  });

  const labels = {
    gpu: "GPU",
    server: "Server",
    rack: "Rack",
    row: "Row",
    hall: "Hall",
    site: "Site",
  };

  const tb = document.getElementById("matrix-body");
  if (!tb) return;

  tb.innerHTML = rows
    .map((r) => {
      const active = activeLayer === r.layer ? " matrix-row-active" : "";
      return `<tr class="matrix-row${active}" data-layer="${r.layer}" tabindex="0">
      <th scope="row" class="matrix-layer-th">${labels[r.layer]}</th>
      <td class="matrix-col-power matrix-cell">${r.power}</td>
      <td class="matrix-col-cool matrix-cell">${r.cool}</td>
      <td class="matrix-col-net matrix-cell matrix-cell-net">${r.net}</td>
      <td class="matrix-col-space matrix-cell">${r.space}</td>
    </tr>`;
    })
    .join("");

  const wrap = document.getElementById("matrix-wrap");
  if (wrap) wrap.dataset.laneFocus = "all";

  const matrixRoot = document.getElementById("isa-matrix");
  if (matrixRoot && !matrixRoot.dataset.wired) {
    matrixRoot.dataset.wired = "1";
    matrixRoot.addEventListener("click", (e) => {
      const layerTh = e.target.closest(".matrix-layer-th");
      if (!layerTh) return;
      const tr = layerTh.closest("[data-layer]");
      if (tr && layerFocusHandler) layerFocusHandler(tr.dataset.layer);
    });
  }

  if (!tb.dataset.wired) {
    tb.dataset.wired = "1";
    tb.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const tr = e.target.closest("[data-layer]");
      if (tr && layerFocusHandler) {
        e.preventDefault();
        layerFocusHandler(tr.dataset.layer);
      }
    });
  }
}

function renderOperate(slots, plan, activeLayer) {
  const tb = document.getElementById("op-body");
  if (!tb) return;
  tb.innerHTML = renderLayerWatchRows(slots, plan, activeLayer);
  wireLayerWatchTable(layerFocusHandler);
}
