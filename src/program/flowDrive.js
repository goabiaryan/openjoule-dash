import { formatNum } from "../calc.js";
import { coolingClassLabel } from "../build/plan.js";

function syncFlowRoot(root, plan, badgeId) {
  if (!root || !plan) return;

  const hallMw = plan.hallKw / 1000;
  const pwDur = Math.max(0.35, 2.4 - hallMw * 0.65);
  const clDur = Math.max(0.4, 2.8 - hallMw * 0.55);
  const fbDur = Math.max(0.5, 3 - hallMw * 0.4);

  root.style.setProperty("--flow-pw-dur", `${pwDur.toFixed(2)}s`);
  root.style.setProperty("--flow-cl-dur", `${clDur.toFixed(2)}s`);
  root.style.setProperty("--flow-fb-dur", `${fbDur.toFixed(2)}s`);
  root.style.setProperty("--rack-pulse-dur", `${(1.8 + plan.racks * 0.02).toFixed(2)}s`);
  root.style.setProperty("--it-kw", String(Math.round(plan.hallKw)));

  root.dataset.cooling = plan.coolingClass ?? "air";
  root.dataset.feeds = plan.feedRedundancy ?? "2N";
  root.dataset.racks = String(plan.racks);
  root.dataset.rows = String(plan.rows);
  root.dataset.integrated = plan.integrated ? "1" : "0";

  const badge = badgeId ? document.getElementById(badgeId) : null;
  if (badge) {
    badge.textContent = `Live · ${formatNum(plan.hallKw)} kW IT · ${coolingClassLabel(plan.coolingClass)}`;
  }

  root.classList.remove("scene-pulse");
  void root.offsetWidth;
  root.classList.add("scene-pulse");
}

export function applyRackPulseDelays(svgSelector) {
  document.querySelectorAll(`${svgSelector} .rack-live`).forEach((el) => {
    const i = Number(el.dataset.rackIdx) || 0;
    el.style.animationDelay = `${(i * 0.07) % 1.4}s`;
  });
}

/** Tie animation speed + scene mode to live Build plan (Program + Scale floors). */
export function syncProgramFlow(plan, _stats) {
  void _stats;
  syncFlowRoot(document.querySelector(".program-visual"), plan, "program-live-badge");
  syncFlowRoot(document.querySelector(".scale-hall-visual"), plan, "size-live-badge");
  applyRackPulseDelays("#svg-program-hall");
  applyRackPulseDelays("#svg-scale-hall");
}
