import { getBlock } from "../catalog/blocks.js";
import { coolingClassLabel } from "../build/plan.js";
import { amps, cfm, derivePlan, formatNum, lpm, round100, tons } from "../calc.js";
import { term } from "./glossary.js";

function esc(v) {
  if (v === undefined || v === null || v === "") return "-";
  return String(v);
}

export function specTable(title, rows) {
  const body = rows
    .map(
      ([field, value, unit]) =>
        `<tr><th scope="row"><code>${field}</code></th><td>${esc(value)}${unit ? ` <span class="spec-u">${unit}</span>` : ""}</td></tr>`,
    )
    .join("");
  return `<div class="spec-sheet"><p class="spec-title">${title}</p><table class="spec-tbl"><tbody>${body}</tbody></table></div>`;
}

/** Full ISA table · avoid in UI when Scale matrix already lists layer fields. */
export function blockSpecSheet(blockId) {
  const b = getBlock(blockId);
  if (!b) return "";
  const isa = b.isa ?? specFromLegacyBlock(b);
  const rows = Object.entries(isa).map(([k, v]) => [k, v, ""]);
  return specTable(b.name, rows);
}

/** Build sidebar: operate hints + pointer to matrix (no duplicate datasheet dump). */
export function compactBlockSpec(blockId) {
  const b = getBlock(blockId);
  if (!b) return "";
  const L = b.learn;
  let html = `<div class="spec-sheet spec-sheet-compact">`;
  html += `<p class="spec-title">${b.name}</p>`;
  html += `<p class="spec-compact-short">${esc(b.short)}</p>`;
  if (L?.watch) {
    html += `<p class="spec-compact-line"><span class="spec-compact-k">Watch</span> ${esc(L.watch)}</p>`;
  }
  if (L?.fails) {
    html += `<p class="spec-compact-line"><span class="spec-compact-k">Usual fail</span> ${esc(L.fails)}</p>`;
  }
  html += `<p class="spec-compact-hint">Layer fields by tier → <button type="button" class="text-btn" data-app-goto="scale">Scale matrix</button></p>`;
  html += `</div>`;
  return html;
}

function specFromLegacyBlock(b) {
  const s = b.spec ?? {};
  const out = {};
  if (s.boardPowerW != null) out.board_power_w = s.boardPowerW;
  if (s.memoryGb != null) out.memory_gb = s.memoryGb;
  if (s.scaleOutGbps != null) out.scale_out_gbps = s.scaleOutGbps;
  if (s.coolingMethod != null) out.cooling_method = s.coolingMethod;
  if (s.maxTempC != null) out.max_temp_c = s.maxTempC;
  if (s.serverKw != null) out.server_power_w = Math.round(s.serverKw * 1000);
  if (s.gpusPerServer != null) out.gpus_per_server = s.gpusPerServer;
  if (s.rackKw != null) out.rack_kw = s.rackKw;
  if (s.gpusPerRack != null) out.gpus_per_rack = s.gpusPerRack;
  if (s.serversPerRack != null) out.servers_per_rack = s.serversPerRack;
  if (s.coolingClass != null) out.cooling_class = s.coolingClass;
  if (s.racksPerRow != null) out.racks_per_row = s.racksPerRow;
  if (s.rows != null) out.rows = s.rows;
  if (s.pue != null) out.pue = s.pue;
  if (s.cduKw != null) out.cdu_kw = s.cduKw;
  if (s.fabricPorts != null) out.fabric_ports = s.fabricPorts;
  return out;
}

export function programSpecSheet(plan, slots) {
  const d = derivePlan(plan);
  const rows = [
    ["hall_it_kw", formatNum(d.hallKw), "kW"],
    ["grid_mw", formatNum(d.siteKw / 1000, 2), "MW"],
    ["pue", plan.pue, ""],
    ["gpus", formatNum(d.gpus), ""],
    ["racks", formatNum(d.racks), ""],
    ["rack_kw", formatNum(plan.rackKw, plan.rackKw < 100 ? 1 : 0), "kW"],
    ["row_kw", formatNum(plan.rowKw, 0), "kW"],
    ["cooling_class", coolingClassLabel(plan.coolingClass), ""],
    ["rack_feed_amps", formatNum(Math.round(amps(plan.rackKw))), "A @ 400 V 3φ"],
    ["hall_loop_lpm", formatNum(Math.round(lpm(d.hallKw))), "L/min"],
    ["heat_reject_tons", formatNum(Math.round(tons(d.hallKw))), "tons"],
    ["floor_area_m2", formatNum(Math.round(d.areaM2)), "m²"],
    ["feed_redundancy", plan.feedRedundancy, ""],
    ["spare_pct", plan.sparePct, "%"],
  ];
  return specTable("Derived program", rows);
}

export function glossarySpec(termId) {
  const t = term(termId);
  if (!t) return "";
  const rows = [["term", t.label, ""]];
  if (t.unit) rows.push(["typical_unit", t.unit, ""]);
  if (t.formula) rows.push(["formula", t.formula, ""]);
  if (t.notes) rows.push(["notes", t.notes, ""]);
  return specTable(t.label, rows);
}
