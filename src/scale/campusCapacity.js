import { derivePlan, formatNum, tons } from "../calc.js";
import { designSiteMw } from "../build/program.js";
import { campusHallSlices } from "../hall/hallFootprint.js";
import { deriveFabric } from "./fabric.js";
import { drawScaleCampusDiagrams } from "./scaleComposition.js";

function buildCampusRedrawOverlay(plan, slots, optionalIds, stats) {
  const d = derivePlan(plan);
  return {
    fabric: deriveFabric(plan, slots, optionalIds),
    optionalIds,
    designSiteMw: designSiteMw(plan, d),
    hallLoopLpm: stats?.hallLoopLpm ?? Math.round((plan.hallKw * 60) / (4.186 * 10)),
    heatTons: stats?.heatTons ?? Math.round(tons(plan.hallKw)),
    ...campusScaleFromPlan(plan),
  };
}

const STORAGE_KEY = "scale-campus-it-mw";
export const CAMPUS_MW_MIN = 10;
export const CAMPUS_MW_MAX = 150;
export const CAMPUS_MW_STEP = 5;
export const CAMPUS_MW_DEFAULT = 30;

let campusItMw = readStoredCampusMw();
let campusCapacityCtx = null;

function readStoredCampusMw() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const n = Number(raw);
    if (Number.isFinite(n) && n >= CAMPUS_MW_MIN && n <= CAMPUS_MW_MAX) return n;
  } catch {
    /* ignore */
  }
  return CAMPUS_MW_DEFAULT;
}

export function getCampusItMw() {
  return campusItMw;
}

export function setCampusItMw(mw) {
  const n = Math.min(CAMPUS_MW_MAX, Math.max(CAMPUS_MW_MIN, Math.round(mw / CAMPUS_MW_STEP) * CAMPUS_MW_STEP));
  campusItMw = n;
  try {
    sessionStorage.setItem(STORAGE_KEY, String(n));
  } catch {
    /* ignore */
  }
  return n;
}

/** Overlay fields for campus / site diagrams (hall module = Build IT load). */
export function campusScaleFromPlan(plan) {
  const hallItMw = Math.max(0.01, (plan.hallKw ?? 0) / 1000);
  return {
    campusItMw: getCampusItMw(),
    hallItMw,
  };
}

function applyCampusMw(mw) {
  const ctx = campusCapacityCtx;
  if (!ctx) return;
  setCampusItMw(mw);
  syncCampusCapacityUi(ctx.plan, ctx.slots);
  const overlay = buildCampusRedrawOverlay(ctx.plan, ctx.slots, ctx.optionalIds, ctx.stats);
  drawScaleCampusDiagrams(ctx.plan, ctx.slots, overlay);
}

export function syncCampusCapacityUi(plan, slots) {
  const scale = campusScaleFromPlan(plan);
  const slider = document.getElementById("scale-campus-mw");
  const out = document.getElementById("scale-campus-mw-out");
  const readout = document.getElementById("scale-campus-halls-readout");
  if (slider) {
    slider.min = String(CAMPUS_MW_MIN);
    slider.max = String(CAMPUS_MW_MAX);
    slider.step = String(CAMPUS_MW_STEP);
    slider.value = String(scale.campusItMw);
  }
  if (out) out.textContent = `${formatNum(scale.campusItMw)} MW IT`;
  document.querySelectorAll("[data-campus-mw-preset]").forEach((btn) => {
    const v = Number(btn.dataset.campusMwPreset);
    btn.classList.toggle("active", v === scale.campusItMw);
    btn.setAttribute("aria-pressed", v === scale.campusItMw ? "true" : "false");
  });
  if (readout) {
    const { hallCount } = campusHallSlices(plan, slots, scale);
    readout.textContent = `→ ${formatNum(hallCount)} halls @ ${formatNum(scale.hallItMw, 1)} MW IT each`;
  }
}

export function bindCampusCapacity(plan, slots, optionalIds, stats) {
  campusCapacityCtx = { plan, slots, optionalIds, stats };
  syncCampusCapacityUi(plan, slots);

  const bar = document.getElementById("scale-campus-capacity-bar");
  if (!bar || bar.dataset.bound) return;
  bar.dataset.bound = "1";

  bar.addEventListener("input", (e) => {
    if (e.target.id === "scale-campus-mw") applyCampusMw(Number(e.target.value));
  });
  bar.addEventListener("change", (e) => {
    if (e.target.id === "scale-campus-mw") applyCampusMw(Number(e.target.value));
  });
  bar.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-campus-mw-preset]");
    if (!btn) return;
    e.preventDefault();
    applyCampusMw(Number(btn.dataset.campusMwPreset));
  });
}
