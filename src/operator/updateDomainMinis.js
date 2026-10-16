import { formatNum } from "../calc.js";
import { DOMAIN_MINIS, MINI_H, MINI_W } from "./domainMiniCharts.js";
import { TOOLS_CHANNELS } from "./toolsMiniCharts.js";
import { LAYER_WATCH_MINIS } from "./layerWatchTable.js";
import { sparkCandles, sparkLine, sparkLineTight, sparkStep } from "./sparkShapes.js";

const MINI_HISTORY = 36;

export function miniHistKeys() {
  const keys = [];
  for (const [domain, specs] of Object.entries(DOMAIN_MINIS)) {
    for (const [id] of specs) keys.push(`${domain}-${id}`);
  }
  for (const ch of TOOLS_CHANNELS) {
    for (const [id] of ch.minis) keys.push(`tools-${ch.id}-${id}`);
  }
  for (const [layer, specs] of Object.entries(LAYER_WATCH_MINIS)) {
    for (const [id] of specs) keys.push(`layer-${layer}-${id}`);
  }
  return keys;
}

export function createMiniHistStore() {
  const store = {};
  for (const k of miniHistKeys()) store[k] = [];
  return store;
}

export function pushMiniHist(store, key, norm) {
  if (!store[key]) store[key] = [];
  store[key].push(norm);
  if (store[key].length > MINI_HISTORY) store[key].shift();
}

const DISPLAY = {
  "elec-ups": (v) => `${Math.round(v * 100)}`,
  "elec-phase": (v) => `${Math.round(v * 100)}`,
  "mech-chwSup": (v) => `${formatNum(6.5 + v * 2.2, 1)}`,
  "mech-pump": (v) => `${Math.round(v * 100)}`,
  "mech-chiller": (v) => `${Math.round(v * 100)}`,
  "it-gpu": (v) => `${Math.round(v * 100)}`,
  "it-inlet": (v) => `${Math.round(18 + v * 14)}`,
  "it-optics": (v) => `${Math.round(v * 120)}`,
  "fac-water": (v) => `${formatNum(0.6 + v * 1.4, 2)}`,
  "fac-rh": (v) => `${Math.round(42 + v * 22)}`,
  "wl-ttft": (v) => `${Math.round(80 + v * 420)}`,
  "wl-queue": (v) => `${Math.round(v * 2400)}`,
  "wl-err": (v) => `${(v * 4.5).toFixed(2)}`,
  "tools-epms-facKw": (v) => `${formatNum(v * 11.5, 2)}`,
  "tools-epms-alms": (v) => `${Math.round(v * 28)}`,
  "tools-snmp-reach": (v) => `${formatNum(v * 100, 2)}`,
  "tools-snmp-ifIn": (v) => `${Math.round(v * 95)}`,
  "tools-cmms-open": (v) => `${Math.round(2 + v * 34)}`,
  "tools-cmms-backlog": (v) => `${Math.round(3 + v * 18)}`,
  "tools-noc-sev": (v) => `${Math.round(v * 12)}`,
  "tools-noc-pages": (v) => `${Math.round(v * 6)}`,
  "tools-test-gen": (v) => (v > 0.35 ? "RUN" : "idle"),
  "tools-test-upsBat": (v) => `${Math.round(v * 100)}`,
  "layer-gpu-pwr": (v) => `${Math.round(350 + v * 380)}`,
  "layer-gpu-therm": (v) => `${Math.round(62 + v * 18)}`,
  "layer-server-inlet": (v) => `${Math.round(18 + v * 12)}`,
  "layer-server-fan": (v) => `${Math.round(40 + v * 50)}`,
  "layer-rack-kw": (v) => `${Math.round(8 + v * 115)}`,
  "layer-rack-flow": (v) => `${Math.round(20 + v * 180)}`,
  "layer-row-amps": (v) => `${Math.round(200 + v * 420)}`,
  "layer-row-contain": (v) => `${formatNum(8 + v * 6, 1)}`,
  "layer-hall-it": (v) => `${Math.round(200 + v * 2800)}`,
  "layer-hall-loop": (v) => `${Math.round(800 + v * 4200)}`,
  "layer-site-pue": (v) => `${formatNum(1.08 + v * 0.28, 2)}`,
  "layer-site-mw": (v) => `${formatNum(2 + v * 14, 2)}`,
};

const SHAPE = {
  jitter: (hist) => sparkLine(hist, MINI_W, MINI_H),
  thermal: (hist) => sparkLine(hist, MINI_W, MINI_H),
  step: (hist) => sparkStep(hist, MINI_W, MINI_H),
  flat: (hist) => sparkLineTight(hist, MINI_W, MINI_H),
  candles: (hist) => sparkCandles(hist, MINI_W, MINI_H),
};

function shapeForKey(key) {
  for (const [, specs] of Object.entries(DOMAIN_MINIS)) {
    for (const [id, , , shape] of specs) {
      if (key.endsWith(`-${id}`)) return shape;
    }
  }
  for (const ch of TOOLS_CHANNELS) {
    for (const [id, , , shape] of ch.minis) {
      if (key === `tools-${ch.id}-${id}`) return shape;
    }
  }
  for (const [layer, specs] of Object.entries(LAYER_WATCH_MINIS)) {
    for (const [id, , , shape] of specs) {
      if (key === `layer-${layer}-${id}`) return shape;
    }
  }
  return "jitter";
}

function updateMiniPanelsInRoot(root, histStore, signalMap) {
  if (!root) return;
  for (const [key, norm] of Object.entries(signalMap)) {
    const valEl = root.querySelector(`[data-mini-val="${key}"]`);
    if (valEl && DISPLAY[key]) {
      const unitEl = valEl.querySelector(".operate-dash-unit");
      const unit = unitEl?.textContent ?? "";
      valEl.innerHTML = `${DISPLAY[key](norm)}${unit ? ` <span class="operate-dash-unit">${unit}</span>` : ""}`;
    }
    const hist = histStore[key];
    if (!hist?.length) continue;
    const shape = shapeForKey(key);
    if (shape === "candles") {
      const g = root.querySelector(`[data-mini-candles="${key}"]`);
      if (g) g.innerHTML = SHAPE.candles(hist);
    } else if (shape === "step") {
      const path = root.querySelector(`[data-mini-path="${key}"]`);
      if (path) path.setAttribute("d", SHAPE.step(hist));
    } else {
      const line = root.querySelector(`[data-mini-line="${key}"]`);
      if (line) line.setAttribute("points", SHAPE[shape](hist));
    }
  }
}

export function updateDomainMinis(domainsRoot, toolsRoot, layerRoot, histStore, signalMap) {
  updateMiniPanelsInRoot(domainsRoot, histStore, signalMap);
  updateMiniPanelsInRoot(toolsRoot, histStore, signalMap);
  updateMiniPanelsInRoot(layerRoot, histStore, signalMap);
}

export function signalMapFromSample(s) {
  return {
    "elec-ups": s.upsNorm,
    "elec-phase": s.phaseNorm,
    "mech-chwSup": s.chwSupNorm,
    "mech-pump": s.pumpNorm,
    "mech-chiller": s.chillerNorm,
    "it-gpu": s.gpuNorm,
    "it-inlet": s.inletNorm,
    "it-optics": s.opticsNorm,
    "fac-water": s.waterNorm,
    "fac-rh": s.rhNorm,
    "wl-ttft": s.ttftNorm,
    "wl-queue": s.queueNorm,
    "wl-err": s.errNorm,
    "tools-epms-facKw": s.facKwNorm,
    "tools-epms-alms": s.epmsAlmNorm,
    "tools-snmp-reach": s.reachNorm,
    "tools-snmp-ifIn": s.opticsNorm,
    "tools-cmms-open": s.cmmsOpenNorm,
    "tools-cmms-backlog": s.backlogNorm,
    "tools-noc-sev": s.nocSevNorm,
    "tools-noc-pages": s.nocPagesNorm,
    "tools-test-gen": s.genTestNorm,
    "tools-test-upsBat": s.upsBatNorm,
    "layer-gpu-pwr": s.gpuNorm,
    "layer-gpu-therm": s.inletNorm,
    "layer-server-inlet": s.inletNorm,
    "layer-server-fan": s.fanNorm,
    "layer-rack-kw": s.itNorm,
    "layer-rack-flow": s.pumpNorm,
    "layer-row-amps": s.upsNorm,
    "layer-row-contain": s.dtwNorm,
    "layer-hall-it": s.itNorm,
    "layer-hall-loop": s.waterNorm,
    "layer-site-pue": s.pueNorm,
    "layer-site-mw": s.facKwNorm,
  };
}
