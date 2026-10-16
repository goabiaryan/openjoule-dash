import {
  blocksForLayer,
  defaultSlots,
  getBlock,
  gpuBlocksByGroup,
  LAYERS,
  optionalBlocksForLayer,
} from "../catalog/blocks.js";
import {
  gpuServerCompatible,
  integratedGpuAllowed,
  pickGpuForRack,
  pickServerForGpu,
} from "../catalog/compat.js";
import { coolingClassLabel, planFromSlots } from "./plan.js";
import { designSiteMw } from "./program.js";
import { amps, cfm, derivePlan, formatNum, lpm, round100, tons } from "../calc.js";
import { renderFacilityStudio } from "../architect/render.js";
import { renderSpecSections } from "../spec/sections.js";
import { initAppShell, setView } from "../app/shell.js";
import {
  metricTermId,
  renderContextPanel,
  setSpecContext,
  wireContextPanel,
  clearPinnedTerm,
} from "../guide/render.js";
import { renderOperateTab } from "../operator/render.js";
import { stopOperateSimulator } from "../operator/mockDashboards.js";
import { renderScaleTab } from "../size/render.js";
import { analyzeFacility } from "../architect/facility.js";
import {
  normalizeGpuMix,
  primaryGpuId,
  toggleGpuInMix,
} from "./gpuMix.js";

const layerLabels = {
  gpu: "GPU",
  server: "Server",
  rack: "Rack",
  row: "Row",
  hall: "Hall",
  site: "Site",
};

let slots = { ...defaultSlots };
let selectedBlockId = null;
let optionalRow = new Set(["cool-cdu"]);

function integratedRack() {
  return getBlock(slots.rack)?.spec?.integrated === true;
}

function visibleLayers() {
  if (integratedRack()) {
    return LAYERS.filter((l) => l !== "server");
  }
  return LAYERS;
}

function activeLayerFromSelection() {
  const b = selectedBlockId ? getBlock(selectedBlockId) : null;
  return b?.layer ?? null;
}

function focusLayer(layer) {
  if (layer === "server" && integratedRack()) return;
  if (layer === "gpu") {
    selectedBlockId = primaryGpuId(slots);
  } else if (!slots[layer]) {
    return;
  } else {
    selectedBlockId = slots[layer];
  }
  clearPinnedTerm();
  const plan = planFromSlots(slots);
  setSpecContext(plan, slots);
  renderIsaColumns();
  renderSpecSections(plan, slots, optionalRow, {
    activeLayer: layer,
    onLayerFocus: focusLayer,
  });
  renderContextPanel(selectedBlockId);
  setView("build");
  document
    .querySelector(`.isa-col[data-isa-layer="${layer}"]`)
    ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
}

function emitChange() {
  const plan = planFromSlots(slots);
  renderMetrics(plan);
  renderIsaColumns();
  renderFacilityStudio(plan, slots, optionalRow);
  setSpecContext(plan, slots);
  renderSpecSections(plan, slots, optionalRow, {
    activeLayer: activeLayerFromSelection(),
    onLayerFocus: focusLayer,
  });
  renderContextPanel(selectedBlockId);
  renderOperateTab(plan, slots, optionalRow);
}

function reconcileStackAfterSlot(layer, blockId) {
  if (layer === "rack") {
    const rack = getBlock(blockId);
    if (rack?.spec?.integrated) {
      const gpuIds = blocksForLayer("gpu").map((b) => b.id);
      const gpuId = pickGpuForRack(blockId, gpuIds);
      if (gpuId) slots.gpuMix = [{ id: gpuId, pct: 100 }];
    }
    return;
  }
  if (layer === "server") {
    const server = getBlock(blockId);
    const mix = normalizeGpuMix(slots.gpuMix);
    const bad = mix.find((m) => !gpuServerCompatible(getBlock(m.id), server));
    if (bad) {
      const gpuIds = blocksForLayer("gpu").map((b) => b.id);
      const next = gpuIds.find((id) => gpuServerCompatible(getBlock(id), server));
      if (next) slots.gpuMix = [{ id: next, pct: 100 }];
    }
  }
}

function reconcileGpuMixServer() {
  const server = getBlock(slots.server);
  const mix = normalizeGpuMix(slots.gpuMix);
  for (const m of mix) {
    if (!gpuServerCompatible(getBlock(m.id), server)) {
      const serverIds = blocksForLayer("server").map((b) => b.id);
      const next = pickServerForGpu(m.id, serverIds);
      if (next) slots.server = next;
      return;
    }
  }
}

function toggleGpuChip(gpuId) {
  if (integratedRack()) {
    slots.gpuMix = [{ id: gpuId, pct: 100 }];
  } else {
    slots.gpuMix = toggleGpuInMix(slots.gpuMix, gpuId);
    reconcileGpuMixServer();
  }
  selectedBlockId = gpuId;
  clearPinnedTerm();
  emitChange();
}

function updateGpuMixPct(gpuId, pct) {
  const mix = normalizeGpuMix(slots.gpuMix).map((m) =>
    m.id === gpuId ? { ...m, pct: Math.max(1, Number(pct) || 1) } : m,
  );
  slots.gpuMix = mix;
  emitChange();
}

function removeGpuFromMix(gpuId) {
  const mix = normalizeGpuMix(slots.gpuMix).filter((m) => m.id !== gpuId);
  if (mix.length) slots.gpuMix = mix;
  else slots.gpuMix = [{ id: gpuId, pct: 100 }];
  emitChange();
}

function setSlot(layer, blockId) {
  slots[layer] = blockId;
  reconcileStackAfterSlot(layer, blockId);
  selectedBlockId = blockId;
  clearPinnedTerm();
  emitChange();
}

function toggleOptional(id) {
  if (optionalRow.has(id)) optionalRow.delete(id);
  else optionalRow.add(id);
  emitChange();
}

/** Re-draw Scale SVGs when the tab becomes visible (layout + latest Build). */
function refreshScaleView() {
  const plan = planFromSlots(slots);
  const f = analyzeFacility(plan, slots, optionalRow);
  renderScaleTab(plan, slots, optionalRow, f.stats);
}

function renderMetrics(plan) {
  const d = derivePlan(plan);
  const el = document.getElementById("build-metrics");
  if (!el) return;
  const rows = [
    ["GPUs in hall", formatNum(d.gpus)],
    ["IT load", `${formatNum(d.hallKw)} kW`],
    ["Racks", formatNum(d.racks)],
    ["Rack density", `${formatNum(d.rackKw, d.rackKw < 100 ? 1 : 0)} kW`],
    [
      "All-in power per GPU",
      `${formatNum(d.hallKw / d.gpus, 2)} kW avg`,
    ],
    ...(plan.gpuMixSegments
      ? [
          [
            "GPU mix",
            plan.gpuMixSegments
              .map((s) => `${s.name} ${formatNum(Math.round(s.pct))}%`)
              .join(" · "),
          ],
        ]
      : []),
    ["Cooling class", coolingClassLabel(plan.coolingClass)],
    [
      "Heat to reject",
      `${formatNum(d.hallKw)} kW (~${formatNum(Math.round(tons(d.hallKw)))} tons)`,
    ],
    [
      "Cooling per rack",
      plan.coolingClass === "direct_liquid" || plan.coolingClass === "air_rear_door"
        ? `~${formatNum(Math.round(lpm(d.rackKw)))} L/min liquid path`
        : `~${formatNum(round100(cfm(d.rackKw)))} CFM air`,
    ],
    [
      "Feed per rack (400 V 3φ)",
      `~${formatNum(Math.round(amps(d.rackKw)))} A`,
    ],
    ["White space", `~${formatNum(d.areaM2)} m²`],
    [
      "Grid @ PUE (IT only)",
      `${formatNum(d.siteKw / 1000, 2)} MW`,
    ],
    [
      "Utility design (site block)",
      `${formatNum(designSiteMw(plan, d), 2)} MW · ${plan.sparePct}% spare`,
    ],
    [
      "Electrical paths (site block)",
      plan.feedRedundancy === "2N"
        ? `2N · size A + B each for ${formatNum(designSiteMw(plan, d), 2)} MW`
        : `N · single path for ${formatNum(designSiteMw(plan, d), 2)} MW`,
    ],
  ];
  el.innerHTML = rows
    .map(([k, v]) => {
      const tid = metricTermId(k);
      const hint = tid
        ? `<button type="button" class="term-hint" data-term-id="${tid}" aria-label="Explain ${k}">?</button>`
        : "";
      return `<div class="metric-row"><span class="metric-k">${k}${hint}</span><span class="metric-v">${v}</span></div>`;
    })
    .join("");
}

function gpuInMix(gpuId) {
  return normalizeGpuMix(slots.gpuMix).some((m) => m.id === gpuId);
}

function blockFitsStack(b) {
  if (b.layer === "gpu") {
    const rack = getBlock(slots.rack);
    if (rack?.spec?.integrated) return integratedGpuAllowed(rack, b);
    return gpuServerCompatible(b, getBlock(slots.server));
  }
  if (b.layer === "server") {
    return normalizeGpuMix(slots.gpuMix).every((m) =>
      gpuServerCompatible(getBlock(m.id), b),
    );
  }
  return true;
}

function blockCard(b, { inSlot = false } = {}) {
  const active = b.layer === "gpu" ? gpuInMix(b.id) : slots[b.layer] === b.id;
  const sel = selectedBlockId === b.id;
  const stackLayer = b.layer === "gpu" || b.layer === "server";
  const fits = blockFitsStack(b);
  const stackClass = !inSlot && stackLayer ? (fits ? "stack-ok" : "stack-bad") : "";
  const title =
    !inSlot && stackLayer
      ? fits
        ? "Compatible with current stack"
        : "Incompatible · form factor or rack domain"
      : "";
  return `<button type="button" class="block-card ${active ? "in-build" : ""} ${sel ? "selected" : ""} ${stackClass}" data-block-id="${b.id}" data-layer="${b.layer}" draggable="true" aria-pressed="${active}" title="${title}">
    <span class="block-swatch" style="background:${b.color}"></span>
    <span class="block-name">${b.name}</span>
    <span class="block-short">${b.short}</span>
  </button>`;
}

function pickerForLayer(layer) {
  if (layer === "gpu") {
    return gpuBlocksByGroup()
      .map((g) => {
        let h = `<div class="palette-group palette-gpu"><h4>${g.label}</h4><div class="palette-cards">`;
        g.blocks.forEach((b) => {
          h += blockCard(b);
        });
        h += `</div></div>`;
        return h;
      })
      .join("");
  }
  if (layer === "server") {
    const groups = [
      { label: "8-GPU training", ids: ["srv-8gpu-air", "srv-8gpu-liquid", "srv-8gpu-oam", "srv-8gpu-pcie"] },
      { label: "Inference density", ids: ["srv-4gpu-dense", "srv-2gpu-pcie", "srv-1gpu-pcie"] },
    ];
    let h = "";
    groups.forEach((g) => {
      h += `<div class="palette-group"><h4>${g.label}</h4><div class="palette-cards">`;
      g.ids.forEach((id) => {
        const b = getBlock(id);
        if (b) h += blockCard(b);
      });
      h += `</div></div>`;
    });
    return h;
  }
  if (layer === "rack") {
    const groups = [
      { label: "Air / rear-door", ids: ["rack-4srv-rear", "rack-2srv-air", "rack-6srv-edge", "rack-1srv-hgx"] },
      { label: "Liquid", ids: ["rack-2srv-liquid", "rack-nvl72"] },
    ];
    let h = "";
    groups.forEach((g) => {
      h += `<div class="palette-group"><h4>${g.label}</h4><div class="palette-cards">`;
      g.ids.forEach((id) => {
        const b = getBlock(id);
        if (b) h += blockCard(b);
      });
      h += `</div></div>`;
    });
    return h;
  }
  let h = `<div class="palette-cards">`;
  blocksForLayer(layer).forEach((b) => {
    h += blockCard(b);
  });
  h += `</div>`;
  if (layer === "row") {
    const opt = optionalBlocksForLayer("row");
    if (opt.length) {
      h += `<div class="palette-group optional"><h4>Add-ons</h4><div class="palette-cards">`;
      opt.forEach((b) => {
        const on = optionalRow.has(b.id);
        h += `<button type="button" class="block-card addon ${on ? "in-build" : ""}" data-optional-id="${b.id}">
        <span class="block-swatch" style="background:${b.color}"></span>
        <span class="block-name">${b.name}</span>
        <span class="block-short">${b.short}</span>
      </button>`;
      });
      h += `</div></div>`;
    }
  }
  return h;
}

function isaScaleHint(layer, plan) {
  const d = derivePlan(plan);
  switch (layer) {
    case "server":
      return `${plan.gpusPerServer}× GPU`;
    case "rack":
      return plan.integrated ? `${plan.gpusPerRack} GPU` : `${plan.serversPerRack}× server`;
    case "row":
      return `${plan.racksPerRow}× rack`;
    case "hall":
      return `${plan.rows}× row · ${formatNum(d.racks)} racks`;
    case "site":
      return `${plan.sparePct}% spare · ${plan.feedRedundancy}`;
    case "gpu": {
      const n = normalizeGpuMix(slots.gpuMix).length;
      return n > 1 ? `${n} SKUs in mix` : "1 chip";
    }
    default:
      return "1 chip";
  }
}

function gpuMixSlot(plan) {
  const mix = normalizeGpuMix(slots.gpuMix);
  const lines = mix
    .map((m) => {
      const b = getBlock(m.id);
      const seg = plan.gpuMixSegments?.find((s) => s.id === m.id);
      const sub = seg
        ? `${formatNum(seg.racks)} racks · ${formatNum(seg.hallKw, 0)} kW IT`
        : b?.short ?? "";
      const pctControl =
        mix.length > 1 && !plan.integrated
          ? `<label class="gpu-mix-pct">Racks % <input type="number" min="1" max="99" step="1" data-gpu-mix-pct="${m.id}" value="${Math.round(m.pct)}" /></label>`
          : "";
      const remove =
        mix.length > 1
          ? `<button type="button" class="gpu-mix-rm" data-gpu-mix-rm="${m.id}" aria-label="Remove ${b?.name}">×</button>`
          : "";
      return `<div class="gpu-mix-line" data-block-id="${m.id}">
        <span class="block-swatch" style="background:${b?.color ?? "var(--hot)"}"></span>
        <div class="stack-slot-text">
          <span class="stack-name">${b?.name ?? m.id}</span>
          <span class="stack-short">${sub}</span>
          ${pctControl}
        </div>
        ${remove}
      </div>`;
    })
    .join("");
  return `<div class="gpu-mix-stack">${lines}</div>
    <p class="gpu-mix-hint">${plan.integrated ? "One SKU per integrated rack." : "Click cards to add/remove · % splits racks across SKUs."}</p>`;
}

function renderIsaColumns() {
  const root = document.getElementById("isa-columns");
  if (!root) return;
  const plan = planFromSlots(slots);
  const layers = visibleLayers();
  root.innerHTML = layers
    .map(
      (layer) => `<section class="isa-col" data-isa-layer="${layer}" aria-label="${layerLabels[layer]}">
      <p class="isa-scale">${isaScaleHint(layer, plan)}</p>
      <h3 class="isa-col-title">${layerLabels[layer]}</h3>
      ${layer === "gpu" ? gpuMixSlot(plan) : slotBlock(layer, plan)}
      <div class="isa-pick">${pickerForLayer(layer)}</div>
    </section>`,
    )
    .join("");

}

function slotSubline(layer, b, plan) {
  if (!plan || !b) return b?.short ?? "";
  if (layer === "server" && !plan.integrated) {
    return `${formatNum(plan.serverKw, 1)} kW · ${plan.gpusPerServer}× GPU`;
  }
  if (layer === "rack" && !plan.integrated) {
    return `${formatNum(plan.rackKw, 0)} kW · ${plan.serversPerRack} servers`;
  }
  if (layer === "rack" && plan.integrated) {
    return `${formatNum(plan.rackKw, 0)} kW · ${plan.gpusPerRack} GPU`;
  }
  if (layer === "gpu") {
    return `${b.short} · ${formatNum(plan.gpuKw, 2)} kW chip`;
  }
  return b.short;
}

function slotBlock(layer, plan) {
  const id = slots[layer];
  const b = getBlock(id);
  if (!b) {
    return `<div class="stack-slot empty" data-drop-layer="${layer}"><span>Pick a ${layerLabels[layer]}</span></div>`;
  }
  return `<div class="stack-slot filled" data-drop-layer="${layer}" data-block-id="${b.id}">
    <span class="block-swatch" style="background:${b.color}"></span>
    <div class="stack-slot-text">
      <span class="stack-layer">${layerLabels[layer]}</span>
      <span class="stack-name">${b.name}</span>
      <span class="stack-short">${slotSubline(layer, b, plan)}</span>
    </div>
  </div>`;
}

function wireDragDrop() {
  const root = document.getElementById("view-build");
  if (!root || root.dataset.wired) return;
  root.dataset.wired = "1";

  root.addEventListener("click", (e) => {
    const opt = e.target.closest("[data-optional-id]");
    if (opt) {
      toggleOptional(opt.dataset.optionalId);
      return;
    }
    const card = e.target.closest("[data-block-id].block-card");
    if (card) {
      if (card.dataset.layer === "gpu") {
        toggleGpuChip(card.dataset.blockId);
        return;
      }
      setSlot(card.dataset.layer, card.dataset.blockId);
      return;
    }
    const rm = e.target.closest("[data-gpu-mix-rm]");
    if (rm) {
      removeGpuFromMix(rm.dataset.gpuMixRm);
      return;
    }
    const mixLine = e.target.closest(".gpu-mix-line[data-block-id]");
    if (mixLine && !e.target.closest("input")) {
      selectedBlockId = mixLine.dataset.blockId;
      clearPinnedTerm();
      renderContextPanel(selectedBlockId);
      renderIsaColumns();
      return;
    }
    const slot = e.target.closest(".stack-slot[data-block-id]");
    if (slot) {
      selectedBlockId = slot.dataset.blockId;
      clearPinnedTerm();
      renderIsaColumns();
      renderContextPanel(selectedBlockId);
    }
  });

  root.addEventListener("dragstart", (e) => {
    const card = e.target.closest("[data-block-id].block-card");
    if (!card) return;
    e.dataTransfer.setData("text/plain", card.dataset.blockId);
    e.dataTransfer.effectAllowed = "copy";
  });

  root.addEventListener("dragover", (e) => {
    const slot = e.target.closest("[data-drop-layer]");
    if (!slot) return;
    e.preventDefault();
    slot.classList.add("drag-over");
  });

  root.addEventListener("dragleave", (e) => {
    const slot = e.target.closest("[data-drop-layer]");
    if (slot) slot.classList.remove("drag-over");
  });

  root.addEventListener("input", (e) => {
    const inp = e.target.closest("[data-gpu-mix-pct]");
    if (inp) updateGpuMixPct(inp.dataset.gpuMixPct, inp.value);
  });

  root.addEventListener("drop", (e) => {
    const slot = e.target.closest("[data-drop-layer]");
    if (!slot) return;
    e.preventDefault();
    slot.classList.remove("drag-over");
    const id = e.dataTransfer.getData("text/plain");
    const block = getBlock(id);
    if (block && block.layer === slot.dataset.dropLayer) {
      setSlot(block.layer, id);
    }
  });

}

function wireCopyBrief() {
  document.getElementById("copy-brief")?.addEventListener("click", async () => {
    const text = document.getElementById("facility-brief")?.textContent;
    if (!text) return;
    const btn = document.getElementById("copy-brief");
    try {
      await navigator.clipboard.writeText(text);
      if (btn) {
        const prev = btn.textContent;
        btn.textContent = "Copied";
        setTimeout(() => {
          btn.textContent = prev;
        }, 1600);
      }
    } catch {
      /* clipboard unavailable */
    }
  });
}

function wireAppGoto() {
  document.body.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-app-goto]");
    const view = btn?.dataset.appGoto;
    if (view) setView(view);
  });
}

export function initBuilder() {
  initAppShell();
  wireAppGoto();
  wireContextPanel(() => selectedBlockId);
  wireCopyBrief();
  document.addEventListener("program-focus-layer", (e) => {
    const layer = e.detail?.layer;
    if (layer) focusLayer(layer);
  });
  document.addEventListener("app-view-change", (e) => {
    clearPinnedTerm();
    renderContextPanel(selectedBlockId);
    const view = e.detail?.view;
    if (view === "scale") refreshScaleView();
    if (view === "operate") renderOperateTab(planFromSlots(slots), slots, optionalRow);
    else stopOperateSimulator();
  });
  wireDragDrop();
  selectedBlockId = primaryGpuId(slots);
  emitChange();
}
