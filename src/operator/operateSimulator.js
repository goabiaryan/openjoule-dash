import { designSiteMw } from "../build/program.js";
import { derivePlan, formatNum, formulas } from "../calc.js";
import { createSignalState, sampleSignals } from "./operateSignals.js";
import {
  sparkCandles,
  sparkLine,
  sparkLineTight,
  sparkStep,
  trafficAreaStep,
} from "./sparkShapes.js";
import {
  createMiniHistStore,
  pushMiniHist,
  signalMapFromSample,
  updateDomainMinis,
} from "./updateDomainMinis.js";

const W = 280;
const H = 56;
const HISTORY = 52;

function seedFromPlan(plan) {
  let h = 2166136261;
  const s = `${plan.hallKw}|${plan.racks}|${plan.rows}|${plan.feedRedundancy}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

let activeSim = null;

export function stopOperateSimulator() {
  if (activeSim?.timer) clearInterval(activeSim.timer);
  activeSim = null;
}

export function mountOperateSimulator(plan, root) {
  stopOperateSimulator();

  const d = derivePlan(plan);
  const siteMw = designSiteMw(plan, d);
  const peakRps = Math.round(600 + d.gpus * 14);
  const dual = plan.feedRedundancy === "2N";

  root.innerHTML = `
    <p class="operate-dash-disclaimer">Each panel uses a different signal shape (EPMS jitter, thermal lag, Locust steps, flat PUE, ECN spikes) - not one shared curve.</p>
    <div class="operate-sim-toolbar" role="toolbar" aria-label="Load test controls">
      <button type="button" class="operate-sim-btn operate-sim-play" aria-pressed="true">Pause</button>
      <button type="button" class="operate-sim-btn operate-sim-burst">Burst</button>
      <label class="operate-sim-slider-wrap">
        <span class="operate-sim-slider-label">Load test</span>
        <input type="range" class="operate-sim-slider" min="0" max="100" value="38" aria-valuetext="38 percent"/>
        <span class="operate-sim-slider-pct">38%</span>
      </label>
      <div class="operate-sim-presets" role="group" aria-label="Presets">
        <button type="button" class="operate-sim-preset" data-load="12">Idle</button>
        <button type="button" class="operate-sim-preset" data-load="45">Steady</button>
        <button type="button" class="operate-sim-preset" data-load="88">Spike</button>
      </div>
    </div>
    <div class="operate-dash-grid operate-dash-grid-live" data-playing="true">
      <article class="operate-dash-card operate-dash-power">
        <h4 class="operate-dash-title">Hall IT load</h4>
        <p class="operate-dash-metric" data-m="it-kw">- <span class="operate-dash-unit">kW</span></p>
        <p class="operate-dash-sub">Design ${formatNum(d.hallKw, 0)} kW · ${formatNum(siteMw, 2)} MW utility</p>
        <svg class="operate-dash-svg operate-spark-live operate-spark-jitter" viewBox="0 0 ${W} ${H}" width="100%" height="${H}" aria-hidden="true">
          <polyline class="operate-spark-line" data-spark="it" fill="none"/>
        </svg>
      </article>

      <article class="operate-dash-card operate-dash-feeds">
        <h4 class="operate-dash-title">Feed balance</h4>
        <div class="operate-bar-row">
          <span class="operate-bar-label">A feed</span>
          <div class="operate-bar-track"><div class="operate-bar-fill operate-bar-a" data-bar="feed-a"></div></div>
          <span class="operate-bar-val" data-val="feed-a">-</span>
        </div>
        ${
          dual
            ? `<div class="operate-bar-row">
          <span class="operate-bar-label">B feed</span>
          <div class="operate-bar-track"><div class="operate-bar-fill operate-bar-b" data-bar="feed-b"></div></div>
          <span class="operate-bar-val" data-val="feed-b">-</span>
        </div>`
            : `<p class="operate-dash-sub">${plan.feedRedundancy} feed · single path</p>`
        }
      </article>

      <article class="operate-dash-card operate-dash-cool">
        <h4 class="operate-dash-title">CHW ΔT</h4>
        <p class="operate-dash-metric" data-m="dtw">- <span class="operate-dash-unit">K</span></p>
        <p class="operate-dash-sub">Model ${formulas.dTw} K · sags under burst heat</p>
        <svg class="operate-dash-svg operate-spark-live operate-spark-thermal" viewBox="0 0 ${W} ${H}" width="100%" height="${H}" aria-hidden="true">
          <polyline class="operate-spark-line" data-spark="dtw" fill="none"/>
        </svg>
      </article>

      <article class="operate-dash-card operate-dash-traffic operate-dash-hero">
        <h4 class="operate-dash-title">Inference RPS <span class="operate-dash-tag">Locust-style</span></h4>
        <p class="operate-dash-metric" data-m="rps">- <span class="operate-dash-unit">req/s</span></p>
        <p class="operate-dash-sub">Peak ~${formatNum(peakRps)} · ${formatNum(d.gpus)} GPUs</p>
        <svg class="operate-dash-svg operate-traffic-live" viewBox="0 0 ${W} ${H}" width="100%" height="${H}" aria-hidden="true">
          <path class="operate-traffic-fill" data-area="traffic"/>
          <path class="operate-spark-step" data-spark="traffic" fill="none"/>
        </svg>
      </article>

      <article class="operate-dash-card operate-dash-pue">
        <h4 class="operate-dash-title">Facility PUE</h4>
        <p class="operate-dash-metric" data-m="pue">-</p>
        <p class="operate-dash-sub">Target ${formatNum(plan.pue, 2)}</p>
        <svg class="operate-dash-svg operate-spark-live operate-spark-flat" viewBox="0 0 ${W} ${H}" width="100%" height="${H}" aria-hidden="true">
          <polyline class="operate-spark-line" data-spark="pue" fill="none"/>
        </svg>
      </article>

      <article class="operate-dash-card operate-dash-fabric">
        <h4 class="operate-dash-title">Fabric stress</h4>
        <p class="operate-dash-metric" data-m="ecn">- <span class="operate-dash-unit">ECN / min</span></p>
        <p class="operate-dash-sub">Rises when RPS outruns buffers</p>
        <svg class="operate-dash-svg operate-spark-live operate-spark-candles" viewBox="0 0 ${W} ${H}" width="100%" height="${H}" aria-hidden="true">
          <line class="operate-ecn-base" x1="2" y1="${H - 3}" x2="${W - 2}" y2="${H - 3}"/>
          <g data-spark="ecn-bars"></g>
        </svg>
      </article>
    </div>`;

  const grid = root.querySelector(".operate-dash-grid-live");
  const domainsRoot = document.getElementById("operate-domains");
  const toolsRoot = document.getElementById("operate-tools");
  const layerRoot = document.getElementById("op-body");
  const playBtn = root.querySelector(".operate-sim-play");
  const burstBtn = root.querySelector(".operate-sim-burst");
  const slider = root.querySelector(".operate-sim-slider");
  const sliderPct = root.querySelector(".operate-sim-slider-pct");

  const state = {
    plan,
    d,
    peakRps,
    dual,
    playing: true,
    load: 0.38,
    burst: 0,
    tick: 0,
    sig: createSignalState(seedFromPlan(plan) ^ 0x51ea11),
    hist: {
      traffic: [],
      it: [],
      dtw: [],
      pue: [],
      ecn: [],
    },
    histMinis: createMiniHistStore(),
    timer: null,
  };

  const q = (sel) => root.querySelector(sel);

  function pushHist(key, norm) {
    const arr = state.hist[key];
    arr.push(norm);
    if (arr.length > HISTORY) arr.shift();
  }

  function sample() {
    state.tick += 1;
    state.burst *= 0.88;
    const load = Math.min(1, Math.max(0, state.load + state.burst * 0.35));
    const pueTarget = plan.pue * (1 + load * 0.035 + state.burst * 0.02);
    const signals = sampleSignals(state.sig, {
      load,
      burst: state.burst,
      tick: state.tick,
      pueTarget: pueTarget / (plan.pue * 1.12),
    });
    const { rpsNorm, itNorm, dtwNorm, pueNorm, ecnNorm } = signals;
    const miniMap = signalMapFromSample(signals);
    for (const [k, v] of Object.entries(miniMap)) pushMiniHist(state.histMinis, k, v);

    const itKw = d.hallKw * itNorm;
    const dTw = formulas.dTw * dtwNorm;
    const pue = pueNorm * plan.pue * 1.12;
    const ecn = Math.round(ecnNorm * (12 + d.gpus / 4));

    let aPct = dual ? 50 + (itNorm - 0.5) * 14 + Math.sin(state.tick / 31) * 2 : 100;
    aPct = Math.min(68, Math.max(32, aPct));
    const bPct = dual ? 100 - aPct : 0;

    pushHist("traffic", rpsNorm);
    pushHist("it", itNorm);
    pushHist("dtw", dtwNorm);
    pushHist("pue", pueNorm);
    pushHist("ecn", ecnNorm);

    q('[data-m="it-kw"]').innerHTML = `${formatNum(itKw, 0)} <span class="operate-dash-unit">kW</span>`;
    q('[data-m="dtw"]').innerHTML = `${formatNum(dTw, 1)} <span class="operate-dash-unit">K</span>`;
    q('[data-m="rps"]').innerHTML = `${formatNum(Math.round(state.peakRps * rpsNorm))} <span class="operate-dash-unit">req/s</span>`;
    q('[data-m="pue"]').textContent = formatNum(pue, 2);
    q('[data-m="ecn"]').innerHTML = `${formatNum(ecn)} <span class="operate-dash-unit">ECN / min</span>`;

    if (dual) {
      q('[data-bar="feed-a"]').style.width = `${aPct}%`;
      q('[data-bar="feed-b"]').style.width = `${bPct}%`;
      q('[data-val="feed-a"]').textContent = `${Math.round(aPct)}%`;
      q('[data-val="feed-b"]').textContent = `${Math.round(bPct)}%`;
      grid.classList.toggle("operate-feed-warn", Math.abs(aPct - 50) > 12);
    }

    const trafficSpark = q('[data-spark="traffic"]');
    if (trafficSpark) {
      trafficSpark.setAttribute("d", sparkStep(state.hist.traffic, W, H));
      q('[data-area="traffic"]')?.setAttribute("d", trafficAreaStep(state.hist.traffic, W, H));
    }
    q('[data-spark="it"]')?.setAttribute("points", sparkLine(state.hist.it, W, H));
    q('[data-spark="dtw"]')?.setAttribute("points", sparkLine(state.hist.dtw, W, H));
    q('[data-spark="pue"]')?.setAttribute("points", sparkLineTight(state.hist.pue, W, H));
    const ecnG = q('[data-spark="ecn-bars"]');
    if (ecnG) ecnG.innerHTML = sparkCandles(state.hist.ecn, W, H);

    grid.classList.toggle("operate-sim-stress", load > 0.78 || state.burst > 0.15);
    trafficSpark?.classList.toggle("operate-spark-burst", state.burst > 0.1);
    ecnG?.classList.toggle("operate-ecn-hot", ecnNorm > 0.45);

    updateDomainMinis(domainsRoot, toolsRoot, layerRoot, state.histMinis, miniMap);
    domainsRoot?.classList.toggle("operate-domain-live", state.playing);
    toolsRoot?.classList.toggle("operate-domain-live", state.playing);
    layerRoot?.classList.toggle("operate-domain-live", state.playing);
  }

  playBtn.addEventListener("click", () => {
    state.playing = !state.playing;
    playBtn.textContent = state.playing ? "Pause" : "Play";
    playBtn.setAttribute("aria-pressed", state.playing ? "true" : "false");
    grid.dataset.playing = state.playing ? "true" : "false";
  });

  burstBtn.addEventListener("click", () => {
    state.burst = 0.45 + (seedFromPlan(plan) % 100) / 400;
    burstBtn.classList.add("operate-sim-btn-hit");
    setTimeout(() => burstBtn.classList.remove("operate-sim-btn-hit"), 280);
  });

  slider.addEventListener("input", () => {
    state.load = Number(slider.value) / 100;
    sliderPct.textContent = `${slider.value}%`;
    slider.setAttribute("aria-valuetext", `${slider.value} percent`);
  });

  root.querySelectorAll(".operate-sim-preset").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = Number(btn.dataset.load);
      slider.value = String(v);
      state.load = v / 100;
      sliderPct.textContent = `${v}%`;
    });
  });

  for (let i = 0; i < 24; i++) sample();

  state.timer = setInterval(() => {
    if (state.playing) sample();
  }, 180);

  activeSim = state;
}
