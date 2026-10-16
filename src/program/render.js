import { getBlock } from "../catalog/blocks.js";
import { normalizeGpuMix } from "../build/gpuMix.js";
import { coolingClassLabel } from "../build/plan.js";
import { designSiteMw } from "../build/program.js";
import { derivePlan, formatNum } from "../calc.js";
import { drawProgramVisual } from "./facilityScene.js";
import { drawMepDiagram } from "../architect/mepDiagram.js";

const LOADOUT_LAYERS = [
  { id: "gpu", label: "GPU" },
  { id: "server", label: "Server" },
  { id: "rack", label: "Rack" },
  { id: "row", label: "Row" },
  { id: "hall", label: "Hall" },
  { id: "site", label: "Site" },
];

function setHtml(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function warningClass(level) {
  if (level === "high") return "warn-high";
  if (level === "medium") return "warn-med";
  return "warn-low";
}

function scaleLabel(racks) {
  if (racks <= 8) return "Pod";
  if (racks <= 24) return "Hall";
  return "Tranche";
}

function readinessFromWarnings(warnings) {
  let score = 100;
  for (const w of warnings) {
    if (w.level === "high") score -= 20;
    else if (w.level === "medium") score -= 11;
    else score -= 5;
  }
  return Math.max(0, Math.min(100, score));
}

function readinessLabel(score, warningCount) {
  if (warningCount === 0) return "Ready for DD review";
  if (score >= 85) return "Minor open items";
  if (score >= 65) return "Resolve flags before permit";
  return "Blocking gaps · fix in Build";
}

function loadoutEntries(plan, slots, optionalIds) {
  const mix = normalizeGpuMix(slots.gpuMix);
  const gpuName =
    mix.length > 1
      ? `${mix.length}-SKU mix`
      : (getBlock(mix[0]?.id)?.name ?? "-");
  const gpuStat =
    mix.length > 1
      ? mix
          .map((m) => `${formatNum(Math.round(m.pct))}% ${getBlock(m.id)?.name?.split(" ")[0] ?? ""}`)
          .join(" · ")
      : "Primary SKU";

  const row = getBlock(slots.row);
  const addons = [];
  if (optionalIds.has("cool-cdu")) addons.push("CDU");
  if (optionalIds.has("net-leaf-64")) addons.push("Leaf");

  const entries = {
    gpu: { name: gpuName, stat: gpuStat },
    server: plan.integrated
      ? { name: "In rack", stat: "Integrated domain" }
      : {
          name: getBlock(slots.server)?.name ?? "-",
          stat: `${formatNum(plan.serverKw, 1)} kW · ${plan.gpusPerServer}× GPU`,
        },
    rack: {
      name: getBlock(slots.rack)?.name ?? "-",
      stat: `${formatNum(plan.rackKw, 0)} kW · ${plan.integrated ? plan.gpusPerRack + " GPU" : plan.serversPerRack + " srv"}`,
    },
    row: {
      name: row?.name ?? "-",
      stat: `${plan.racksPerRow}/row${addons.length ? " · " + addons.join(", ") : ""}`,
    },
    hall: {
      name: getBlock(slots.hall)?.name ?? "-",
      stat: `${plan.rows}×${plan.racksPerRow} · ~${formatNum(Math.round(plan.areaM2))} m²`,
    },
    site: {
      name: getBlock(slots.site)?.name ?? "-",
      stat: `PUE ${formatNum(plan.pue, 2)} · ${plan.sparePct}% · ${plan.feedRedundancy}`,
    },
  };
  return entries;
}

function renderHeader(plan, d) {
  setText("program-title", plan.label || "Facility program");
  setText(
    "program-sub",
    `${scaleLabel(d.racks)} · ${formatNum(d.racks)} racks · ${formatNum(d.gpus)} GPU · ${coolingClassLabel(plan.coolingClass)}`,
  );
}

function renderBriefLines(plan, d, f, site) {
  const stats = f.stats;
  const coolingLine =
    plan.coolingClass === "air"
      ? `${coolingClassLabel(plan.coolingClass)} · ~${formatNum(stats.heatTons)} tons rejection`
      : `${coolingClassLabel(plan.coolingClass)} · ~${formatNum(stats.heatTons)} tons · ~${formatNum(stats.hallLoopLpm)} L/min`;

  const lines = [
    {
      k: "Scale",
      v: `${formatNum(d.racks)} racks · ${formatNum(d.gpus)} GPU · ${formatNum(d.hallKw)} kW IT`,
    },
    {
      k: "Utility",
      v: `${formatNum(stats.designSiteMw, 2)} MW design · PUE ${formatNum(plan.pue, 2)} · ${plan.sparePct}% headroom`,
    },
    { k: "Cooling", v: coolingLine },
    {
      k: "Power",
      v: `${plan.feedRedundancy} feeds · ${plan.rows} row busways · UPS ${site?.spec?.upsTopology ?? "N+1"}`,
    },
  ];

  setHtml(
    "program-brief-lines",
    lines
      .map(
        (line) =>
          `<li class="brief-line"><span class="brief-k">${line.k}</span><span class="brief-v">${line.v}</span></li>`,
      )
      .join(""),
  );
}

function renderReadiness(warnings) {
  const score = readinessFromWarnings(warnings);
  const el = document.getElementById("program-readiness");
  if (!el) return;
  const label = readinessLabel(score, warnings.length);
  const tier = score >= 85 ? "ok" : score >= 65 ? "med" : "low";
  el.innerHTML = `
    <div class="readiness-meter readiness-${tier}" role="meter" aria-valuenow="${score}" aria-valuemin="0" aria-valuemax="100">
      <div class="readiness-bar" style="width:${score}%"></div>
    </div>
    <p class="readiness-copy"><strong>${score}%</strong> · ${label}${warnings.length ? ` · ${warnings.length} open` : ""}</p>`;
}

function renderLoadout(plan, slots, optionalIds) {
  const el = document.getElementById("program-loadout");
  if (!el) return;
  const entries = loadoutEntries(plan, slots, optionalIds);
  const layers = plan.integrated
    ? LOADOUT_LAYERS.filter((l) => l.id !== "server")
    : LOADOUT_LAYERS;

  el.innerHTML = layers
    .map(({ id, label }) => {
      const e = entries[id];
      return `<button type="button" class="loadout-slot" data-isa-layer="${id}" title="Edit in Build">
        <span class="loadout-layer">${label}</span>
        <span class="loadout-name">${e.name}</span>
        <span class="loadout-stat">${e.stat}</span>
      </button>`;
    })
    .join("");

  el.querySelectorAll(".loadout-slot").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.dispatchEvent(
        new CustomEvent("program-focus-layer", { detail: { layer: btn.dataset.isaLayer } }),
      );
    });
  });
}

function renderArmory(plan, d, f) {
  const el = document.getElementById("program-armory");
  if (!el) return;
  const stats = f.stats;
  const leafLine = f.bom.find((r) => r.item.includes("Leaf"));
  const tiles = [
    {
      k: "Compute",
      v: formatNum(d.gpus),
      u: "GPU",
      sub: plan.integrated
        ? `${formatNum(d.racks)} integrated racks`
        : `${formatNum(d.racks * plan.serversPerRack)} servers`,
    },
    {
      k: "Enclosure",
      v: formatNum(d.racks),
      u: "racks",
      sub: `${formatNum(plan.rackKw, 0)} kW class`,
    },
    {
      k: "Electrical",
      v: formatNum(stats.designSiteMw, 2),
      u: "MW",
      sub: `${plan.feedRedundancy} · ${plan.rows} busways`,
    },
    {
      k: "Heat",
      v: formatNum(stats.heatTons),
      u: "tons",
      sub:
        plan.coolingClass === "air"
          ? "Air-side rejection"
          : `${formatNum(stats.hallLoopLpm)} L/min loop`,
    },
    {
      k: "Fabric",
      v: leafLine ? formatNum(leafLine.qty) : formatNum(stats.leafCount),
      u: "leaf",
      sub: `${stats.fabricTiers}-tier · ${formatNum(d.gpus)} ports`,
    },
    {
      k: "Space",
      v: formatNum(Math.round(plan.areaM2)),
      u: "m²",
      sub: "White space model",
    },
  ];

  el.innerHTML = tiles
    .map(
      (t) =>
        `<div class="armory-tile"><span class="armory-k">${t.k}</span><p class="armory-v"><span class="armory-num">${t.v}</span> <span class="armory-u">${t.u}</span></p><span class="armory-sub">${t.sub}</span></div>`,
    )
    .join("");
}

function renderWarnings(warnings) {
  const wrap = document.getElementById("program-open-wrap");
  const warnEl = document.getElementById("facility-warnings");
  if (!warnEl) return;
  if (wrap) wrap.hidden = false;
  if (!warnings.length) {
    if (wrap) wrap.hidden = true;
    warnEl.innerHTML = "";
    return;
  }
  const order = { high: 0, medium: 1, low: 2 };
  const sorted = [...warnings].sort((a, b) => (order[a.level] ?? 9) - (order[b.level] ?? 9));
  warnEl.innerHTML = sorted
    .map(
      (w) =>
        `<article class="warn-card ${warningClass(w.level)}"><p class="warn-title">${w.title}</p><p class="warn-detail">${w.detail}</p></article>`,
    )
    .join("");
}

function renderBom(bom) {
  const bomEl = document.getElementById("facility-bom");
  const countEl = document.getElementById("bom-detail-count");
  if (!bomEl) return;
  if (countEl) countEl.textContent = `${bom.length} lines`;
  const byTrade = {};
  bom.forEach((r) => {
    if (!byTrade[r.trade]) byTrade[r.trade] = [];
    byTrade[r.trade].push(r);
  });
  let html = "";
  for (const [trade, lines] of Object.entries(byTrade)) {
    html += `<div class="bom-trade"><h4 class="bom-trade-title">${trade}</h4><ul class="bom-compact">`;
    html += lines
      .map(
        (r) =>
          `<li><span class="bom-line-item">${r.item}</span><span class="bom-line-qty">${formatNum(r.qty)} ${r.unit}</span><span class="bom-line-note">${r.note}</span></li>`,
      )
      .join("");
    html += `</ul></div>`;
  }
  bomEl.innerHTML = html;
}

function renderCommission(commission) {
  const commEl = document.getElementById("facility-commission");
  const countEl = document.getElementById("comm-detail-count");
  if (!commEl) return;
  const taskCount = commission.reduce((n, c) => n + c.tasks.length, 0);
  if (countEl) countEl.textContent = `${commission.length} phases · ${taskCount} tasks`;
  commEl.innerHTML = commission
    .map(
      (c, i) =>
        `<details class="comm-phase-details"${i === 0 ? " open" : ""}>
          <summary><span class="comm-phase-name"><span class="comm-num-inline">${i + 1}</span>${c.phase}</span><span class="comm-phase-meta">${c.tasks.length} tasks</span></summary>
          <ul class="comm-task-list">${c.tasks.map((t) => `<li>${t}</li>`).join("")}</ul>
        </details>`,
    )
    .join("");
}

export function renderProgramTab(plan, slots, optionalIds, f) {
  const d = derivePlan(plan);
  const site = getBlock(slots.site);

  renderHeader(plan, d);
  drawProgramVisual(plan, slots, f.stats);
  drawMepDiagram("svg-mep", f.mep);

  setText("facility-brief", f.brief);
  renderBriefLines(plan, d, f, site);
  renderReadiness(f.warnings);
  renderLoadout(plan, slots, optionalIds);
  renderArmory(plan, d, f);
  renderWarnings(f.warnings);
  renderBom(f.bom);
  renderCommission(f.commission);
}
