import { primaryGpu } from "../build/gpuMix.js";
import { coolingClassLabel } from "../build/plan.js";
import { amps, formatNum, lpm } from "../calc.js";
import {
  activeStressHints,
  illustrativeEffectiveGbps,
  illustrativeEffectiveKw,
  ILLUS_COOL_THROTTLE,
  ILLUS_NET_FABRIC,
  ILLUS_SPACE_AIRFLOW,
  coolingPlantActive,
  kwStressActive,
  layerStressActive,
} from "./layerStress.js";

let ctx = null;
let selectedRackIdx = null;
const layerOn = { space: true, power: true, cool: true, net: false };
let hallZoom = 1;
let viewBoxW = 880;

function updateRackStressLabels() {
  const svg = document.getElementById("svg-scale-hall");
  if (!svg || !ctx) return;
  const { plan, fabric } = ctx;
  const effKw = illustrativeEffectiveKw(plan.rackKw, layerOn);
  const effG = illustrativeEffectiveGbps(fabric?.gbpsPerRack ?? 0, layerOn);
  const kwStress = kwStressActive(layerOn);
  const netStress = !layerOn.net;

  svg.dataset.rackStressKw = kwStress ? "1" : "0";
  svg.dataset.stressSpace = layerOn.space ? "0" : "1";
  svg.dataset.stressPower = layerOn.power ? "0" : "1";
  svg.dataset.stressCool = coolingPlantActive(layerOn) ? "0" : "1";
  svg.dataset.plantPowered = layerOn.power ? "1" : "0";
  svg.dataset.stressNet = netStress ? "1" : "0";
  svg.dataset.rackStress = layerStressActive(layerOn) ? "1" : "0";

  const effKwText = `${formatNum(effKw, 0)}k`;
  const effGText = `${formatNum(effG, 0)}G`;
  document.querySelectorAll("#svg-scale-hall .iso-rack-throttle").forEach((el) => {
    el.textContent = effKwText;
  });
  document.querySelectorAll("#svg-scale-hall .iso-rack-net-stress").forEach((el) => {
    el.textContent = effGText;
  });
}

function renderStressHints() {
  const panel = document.getElementById("scale-layer-stress-panel");
  const list = document.getElementById("scale-layer-stress-list");
  if (!panel || !list) return;
  const hints = activeStressHints(layerOn);
  if (!hints.length) {
    panel.hidden = true;
    list.innerHTML = "";
    return;
  }
  panel.hidden = false;
  list.innerHTML = hints
    .map(
      ({ id, text }) =>
        `<li class="scale-layer-stress-item scale-layer-stress-item--${id}">${text}</li>`,
    )
    .join("");
}

function applyLayerState() {
  const visual = document.getElementById("scale-hall-figure");
  if (!visual) return;
  visual.dataset.layerSpace = layerOn.space ? "1" : "0";
  visual.dataset.layerPower = layerOn.power ? "1" : "0";
  visual.dataset.layerCool = layerOn.cool ? "1" : "0";
  visual.dataset.layerNet = layerOn.net ? "1" : "0";
  visual.dataset.layerImpact = layerStressActive(layerOn) ? "1" : "0";

  updateRackStressLabels();
  renderStressHints();

  document.querySelectorAll(".scale-layer-btn[data-scale-layer]").forEach((btn) => {
    const id = btn.dataset.scaleLayer;
    if (id === "all") return;
    btn.classList.toggle("active", layerOn[id]);
    btn.setAttribute("aria-pressed", layerOn[id] ? "true" : "false");
  });
  if (selectedRackIdx != null && ctx) renderRackDetail(selectedRackIdx);
}

function readViewBoxWidth() {
  const svg = document.getElementById("svg-scale-hall");
  if (!svg) return 880;
  const vb = svg.viewBox?.baseVal;
  if (vb?.width > 0) return vb.width;
  const parts = (svg.getAttribute("viewBox") || "0 0 880 600").split(/\s+/);
  return Number(parts[2]) || 880;
}

export function applyScaleHallZoom(mode) {
  const svg = document.getElementById("svg-scale-hall");
  const scroller = document.getElementById("scale-svg-scroller");
  if (!svg || !scroller) return;

  viewBoxW = readViewBoxWidth();

  if (mode === "in") hallZoom = Math.min(3, hallZoom + 0.2);
  else if (mode === "out") hallZoom = Math.max(0.85, hallZoom - 0.2);
  else if (mode === "default") {
    const pad = 48;
    const avail = Math.max(320, scroller.clientWidth - pad);
    hallZoom = Math.max(0.88, Math.min(2.4, (avail / viewBoxW) * 0.8));
  } else if (mode === "fit") {
    const pad = 32;
    const avail = Math.max(320, scroller.clientWidth - pad);
    hallZoom = Math.max(1.2, Math.min(3, (avail / viewBoxW) * 1.06));
  }

  const pxW = Math.round(viewBoxW * hallZoom);
  svg.style.width = `${pxW}px`;
  svg.style.height = "auto";
  svg.style.minWidth = `${pxW}px`;
}

export function syncScaleHallZoomAfterDraw() {
  viewBoxW = readViewBoxWidth();
  applyScaleHallZoom("default");
}

function initScaleViewZoomSync() {
  if (document.documentElement.dataset.scaleHallZoomSync) return;
  document.documentElement.dataset.scaleHallZoomSync = "1";
  document.addEventListener("app-view-change", (e) => {
    if (e.detail?.view !== "scale") return;
    requestAnimationFrame(() => syncScaleHallZoomAfterDraw());
  });
}

function rackSegmentName(plan, idx) {
  const segs = plan.gpuMixSegments;
  if (!segs?.length) return primaryGpu(ctx.slots)?.name ?? "GPU";
  let cum = 0;
  for (const s of segs) {
    cum += s.racks;
    if (idx < cum) return s.name;
  }
  return segs[segs.length - 1]?.name ?? "-";
}

function coolingDetailValue(plan) {
  const base =
    plan.coolingClass === "air"
      ? coolingClassLabel(plan.coolingClass)
      : `~${formatNum(Math.round(lpm(plan.rackKw)))} L/min · ${coolingClassLabel(plan.coolingClass)}`;
  if (!layerOn.power) return `${base} · plant offline (no power)`;
  if (!layerOn.cool) return `${base} · rejection path hidden (layer off)`;
  return base;
}

function rackStressDetailLines(plan, fabric) {
  const lines = [];
  const effKw = illustrativeEffectiveKw(plan.rackKw, layerOn);
  if (kwStressActive(layerOn)) {
    const parts = [];
    if (!layerOn.power) parts.push("unpowered · plant offline");
    else {
      if (!layerOn.cool) parts.push(`~${Math.round(ILLUS_COOL_THROTTLE * 100)}% thermal · no rejection path`);
      if (!layerOn.space) parts.push(`~${Math.round(ILLUS_SPACE_AIRFLOW * 100)}% airflow`);
    }
    lines.push(["Effective IT (stress)", `~${formatNum(effKw, 0)} kW · ${parts.join(" · ")}`]);
  }
  if (!layerOn.net) {
    const effG = illustrativeEffectiveGbps(fabric?.gbpsPerRack ?? 0, layerOn);
    lines.push([
      "Collective fabric (stress)",
      `~${formatNum(effG, 0)} Gbps/rack · ~${Math.round(ILLUS_NET_FABRIC * 100)}% · job stretch`,
    ]);
  }
  return lines;
}

function renderRackDetail(idx) {
  const popover = document.getElementById("scale-rack-popover");
  const panel = document.getElementById("scale-rack-detail");
  if (!popover || !panel || !ctx) return;
  const { plan, fabric } = ctx;
  if (idx < 0 || idx >= plan.racks) return;

  selectedRackIdx = idx;
  const row = Math.floor(idx / plan.racksPerRow) + 1;
  const col = (idx % plan.racksPerRow) + 1;

  document.querySelectorAll("#svg-scale-hall .rack-pickable").forEach((el) => {
    el.classList.toggle("rack-selected", Number(el.dataset.rackIdx) === idx);
  });

  popover.hidden = false;

  const lines = [
    ["IT load", `${formatNum(plan.rackKw, 0)} kW`],
    ...rackStressDetailLines(plan, fabric),
    ["Power feed", `~${formatNum(Math.round(amps(plan.rackKw)))} A @ 400 V 3φ`],
    ["Cooling", coolingDetailValue(plan)],
    [
      "Fabric",
      `${formatNum(fabric.downlinksPerRack)} down · ~${formatNum(fabric.gbpsPerRack)} Gbps · ${fabric.portSpeedGbps}G`,
    ],
    ["GPU mix", rackSegmentName(plan, idx)],
  ];

  if (plan.integrated) {
    lines.push(["Compute", `${plan.gpusPerRack} GPU in integrated domain`]);
  } else {
    lines.push([
      "Servers",
      `${plan.serversPerRack}× · ${plan.gpusPerServer} GPU/srv · ${formatNum(plan.serverKw, 1)} kW/srv`,
    ]);
  }

  panel.innerHTML = `
    <div class="scale-rack-detail-head">
      <div class="scale-rack-detail-id">
        <p class="scale-rack-detail-eyebrow">Rack ${idx + 1}</p>
        <p class="scale-rack-detail-sub">Row ${row} · bay ${col}</p>
      </div>
      <button type="button" class="scale-rack-close" aria-label="Close rack detail">×</button>
    </div>
    <dl class="scale-rack-dl">${lines
      .map(([k, v]) => `<div class="scale-rack-dl-row"><dt>${k}</dt><dd>${v}</dd></div>`)
      .join("")}</dl>`;
}

function clearRackDetail() {
  selectedRackIdx = null;
  document.querySelectorAll("#svg-scale-hall .rack-pickable").forEach((el) => el.classList.remove("rack-selected"));
  const popover = document.getElementById("scale-rack-popover");
  const panel = document.getElementById("scale-rack-detail");
  if (popover) popover.hidden = true;
  if (panel) panel.innerHTML = "";
}

function onStageClick(e) {
  if (e.target.closest(".scale-rack-close")) {
    clearRackDetail();
    return;
  }

  const zoomBtn = e.target.closest("[data-scale-zoom]");
  if (zoomBtn) {
    applyScaleHallZoom(zoomBtn.dataset.scaleZoom);
    return;
  }

  const layerBtn = e.target.closest(".scale-layer-btn");
  if (layerBtn) {
    const id = layerBtn.dataset.scaleLayer;
    if (id === "all") {
      layerOn.space = layerOn.power = layerOn.cool = layerOn.net = true;
    } else {
      layerOn[id] = !layerOn[id];
    }
    applyLayerState();
    return;
  }

  const rack = e.target.closest(".rack-pickable");
  if (rack) {
    renderRackDetail(Number(rack.dataset.rackIdx));
  }
}

function onStageKeydown(e) {
  if (e.key === "Escape") clearRackDetail();
}

export function bindScaleHallInteraction(plan, slots, optionalIds, fabric) {
  initScaleViewZoomSync();
  ctx = { plan, slots, optionalIds, fabric };
  const stage = document.getElementById("scale-stage");
  if (stage && !stage.dataset.bound) {
    stage.dataset.bound = "1";
    stage.addEventListener("click", onStageClick);
    stage.addEventListener("keydown", onStageKeydown);
  }
  applyLayerState();
  syncScaleHallZoomAfterDraw();
  if (selectedRackIdx != null && selectedRackIdx < plan.racks) {
    renderRackDetail(selectedRackIdx);
  } else if (selectedRackIdx != null) {
    clearRackDetail();
  }
}
