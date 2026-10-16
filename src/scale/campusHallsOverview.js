import { formatNum } from "../calc.js";
import {
  campusHallSlices,
  computeCampusMiniGridMetrics,
  hallLabel,
  siteHallInteriorSvg,
} from "../hall/hallFootprint.js";

function campusMiniFootprint(cx, cy, w, h, plan, label, highlight) {
  const x = cx - w / 2;
  const y = cy - h / 2;
  const interior = siteHallInteriorSvg(x, y, w, h, plan);
  const cls = highlight ? "campus-mini-hall campus-mini-hall-a" : "campus-mini-hall";
  return `<g class="${cls}">
    <rect class="site-hall-foot campus-mini-foot" x="${x}" y="${y}" width="${w}" height="${h}" rx="1"/>
    ${interior}
    <text class="campus-mini-label sm" x="${cx}" y="${y + h + 12}" text-anchor="middle">${label}</text>
  </g>`;
}

function campusMiniStrip(x, y, stripW, plan, hallCount, metrics) {
  const m = metrics ?? computeCampusMiniGridMetrics(stripW, plan, hallCount);
  const { cols, drawN, miniW, miniH, gap, rowPitch, stripTitleH } = m;
  const blockW = cols * miniW + (cols - 1) * gap;
  const left = x + (stripW - blockW) / 2;
  let s = `<g class="campus-overview-strip">
    <text class="campus-overview-strip-title" x="${x + 14}" y="${y}">Campus · ${hallCount} halls</text>
    <text class="campus-overview-strip-sub mu sm" x="${x + 14}" y="${y + 14}">Each repeats your Build hall · A highlighted</text>`;
  for (let i = 0; i < drawN; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = left + col * (miniW + gap) + miniW / 2;
    const cy = y + stripTitleH + row * rowPitch + miniH / 2;
    s += campusMiniFootprint(cx, cy, miniW, miniH, plan, hallLabel(i), i === 0);
  }
  s += `</g>`;
  return s;
}

function campusScaleFromOverlay(overlay) {
  return {
    campusItMw: overlay.campusItMw,
    hallItMw: overlay.hallItMw,
  };
}

export function renderCampusHallsOverviewLayers(layout, plan, slots, overlay) {
  const scale = campusScaleFromOverlay(overlay);
  const { hallCount, totalRacks, totalHallKw, module, hallBlockLabel, campusItMw, hallItMw } =
    campusHallSlices(plan, slots, scale);
  const { W, pad, headerY, summaryY, stripTop, footerY, miniMetrics } = layout;
  const feed = plan.feedRedundancy ?? "N+1";
  const hallDesignMw = overlay.designSiteMw ?? 0;
  const campusDesignMw = hallDesignMw * hallCount;
  let body = `<rect class="campus-overview-bg" x="0" y="0" width="${W}" height="${layout.H}"/>`;
  body += `<text class="campus-overview-eyebrow mu sm" x="${pad}" y="${headerY}">Campus IT capacity ÷ hall module from Build</text>`;
  body += `<text class="campus-overview-head" x="${pad}" y="${headerY + 22}">${formatNum(campusItMw)} MW IT → ${hallCount} halls · ${formatNum(totalRacks)} racks · ${formatNum(totalHallKw, 0)} kW IT</text>`;
  body += `<text class="campus-overview-summary mu sm" x="${pad}" y="${summaryY}">${hallBlockLabel} · ${formatNum(module.racks)} racks · ${formatNum(hallItMw, 2)} MW IT / hall · ~${formatNum(campusDesignMw, 2)} MW design (PUE + spare) · ${feed}</text>`;

  body += campusMiniStrip(pad, stripTop, W - pad * 2, plan, hallCount, miniMetrics);

  if (hallCount > 1) {
    body += `<text class="campus-overview-link mu sm" x="${W / 2}" y="${footerY}" text-anchor="middle">${hallCount}× ${formatNum(module.racks)}-rack halls on site plan below · isometric (diagram 3) is one hall</text>`;
  }

  return { space: body, power: "", cool: "", net: "" };
}
