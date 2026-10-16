import { computeHallLayout } from "./hallLayout.js";
import { formatNum } from "../calc.js";
import { coolingClassLabel } from "../build/plan.js";

const MIX_FILLS = [
  "color-mix(in srgb, var(--hot) 28%, var(--surface))",
  "color-mix(in srgb, var(--cold) 28%, var(--surface))",
  "color-mix(in srgb, var(--net) 28%, var(--surface))",
  "color-mix(in srgb, var(--accent) 22%, var(--surface))",
];

function coolingClassShort(c) {
  if (c === "air") return "Air";
  if (c === "air_rear_door") return "Rear-door air";
  if (c === "direct_liquid") return "Direct liquid";
  return String(c ?? "-");
}

function fabricRateShort(gbps) {
  const g = Number(gbps) || 0;
  if (g >= 1000) return `~${formatNum(g / 1000, g >= 10000 ? 1 : 2)} Tbps/rack`;
  return `~${formatNum(g, 0)} Gbps/rack`;
}

function rackSegmentIndex(globalIdx, segments) {
  if (!segments?.length) return -1;
  let cum = 0;
  for (let s = 0; s < segments.length; s++) {
    cum += segments[s].racks;
    if (globalIdx < cum) return s;
  }
  return segments.length - 1;
}

function renderCompleteOverlay(layout, plan, overlay) {
  const { fabric, designSiteMw, hallLoopLpm, heatTons } = overlay;
  const parts = { space: "", power: "", cool: "", net: "" };
  const {
    hallInnerX,
    hallboxY,
    hallboxW,
    hallMidX,
    contentBottom,
    footerY,
    rows,
    racksPerRow,
    rackX0,
    rackW,
    rackH,
    topY,
    rowH,
    fabricX,
    powerBoxY,
    coolBoxY,
    coolBoxX,
    sideBoxW,
    sideBoxH,
    busY,
    rowLabelX,
    netZoneY,
    netZoneH,
    bannerBandH,
    pwBusX,
  } = layout;

  const bannerTop = hallboxY + 8;
  parts.space += `<rect class="hall-banner" x="${hallInnerX + 8}" y="${bannerTop}" width="${hallboxW - 16}" height="${bannerBandH - 10}" rx="1"/>`;
  const line1 = `${formatNum(plan.racks)} racks · ${formatNum(plan.hallKw)} kW IT · ${formatNum(designSiteMw ?? 0, 2)} MW design`;
  const line2 = `~${formatNum(Math.round(plan.areaM2))} m² · ${plan.feedRedundancy} · ${rows}×${racksPerRow} · ${coolingClassShort(plan.coolingClass)}`;
  parts.space += `<text class="hall-banner-t" x="${hallMidX}" y="${bannerTop + 13}" text-anchor="middle"><tspan x="${hallMidX}" dy="0">${line1}</tspan><tspan x="${hallMidX}" dy="12">${line2}</tspan></text>`;

  const kwLabel = `${formatNum(plan.rackKw, 0)}k`;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < racksPerRow; j++) {
      const gIdx = i * racksPerRow + j;
      if (gIdx >= plan.racks) continue;
      const x = rackX0 + rackW * j;
      const y = topY + i * rowH;
      const rw = Math.max(4, rackW - 2);
      if (rackW >= 34 && rackH >= 22 && kwLabel.length * 5.5 < rw) {
        parts.space += `<text class="rack-anno" x="${x + rw / 2 + 1}" y="${y + rackH / 2 + 3}" text-anchor="middle">${kwLabel}</text>`;
      }
    }
  }

  const legY = contentBottom + 8;
  parts.space += `<g class="hall-legend-box">`;
  parts.space += `<rect x="${hallInnerX + hallboxW - 118}" y="${legY}" width="110" height="48" class="legend-box"/>`;
  parts.space += `<text class="mu sm" x="${hallInnerX + hallboxW - 63}" y="${legY + 14}" text-anchor="middle">power · cool · fabric</text>`;
  parts.space += `<line class="pw" x1="${hallInnerX + hallboxW - 108}" x2="${hallInnerX + hallboxW - 88}" y1="${legY + 26}" y2="${legY + 26}"/>`;
  parts.space += `<line class="cl" x1="${hallInnerX + hallboxW - 108}" x2="${hallInnerX + hallboxW - 88}" y1="${legY + 34}" y2="${legY + 34}"/>`;
  parts.space += `<line class="fb" x1="${hallInnerX + hallboxW - 108}" x2="${hallInnerX + hallboxW - 88}" y1="${legY + 42}" y2="${legY + 42}"/>`;
  parts.space += `<text class="mu sm hall-foot" x="${hallInnerX + 12}" y="${footerY}" text-anchor="start">Click a rack for bay detail</text>`;
  parts.space += `</g>`;

  parts.power += `<text class="nm sm plant-title" x="75" y="${powerBoxY + 20}" text-anchor="middle">Utility</text>`;
  parts.power += `<text class="hall-stat big" x="75" y="${powerBoxY + sideBoxH * 0.48}" text-anchor="middle">${formatNum(designSiteMw ?? 0, 2)} MW</text>`;
  parts.power += `<text class="mu sm plant-line" x="75" y="${powerBoxY + sideBoxH * 0.66}" text-anchor="middle">UPS · ${plan.feedRedundancy}</text>`;
  parts.power += `<text class="mu sm plant-line" x="75" y="${powerBoxY + sideBoxH * 0.82}" text-anchor="middle">busway → rows</text>`;

  const coolCx = coolBoxX + sideBoxW / 2;
  parts.cool += `<text class="nm sm plant-title" x="${coolCx}" y="${coolBoxY + 20}" text-anchor="middle">Plant</text>`;
  parts.cool += `<text class="hall-stat big" x="${coolCx}" y="${coolBoxY + sideBoxH * 0.48}" text-anchor="middle">${formatNum(heatTons ?? 0)} t</text>`;
  if (plan.coolingClass !== "air") {
    parts.cool += `<text class="mu sm plant-line" x="${coolCx}" y="${coolBoxY + sideBoxH * 0.66}" text-anchor="middle">${formatNum(hallLoopLpm ?? 0)} L/min</text>`;
  } else {
    parts.cool += `<text class="mu sm plant-line" x="${coolCx}" y="${coolBoxY + sideBoxH * 0.66}" text-anchor="middle">${coolingClassLabel(plan.coolingClass)}</text>`;
  }
  parts.cool += `<text class="mu sm plant-line" x="${coolCx}" y="${coolBoxY + sideBoxH * 0.82}" text-anchor="middle">CHW / CRAH loop</text>`;

  const netLine1 = `${formatNum(fabric?.leafCount ?? 0)} leaf · ${formatNum(fabric?.spineCount ?? 0)} spine`;
  const netLine2 = fabricRateShort(fabric?.gbpsPerRack ?? 0);
  parts.net += `<text class="net-zone-t" x="${hallMidX}" y="${netZoneY + 16}" text-anchor="middle"><tspan x="${hallMidX}" dy="0" class="net-head">Network row</tspan><tspan x="${hallMidX}" dy="11" class="net-sub">${netLine1}</tspan><tspan x="${hallMidX}" dy="11" class="net-sub">${netLine2}</tspan></text>`;

  return parts;
}

export function drawHall(svgId, plan, options = {}) {
  const segments = plan?.gpuMixSegments;
  const layout = computeHallLayout(plan, { complete: !!options.complete });
  const {
    rows,
    racksPerRow,
    W,
    H,
    hallInnerX,
    hallboxY,
    hallboxW,
    hallboxH,
    aisleX,
    aisleW,
    aisleEnd,
    topY,
    rowH,
    rackW,
    rackH,
    rackSpan,
    rackX0,
    fabricX,
    hallMidX,
    rowLabelX,
    contentBottom,
    busY,
    coolBusY,
    sideBoxH,
    powerBoxY,
    coolBoxY,
    coolBoxX,
    sideBoxW,
    clFeedY,
    pwBusX,
    clBusX,
    netZoneW,
    netZoneX,
    netZoneY,
    netZoneH,
    footerY,
    viewPadTop,
  } = layout;

  const pickable = options.complete ? " rack-pickable" : "";
  const mid = svgId.replace(/[^a-z0-9]/gi, "");
  let space = "";
  let power = "";
  let cool = "";
  let net = "";

  space += `<rect class="hallbox" x="${hallInnerX}" y="${hallboxY}" width="${hallboxW}" height="${hallboxH}"/>`;

  for (let i = 0; i < rows; i++) {
    const rowY = topY + i * rowH;
    const hotY = rowY - 8;
    /* Even rows: hot aisle above (backs meet); every row: cold in front · matches Scale hall */
    if (i % 2 === 0) {
      space += `<rect class="aisle-hot" x="${aisleX}" y="${hotY}" width="${aisleW}" height="16"/>`;
    }
    space += `<rect class="aisle-cold" x="${aisleX}" y="${rowY + rackH}" width="${aisleW}" height="18"/>`;
    for (let j = 0; j < racksPerRow; j++) {
      const gIdx = i * racksPerRow + j;
      if (gIdx >= plan.racks) continue;
      const seg = rackSegmentIndex(gIdx, segments);
      const fill = seg >= 0 ? ` style="fill:${MIX_FILLS[seg % MIX_FILLS.length]}"` : "";
      space += `<rect class="rack rack-live${pickable}" data-rack-idx="${gIdx}" tabindex="${options.complete ? 0 : -1}" role="${options.complete ? "button" : "presentation"}" x="${rackX0 + rackW * j}" y="${rowY}" width="${Math.max(4, rackW - 2)}" height="${rackH}"${fill}/>`;
    }
    const facesDown = i % 2 === 0;
    const fy = facesDown ? rowY + rackH : rowY;
    space += `<line class="front" x1="${rackX0}" x2="${rackX0 + rackSpan}" y1="${fy}" y2="${fy}"/>`;
    if (rowH >= 52 && !options.complete) {
      space += `<text class="mu sm" x="${rowLabelX}" y="${rowY + rackH / 2 + 4}">R${i + 1}</text>`;
    }
  }

  net += `<rect class="zone zone-net net-zone" x="${netZoneX}" y="${netZoneY}" width="${netZoneW}" height="${netZoneH}"/>`;
  if (!options.complete) {
    net += `<text class="nm plant-box-title" x="${hallMidX}" y="${netZoneY + 18}" text-anchor="middle">Network row</text>`;
    net += `<text class="mu sm plant-box-sub" x="${hallMidX}" y="${netZoneY + 36}" text-anchor="middle">leaf · spine · uplinks</text>`;
  }
  const netSlots = Math.min(Math.max(racksPerRow, 4), 10);
  const netW = Math.min(54, Math.floor((netZoneW - 16) / netSlots));
  if (!options.complete) {
    const netRackY = netZoneY + netZoneH - 16;
    for (let j = 0; j < netSlots; j++) {
      net += `<rect class="netrack" x="${netZoneX + 8 + netW * j}" y="${netRackY}" width="${Math.max(16, netW - 4)}" height="12"/>`;
    }
  }

  const mpw = `m-${mid}-pw`;
  const mcl = `m-${mid}-cl`;
  const mfb = `m-${mid}-fb`;
  const busVertTop = Math.min(...busY) - 4;
  const busVertBot = Math.max(...busY) + 4;
  const feedFromX = 136;
  power += `<rect class="zone zone-power" x="14" y="${powerBoxY}" width="122" height="${sideBoxH}"/>`;
  if (!options.complete) {
    power += `<text class="nm plant-box-title" x="75" y="${powerBoxY + sideBoxH * 0.38}" text-anchor="middle">Power</text>`;
    power += `<text class="mu sm plant-box-sub" x="75" y="${powerBoxY + sideBoxH * 0.58}" text-anchor="middle">UPS · switchgear</text>`;
  }

  /* Labels sit just left of the bus tie-in (clear of marker-end arrowheads) */
  const feedLabelX = pwBusX - 20;
  let busVertStart = busVertTop;
  if (plan.feedRedundancy === "2N") {
    const aFeedY = options.complete ? powerBoxY + sideBoxH + 6 : (busY[0] ?? 139) - 10;
    const bFeedY = aFeedY + 14;
    busVertStart = Math.min(aFeedY, bFeedY, busVertTop) - 4;
    power += `<line class="pw flow-pw pw-a" marker-end="url(#${mpw})" x1="${feedFromX}" x2="${pwBusX}" y1="${aFeedY}" y2="${aFeedY}"/>`;
    power += `<text class="mu sm pw-feed-label pw-a-label" x="${feedLabelX}" y="${aFeedY - 9}" text-anchor="end">A feed</text>`;
    power += `<line class="pw flow-pw pw-b" marker-end="url(#${mpw})" x1="${feedFromX}" x2="${pwBusX}" y1="${bFeedY}" y2="${bFeedY}" stroke-dasharray="7 5"/>`;
    power += `<text class="mu sm pw-feed-label pw-b-label" x="${feedLabelX}" y="${bFeedY + 15}" text-anchor="end">B feed</text>`;
  } else {
    const feedY = options.complete ? powerBoxY + sideBoxH + 10 : busY[0] ?? 139;
    busVertStart = Math.min(feedY, busVertTop) - 4;
    power += `<line class="pw flow-pw" marker-end="url(#${mpw})" x1="${feedFromX}" x2="${pwBusX}" y1="${feedY}" y2="${feedY}"/>`;
    if (options.complete) {
      power += `<text class="mu sm pw-feed-label" x="${feedLabelX}" y="${feedY - 9}" text-anchor="end">Feed</text>`;
    }
  }

  power += `<line class="pw flow-pw" x1="${pwBusX}" x2="${pwBusX}" y1="${busVertStart}" y2="${busVertBot}"/>`;
  busY.forEach((y, i) => {
    power += `<line class="pw flow-pw" data-row="${i}" marker-end="url(#${mpw})" x1="${pwBusX}" x2="${aisleEnd - 4}" y1="${y}" y2="${y}"/>`;
    if (!options.complete) {
      for (let j = 0; j < racksPerRow; j++) {
        const gIdx = i * racksPerRow + j;
        if (gIdx >= plan.racks) continue;
        const rx = rackX0 + rackW * j + rackW / 2;
        const ry = topY + i * rowH + (i % 2 === 0 ? 0 : rackH);
        power += `<line class="pw pw-tap" x1="${rx}" x2="${rx}" y1="${y}" y2="${ry}"/>`;
      }
    } else {
      const rowY = topY + i * rowH;
      power += `<line class="pw pw-tap" x1="${rackX0 + rackSpan / 2}" x2="${rackX0 + rackSpan / 2}" y1="${y}" y2="${rowY}" stroke-dasharray="3 3"/>`;
    }
  });

  const coolCx = coolBoxX + sideBoxW / 2;
  cool += `<rect class="zone zone-cool" x="${coolBoxX}" y="${coolBoxY}" width="${sideBoxW}" height="${sideBoxH}"/>`;
  if (!options.complete) {
    cool += `<text class="nm plant-box-title" x="${coolCx}" y="${coolBoxY + sideBoxH * 0.38}" text-anchor="middle">Cooling</text>`;
    cool += `<text class="mu sm plant-box-sub" x="${coolCx}" y="${coolBoxY + sideBoxH * 0.58}" text-anchor="middle">plant · CDUs</text>`;
  }
  cool += `<line class="cl flow-cl" marker-end="url(#${mcl})" x1="${coolBoxX}" x2="${clBusX}" y1="${clFeedY}" y2="${clFeedY}"/>`;
  cool += `<line class="cl flow-cl" x1="${clBusX}" x2="${clBusX}" y1="${topY}" y2="${topY + rows * rowH}"/>`;
  coolBusY.forEach((y, i) => {
    cool += `<line class="cl flow-cl" data-row="${i}" marker-end="url(#${mcl})" x1="${clBusX}" x2="${rackX0 + rackSpan - 4}" y1="${y}" y2="${y}"/>`;
  });

  const fabricTrunkY = netZoneY + Math.floor(netZoneH / 2);
  net += `<line class="fb flow-fb" marker-end="url(#${mfb})" x1="${netZoneX + netZoneW - 4}" x2="${fabricX}" y1="${fabricTrunkY}" y2="${fabricTrunkY}"/>`;
  net += `<line class="fb flow-fb" x1="${fabricX}" x2="${fabricX}" y1="${fabricTrunkY}" y2="${topY + rows * rowH}"/>`;
  busY.forEach((y, i) => {
    net += `<line class="fb flow-fb" data-row="${i}" marker-end="url(#${mfb})" x1="${aisleEnd - 4}" x2="${fabricX}" y1="${y}" y2="${y}"/>`;
    net += `<line class="fb fb-drop" x1="${fabricX}" x2="${aisleEnd - 8}" y1="${y}" y2="${y}"/>`;
  });

  if (!options.complete) {
    space += `<text class="mu sm" x="${hallMidX}" y="${contentBottom + 18}" text-anchor="middle">${rows} rows × ${racksPerRow} racks</text>`;
  }

  if (options.complete && options.overlay) {
    const o = renderCompleteOverlay(layout, plan, options.overlay);
    space += o.space;
    power += o.power;
    cool += o.cool;
    net += o.net;
  }

  const layerOrder = options.complete
    ? [
        ["power", power],
        ["cool", cool],
        ["net", net],
        ["space", space],
      ]
    : [
        ["space", space],
        ["power", power],
        ["cool", cool],
        ["net", net],
      ];
  const layers = layerOrder
    .map(([name, body]) => `<g class="hall-layer hall-layer-${name}">${body}</g>`)
    .join("");

  const h = `<defs>
    <marker id="m-${mid}-pw" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--hot)"/></marker>
    <marker id="m-${mid}-cl" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--cold)"/></marker>
    <marker id="m-${mid}-fb" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--net)"/></marker>
  </defs>
  ${layers}`;

  const s = document.getElementById(svgId);
  if (!s) return;
  const padT = viewPadTop || 0;
  s.setAttribute("viewBox", `0 ${-padT} ${W} ${H + padT}`);
  s.setAttribute("preserveAspectRatio", "xMidYMid meet");
  s.innerHTML = h;
}

export function drawCompleteHall(svgId, plan, overlay) {
  drawHall(svgId, plan, { complete: true, overlay });
}
