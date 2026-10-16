import { drawHall } from "../charts/hall.js";
import { getBlock } from "../catalog/blocks.js";
import { coolingClassLabel } from "../build/plan.js";
import { amps, formatNum, lpm } from "../calc.js";
import { syncProgramFlow } from "./flowDrive.js";

/** Hall floor plan + rack elevation · redrawn from Build; flow speed ∝ IT load. */
export function drawProgramVisual(plan, slots, stats) {
  drawHall("svg-program-hall", plan);
  drawRackSection("svg-program-rack", plan, slots, stats);
  renderMixLegend(plan);
  renderVisualCaption(plan, stats);
  syncProgramFlow(plan, stats);
}

function renderVisualCaption(plan, stats) {
  const el = document.getElementById("program-visual-caption");
  if (!el) return;
  el.textContent = `${formatNum(plan.racks)} racks · ${formatNum(stats?.designSiteMw ?? 0, 2)} MW design · ${coolingClassLabel(plan.coolingClass)} · ${plan.feedRedundancy} feeds`;
}

function renderMixLegend(plan) {
  const el = document.getElementById("program-mix-legend");
  if (!el) return;
  const segs = plan.gpuMixSegments;
  if (!segs?.length || segs.length < 2) {
    el.innerHTML = "";
    el.hidden = true;
    return;
  }
  el.hidden = false;
  const fills = [
    "var(--hot)",
    "var(--cold)",
    "var(--net)",
    "var(--accent)",
  ];
  el.innerHTML = segs
    .map(
      (s, i) =>
        `<span class="mix-legend-item"><span class="mix-swatch" style="background:${fills[i % fills.length]}"></span>${s.name} · ${formatNum(s.racks)} racks</span>`,
    )
    .join("");
}

export function drawRackSection(svgId, plan, slots, stats) {
  const s = document.getElementById(svgId);
  if (!s) return;
  const rack = getBlock(slots.rack);
  const W = 280;
  let h = "";

  const integrated = plan.integrated;
  const cooling = plan.coolingClass;
  const rackKw = plan.rackKw;
  const frameTop = 24;
  const footroom = 52;

  if (integrated) {
    const frameH = 268;
    const H = frameTop + frameH + footroom;
    h += `<text class="nm" x="140" y="16" text-anchor="middle">Rack section</text>`;
    h += `<rect class="rack-frame" x="40" y="${frameTop}" width="200" height="${frameH}" rx="2"/>`;
    h += `<rect class="rack-fill-int" x="52" y="${frameTop + 16}" width="176" height="${frameH - 32}"/>`;
    h += `<foreignObject x="52" y="${frameTop + 48}" width="176" height="120">
      <div xmlns="http://www.w3.org/1999/xhtml" class="rack-fo">
        <strong>${rack?.name ?? "Integrated"}</strong>
        <span>${plan.gpusPerRack} GPU · ${formatNum(rackKw, 0)} kW</span>
      </div>
    </foreignObject>`;
    if (cooling === "direct_liquid") {
      const ly = frameTop + frameH - 72;
      h += `<line class="cl flow-cl flow-cl-strong" x1="60" x2="220" y1="${ly}" y2="${ly}" stroke-width="4"/>`;
      h += `<line class="cl flow-cl flow-cl-strong" x1="60" x2="220" y1="${ly + 20}" y2="${ly + 20}" stroke-width="4"/>`;
      h += `<text class="mu sm" x="140" y="${ly + 44}" text-anchor="middle">Manifold in / out</text>`;
    }
    const midY = frameTop + frameH / 2;
    h += `<line class="pw flow-pw" x1="20" x2="40" y1="${midY}" y2="${midY}" stroke-width="3"/>`;
    h += `<text class="mu sm" x="140" y="${frameTop + frameH + 18}" text-anchor="middle">~${formatNum(Math.round(amps(rackKw)))} A · ${formatNum(rackKw, 0)} kW</text>`;
    if (cooling !== "air") {
      h += `<text class="mu sm" x="140" y="${frameTop + frameH + 34}" text-anchor="middle">~${formatNum(Math.round(lpm(rackKw)))} L/min/rack</text>`;
    } else {
      h += `<text class="mu sm" x="140" y="${frameTop + frameH + 34}" text-anchor="middle">Room air + containment</text>`;
    }
    s.setAttribute("viewBox", `0 0 ${W} ${H}`);
    s.setAttribute("preserveAspectRatio", "xMidYMid meet");
    s.innerHTML = h;
    return;
  }

  const n = Math.max(1, plan.serversPerRack);
  const gap = 4;
  const maxStack = 268;
  let uH = Math.floor((maxStack - (n - 1) * gap) / n);
  uH = Math.min(42, Math.max(10, uH));
  const stackH = n * uH + (n - 1) * gap;
  const frameH = Math.max(120, stackH + 24);
  const frameY = frameTop;
  const H = frameY + frameH + footroom;
  const showInU = uH >= 20;

  h += `<text class="nm" x="140" y="16" text-anchor="middle">Rack section</text>`;
  h += `<rect class="rack-frame" x="40" y="${frameY}" width="200" height="${frameH}" rx="2"/>`;
  const stackY0 = frameY + 12;
  for (let i = 0; i < n; i++) {
    const y = stackY0 + i * (uH + gap);
    h += `<rect class="server-u" x="56" y="${y}" width="168" height="${Math.max(6, uH - 2)}"/>`;
    if (showInU) {
      h += `<text class="mu sm" x="140" y="${y + uH / 2 + 3}" text-anchor="middle">${plan.gpusPerServer}G · ${formatNum(plan.serverKw, 0)}kW</text>`;
    }
  }
  if (!showInU) {
    h += `<text class="mu sm" x="140" y="${stackY0 + stackH / 2 + 4}" text-anchor="middle">${n}× · ${plan.gpusPerServer}G · ${formatNum(plan.serverKw, 0)} kW/srv</text>`;
  }
  if (cooling === "air_rear_door") {
    h += `<rect class="rear-door rear-door-flow" x="228" y="${stackY0}" width="14" height="${stackH}"/>`;
  }
  if (cooling === "direct_liquid") {
    h += `<line class="cl flow-cl flow-cl-strong" x1="48" x2="48" y1="${stackY0}" y2="${stackY0 + stackH}" stroke-width="3"/>`;
    h += `<line class="cl flow-cl flow-cl-strong" x1="232" x2="232" y1="${stackY0}" y2="${stackY0 + stackH}" stroke-width="3"/>`;
  }

  const midY = frameY + frameH / 2;
  h += `<line class="pw flow-pw" x1="20" x2="40" y1="${midY}" y2="${midY}" stroke-width="3"/>`;
  h += `<text class="mu sm" x="24" y="${midY - 12}" text-anchor="middle">400V</text>`;
  h += `<text class="mu sm" x="140" y="${frameY + frameH + 18}" text-anchor="middle">~${formatNum(Math.round(amps(rackKw)))} A · ${formatNum(rackKw, 0)} kW</text>`;
  if (cooling !== "air") {
    h += `<text class="mu sm" x="140" y="${frameY + frameH + 34}" text-anchor="middle">~${formatNum(Math.round(lpm(rackKw)))} L/min/rack</text>`;
  } else {
    h += `<text class="mu sm" x="140" y="${frameY + frameH + 34}" text-anchor="middle">Room air + containment</text>`;
  }

  s.setAttribute("viewBox", `0 0 ${W} ${H}`);
  s.setAttribute("preserveAspectRatio", "xMidYMid meet");
  s.innerHTML = h;
}
