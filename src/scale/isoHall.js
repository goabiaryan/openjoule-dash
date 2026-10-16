import { getBlock } from "../catalog/blocks.js";
import { formatNum, lpm } from "../calc.js";
import { rackPlanOrigin } from "./scaleLayout.js";
import { textInBox, calloutHeight, calloutWidth } from "./diagramLabels.js";
import { illustrativeEffectiveGbps, illustrativeEffectiveKw } from "./layerStress.js";

function coolingClassShort(c) {
  if (c === "air") return "Air";
  if (c === "air_rear_door") return "Rear-door air";
  if (c === "direct_liquid") return "Direct liquid";
  return String(c ?? "-");
}

const MIX_FILLS = [
  "color-mix(in srgb, var(--hot) 22%, var(--surface))",
  "color-mix(in srgb, var(--cold) 22%, var(--surface))",
  "color-mix(in srgb, var(--net) 22%, var(--surface))",
  "color-mix(in srgb, var(--accent) 18%, var(--surface))",
];

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

function isoRack(x, y, w, h, sx, sy, gIdx, fillExtra, kwLabel, effKwLabel, netEffLabel, rearDoor) {
  const top = `${x},${y} ${x + w},${y} ${x + w + sx},${y - sy} ${x + sx},${y - sy}`;
  const right = `${x + w},${y} ${x + w},${y + h} ${x + w + sx},${y + h - sy} ${x + w + sx},${y - sy}`;
  const label =
    kwLabel && w >= 28
      ? `<text class="rack-anno iso-rack-kw" x="${x + w / 2}" y="${y + h / 2 - 5}" text-anchor="middle" dominant-baseline="middle">${kwLabel}</text>
    <text class="rack-anno iso-rack-throttle" x="${x + w / 2}" y="${y + h / 2 + 5}" text-anchor="middle" dominant-baseline="middle">${effKwLabel}</text>
    <text class="rack-anno iso-rack-net-stress" x="${x + w / 2}" y="${y + h / 2 + 14}" text-anchor="middle" dominant-baseline="middle">${netEffLabel}</text>`
      : "";
  const rear = rearDoor ? `<rect class="iso-rear-door" x="${x + 2}" y="${y + h - 6}" width="${w - 4}" height="5"/>` : "";
  return `<g class="iso-rack rack-live rack-pickable" data-rack-idx="${gIdx}" tabindex="0" role="button">
    <polygon class="iso-face iso-right" points="${right}"${fillExtra}/>
    <rect class="iso-face iso-front" x="${x}" y="${y}" width="${w}" height="${h}"${fillExtra}/>
    ${rear}
    <polygon class="iso-face iso-top" points="${top}"${fillExtra}/>
    ${label}
  </g>`;
}

function isoTray(x, y, w, sx, sy, h, cls) {
  const z = y - sy - h;
  const top = `${x},${z} ${x + w},${z} ${x + w + sx},${z - sy} ${x + sx},${z - sy}`;
  const front = `${x},${z} ${x + w},${z} ${x + w},${z + h} ${x},${z + h}`;
  return `<g class="${cls} iso-tray"><polygon class="iso-tray-top" points="${top}"/><polygon class="iso-tray-front" points="${front}"/></g>`;
}

export function renderIsoHallLayers(layout, plan, overlay, slots) {
  const site = getBlock(slots?.site);
  const { fabric, designSiteMw, hallLoopLpm, optionalIds } = overlay;
  const segments = plan?.gpuMixSegments;
  const {
    rows,
    racksPerRow,
    rw,
    rh,
    rowPitch,
    skewX,
    skewY,
    hallOx,
    hallOy,
    hallW,
    trayLift,
    feedAX,
    feedBX,
    labelColX,
    siteH,
    siteGap,
    netShelfH,
    hallTop: layoutHallTop,
    bridgeY: layoutBridgeY,
    shelfY: layoutShelfY,
    serviceEntryY,
    hallStandalone,
    hallCx,
    netEntryX,
    W,
    H,
  } = layout;

  const parts = { space: "", racks: "", power: "", powerRows: "", cool: "", net: "", netRows: "" };
  const dual = plan.feedRedundancy === "2N";
  const hallTop = layoutHallTop ?? siteH + (siteGap ?? 0);
  const bridgeY = layoutBridgeY ?? hallTop - 4;
  const shelfY = layoutShelfY ?? hallTop + 12;
  const entryY = serviceEntryY ?? siteH - 2;
  const kwShort = `${formatNum(plan.rackKw, 0)}k`;
  const layerNominal = { space: true, power: true, cool: true, net: true };
  const effKwShort = `${formatNum(illustrativeEffectiveKw(plan.rackKw, layerNominal), 0)}k`;
  const gbpsRack = fabric?.gbpsPerRack ?? 0;
  const netEffShort = `${formatNum(illustrativeEffectiveGbps(gbpsRack, layerNominal), 0)}G`;
  const rearDoor = plan.coolingClass === "air_rear_door";
  const liquid = plan.coolingClass === "direct_liquid";
  const hasCdu = optionalIds?.has("cool-cdu") || liquid;

  parts.space += `<rect class="hall-region-bg" x="0" y="${Math.max(0, hallTop - 4)}" width="${W}" height="${H - Math.max(0, hallTop - 4)}"/>`;
  if (hallStandalone) {
    parts.space += `<text class="iso-hall-bridge mu sm" x="${hallCx}" y="${bridgeY}" text-anchor="middle">Service entry from site · A/B · CHW · interconnect</text>`;
  }
  const shelfW = hallW + skewX + 48;
  parts.net += `<rect class="net-shelf" x="${hallOx - 24}" y="${shelfY}" width="${shelfW}" height="${netShelfH - 8}" rx="2"/>`;
  parts.net += `<text class="net-head diagram-inbox diagram-inbox-net" x="${hallCx}" y="${shelfY + 14}" text-anchor="middle">Network · spine / leaf</text>`;
  parts.net += `<text class="net-sub diagram-inbox diagram-inbox-net" x="${hallCx}" y="${shelfY + 28}" text-anchor="middle">${formatNum(fabric?.leafCount ?? 0)} leaf · ${formatNum(fabric?.spineCount ?? 0)} spine · ${fabricRateShort(fabric?.gbpsPerRack ?? 0)}</text>`;
  const chipN = Math.min(racksPerRow, 10);
  const chipW = Math.floor((hallW - 12) / chipN);
  for (let j = 0; j < chipN; j++) {
    parts.net += `<rect class="netrack" x="${hallOx + 6 + chipW * j}" y="${shelfY + netShelfH - 24}" width="${Math.max(12, chipW - 3)}" height="12"/>`;
  }

  const floorX = hallOx - 28;
  const floorY = hallOy - 10;
  const floorH = rows * rowPitch + rh + 28;
  parts.space += `<rect class="iso-floor" x="${floorX}" y="${floorY}" width="${hallW + skewX + 56}" height="${floorH}" rx="2"/>`;
  for (let g = 0; g < 6; g++) {
    const gx = floorX + 10 + g * ((hallW + skewX) / 6);
    parts.space += `<line class="floor-grid" x1="${gx}" x2="${gx + skewX * 0.35}" y1="${floorY + 6}" y2="${floorY + floorH - 6}"/>`;
  }

  for (let i = 0; i < rows; i++) {
    const { y } = rackPlanOrigin(layout, i, 0);
    if (i % 2 === 0) {
      parts.space += `<rect class="aisle-hot" x="${hallOx - 10}" y="${y - 16}" width="${hallW + 20}" height="12"/>`;
    }
    parts.space += `<rect class="aisle-cold" x="${hallOx - 10}" y="${y + rh + 2}" width="${hallW + 20}" height="14"/>`;
  }

  const fabricSpineX = hallOx + hallW + skewX + 22;
  const lastRowY = hallOy + (rows - 1) * rowPitch;
  const bottomNetY = lastRowY + rh + 12;
  parts.net += `<line class="fb flow-fb iso-spine" x1="${netEntryX}" x2="${netEntryX}" y1="${entryY}" y2="${shelfY + 8}"/>`;
  parts.net += `<line class="fb flow-fb iso-spine" x1="${netEntryX}" x2="${fabricSpineX}" y1="${shelfY + 20}" y2="${shelfY + 20}"/>`;
  parts.net += `<line class="fb flow-fb iso-spine-vert" x1="${fabricSpineX}" x2="${fabricSpineX}" y1="${shelfY + 20}" y2="${bottomNetY}"/>`;

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < racksPerRow; j++) {
      const gIdx = i * racksPerRow + j;
      if (gIdx >= plan.racks) continue;
      const { x, y } = rackPlanOrigin(layout, i, j);
      const seg = rackSegmentIndex(gIdx, segments);
      const fill = seg >= 0 ? ` style="fill:${MIX_FILLS[seg % MIX_FILLS.length]}"` : "";
      parts.racks += isoRack(x, y, rw, rh, skewX, skewY, gIdx, fill, kwShort, effKwShort, netEffShort, rearDoor);
    }
  }

  const lx = labelColX;
  const legW = 80;
  const upsTopo = site?.spec?.upsTopology ?? plan.feedRedundancy;
  const legendLines = dual ? ["A · solid", "B · dashed", upsTopo] : ["A · solid", upsTopo];
  const legendH = legendLines.length * 13 + 16;
  parts.power += `<g class="iso-mep-legend legend-power">
    <rect class="legend-box legend-box-power" x="${lx}" y="${hallOy - 6}" width="${legW}" height="${legendH}"/>
    ${textInBox(lx + legW / 2, hallOy - 6, legW, legendH, legendLines, "power")}
  </g>`;

  const upsW = 64;
  const upsH = 44;
  const upsX = lx + (legW - upsW) / 2;
  const upsY = hallOy + legendH + 4;
  parts.power += `<rect class="zone iso-ups legend-box-power" x="${upsX}" y="${upsY}" width="${upsW}" height="${upsH}" rx="2"/>`;
  parts.power += textInBox(upsX + upsW / 2, upsY, upsW, upsH, ["UPS"], "power");
  parts.power += `<line class="pw flow-pw" x1="${upsX + 64}" x2="${feedAX}" y1="${upsY + 24}" y2="${upsY + 24}"/>`;
  if (dual) {
    parts.power += `<line class="pw flow-pw pw-b" x1="${upsX + 64}" x2="${feedBX}" y1="${upsY + 34}" y2="${upsY + 34}" stroke-dasharray="7 5"/>`;
  }

  const bottomBusY = lastRowY + rh + 6;
  const busBot = bottomBusY + 6;
  if (hallStandalone) {
    parts.power += `<circle class="feed-port feed-a" cx="${feedAX}" cy="${entryY}" r="5"/>`;
    parts.power += `<text class="pw-feed-label pw-a-label" x="${feedAX}" y="${entryY - 18}" text-anchor="middle">A</text>`;
    if (dual) {
      parts.power += `<circle class="feed-port feed-b" cx="${feedBX}" cy="${entryY}" r="5"/>`;
      parts.power += `<text class="pw-feed-label pw-b-label" x="${feedBX}" y="${entryY - 18}" text-anchor="middle">B</text>`;
    }
    parts.cool += `<line class="cl flow-cl iso-chw-entry" x1="${hallCx}" x2="${hallCx}" y1="${entryY}" y2="${hallOy - 6}" stroke-dasharray="4 4"/>`;
  }

  parts.power += `<line class="pw flow-pw pw-a iso-bus" x1="${feedAX}" x2="${feedAX}" y1="${entryY}" y2="${busBot}"/>`;
  if (dual) {
    parts.power += `<line class="pw flow-pw pw-b iso-bus" x1="${feedBX}" x2="${feedBX}" y1="${entryY}" y2="${busBot}" stroke-dasharray="7 5"/>`;
  }

  const plantX = hallOx + hallW + skewX + 28;
  const spineCx = plantX + 38;
  const chwLines = ["CHW", `${formatNum(hallLoopLpm ?? 0)} L/min`, coolingClassShort(plan.coolingClass)];
  const chwLabelH = calloutHeight(chwLines.length) + 6;
  const chwColW = calloutWidth(chwLines);
  const chwColTop = hallOy - 6;
  const chwColBot = hallOy + rows * rowPitch + rh - 4;
  parts.cool += `<rect class="zone iso-plant-tie legend-box-cool" x="${spineCx - chwColW / 2}" y="${chwColTop}" width="${chwColW}" height="${Math.max(chwLabelH + 24, chwColBot - chwColTop)}" rx="2"/>`;
  parts.cool += textInBox(spineCx, chwColTop, chwColW, chwLabelH, chwLines, "cool");
  parts.cool += `<line class="cl flow-cl iso-plant-spine" x1="${spineCx}" x2="${spineCx}" y1="${chwColTop + chwLabelH + 4}" y2="${chwColBot - 6}"/>`;
  parts.cool += `<line class="cl flow-cl iso-plant-trunk" x1="${spineCx}" x2="${hallOx + hallW}" y1="${hallOy + rows * rowPitch * 0.45}" y2="${hallOy + rows * rowPitch * 0.45}"/>`;

  for (let i = 0; i < rows; i++) {
    const { x, y } = rackPlanOrigin(layout, i, 0);
    const netTrayY = y - trayLift - skewY - 8;
    const pwY = y - skewY - 10;
    parts.powerRows += isoTray(x, pwY, hallW, skewX, skewY, 7, "iso-tray-pw flow-pw");
    if (dual) {
      parts.powerRows += isoTray(x, pwY - 12, hallW, skewX, skewY, 5, "iso-tray-pw-b flow-pw pw-b");
    }
    parts.powerRows += `<line class="pw flow-pw iso-row-tie" x1="${feedAX}" x2="${hallOx - 4}" y1="${pwY}" y2="${pwY}"/>`;
    if (dual) {
      parts.powerRows += `<line class="pw flow-pw pw-b iso-row-tie" x1="${feedBX}" x2="${hallOx - 4}" y1="${pwY + 10}" y2="${pwY + 10}" stroke-dasharray="7 5"/>`;
    }
    const pwFloorY = y + rh + 6;
    parts.powerRows += `<line class="pw flow-pw iso-pw-floor" x1="${hallOx}" x2="${hallOx + hallW}" y1="${pwFloorY}" y2="${pwFloorY}"/>`;
    if (dual) {
      parts.powerRows += `<line class="pw flow-pw pw-b iso-pw-floor" x1="${hallOx}" x2="${hallOx + hallW}" y1="${pwFloorY + 9}" y2="${pwFloorY + 9}" stroke-dasharray="7 5"/>`;
    }

    const netDropY = netTrayY - skewY;
    const netFloorY = y + rh + 12;
    parts.netRows += isoTray(x, netTrayY, hallW, skewX, skewY, 5, "iso-tray-net flow-fb");
    parts.netRows += `<line class="fb flow-fb iso-net-drop" x1="${fabricSpineX}" x2="${hallOx + hallW - 4}" y1="${netDropY}" y2="${netDropY}"/>`;
    parts.netRows += `<line class="fb flow-fb iso-net-floor" x1="${hallOx}" x2="${hallOx + hallW}" y1="${netFloorY}" y2="${netFloorY}"/>`;
    parts.netRows += `<line class="fb flow-fb iso-net-floor-drop" x1="${fabricSpineX}" x2="${hallOx + hallW - 4}" y1="${netFloorY}" y2="${netFloorY}"/>`;

    const coldY = y + rh + 14;
    parts.cool += `<line class="cl flow-cl iso-chw-row" x1="${hallOx}" x2="${hallOx + hallW}" y1="${coldY}" y2="${coldY}"/>`;
    if (hasCdu && i < rows) {
      parts.cool += `<rect class="iso-cdu" x="${hallOx + hallW / 2 - 16}" y="${coldY - 5}" width="32" height="10" rx="1"/>`;
    }
    if (plan.coolingClass === "air" && i === Math.floor(rows / 2)) {
      parts.cool += `<rect class="iso-crah" x="${hallOx + hallW * 0.42}" y="${coldY - 6}" width="40" height="10" rx="1"/>`;
    }
  }

  parts.powerRows += `<line class="pw flow-pw iso-pw-floor-tap" x1="${feedAX}" x2="${hallOx}" y1="${bottomBusY}" y2="${bottomBusY}"/>`;
  if (dual) {
    parts.powerRows += `<line class="pw flow-pw pw-b iso-pw-floor-tap" x1="${feedBX}" x2="${hallOx}" y1="${bottomBusY + 9}" y2="${bottomBusY + 9}" stroke-dasharray="7 5"/>`;
  }

  parts.netRows += `<line class="fb flow-fb iso-net-bottom-tie" x1="${fabricSpineX}" x2="${hallOx}" y1="${bottomNetY}" y2="${bottomNetY}"/>`;

  const footY = hallOy + rows * rowPitch + rh + 38;
  parts.space += `<text class="iso-floor-label" x="${hallCx}" y="${footY}" text-anchor="middle">${formatNum(plan.racks)} racks · ${formatNum(plan.hallKw)} kW IT · ${formatNum(designSiteMw ?? 0, 2)} MW design</text>`;
  parts.space += `<text class="mu sm iso-floor-sub" x="${hallCx}" y="${footY + 16}" text-anchor="middle">Toggle layers · click a rack for detail</text>`;

  return parts;
}
