import { getBlock } from "../catalog/blocks.js";
import { formatNum } from "../calc.js";
import { campusHallSlices, layoutCampusHalls, siteHallInteriorSvg } from "../hall/hallFootprint.js";
import { themedCallout, calloutHeight, calloutWidth, textInBox } from "./diagramLabels.js";

function coolingClassShort(c) {
  if (c === "air") return "Air-cooled";
  if (c === "air_rear_door") return "Rear-door air";
  if (c === "direct_liquid") return "Direct liquid";
  return String(c ?? "-");
}

function plantCalloutTitle(spec) {
  const rej = spec?.heatRejection ?? "Chiller plant";
  const s = String(rej);
  if (/^chiller/i.test(s)) return "Chiller plant";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Man door geometry · shared by footprint, labels, and ped path. */
export function hallManDoor(cx, y, w, h) {
  const x = cx - w / 2;
  const rectX = x + w - 28;
  const rectY = y + h - 20;
  return {
    rectX,
    rectY,
    cx: rectX + 12,
    cy: rectY + 7,
    labelX: x + w + 28,
    labelY: rectY + 10,
  };
}

/** Chiller icon · all geometry stays inside [x,y]..[x+w,y+h] (no clipped fans/coil). */
function chillerGlyph(x, y, w, h) {
  const fanR = 6;
  const fanRowY = y + fanR + 6;
  const bodyY = y + fanR * 2 + 14;
  const bodyH = Math.max(28, h - (bodyY - y) - 6);
  let fans = "";
  for (let i = 0; i < 3; i++) {
    fans += `<circle class="plant-fan" cx="${x + w * (0.22 + i * 0.28)}" cy="${fanRowY}" r="${fanR}"/>`;
  }
  const coilMidY = bodyY + bodyH * 0.45;
  return `<g class="plant-chiller">
    ${fans}
    <rect class="plant-body" x="${x}" y="${bodyY}" width="${w}" height="${bodyH}" rx="2"/>
    <path class="plant-coil" d="M${x + 10} ${bodyY + bodyH - 4} L${x + w / 2} ${coilMidY} L${x + w - 10} ${bodyY + bodyH - 4}" fill="none"/>
  </g>`;
}

function substationGlyph(x, y, w, h) {
  return `<g class="site-sub">
    <rect class="sub-pad" x="${x}" y="${y}" width="${w}" height="${h}" rx="2"/>
    <circle class="sub-coil" cx="${x + w * 0.33}" cy="${y + h * 0.5}" r="10"/>
    <circle class="sub-coil" cx="${x + w * 0.67}" cy="${y + h * 0.5}" r="10"/>
  </g>`;
}

function generatorGlyph(x, y, w, h) {
  return `<g class="site-gen">
    <rect class="gen-pad" x="${x}" y="${y}" width="${w}" height="${h}" rx="2"/>
    <rect class="gen-engine" x="${x + 8}" y="${y + 14}" width="${w * 0.55}" height="${h - 22}" rx="1"/>
    <rect class="gen-rad" x="${x + w * 0.68}" y="${y + 18}" width="${w * 0.26}" height="${h - 28}" rx="1"/>
  </g>`;
}

function parkedCar(cx, cy, angle = -38) {
  return `<g class="site-car" transform="translate(${cx} ${cy}) rotate(${angle})">
    <rect class="site-car-body" x="-12" y="-5" width="24" height="10" rx="2"/>
    <rect class="site-car-cab" x="-2" y="-5" width="9" height="10" rx="1"/>
  </g>`;
}

function exteriorParking(cx, y, count, slotW) {
  const span = count * (slotW + 6) - 6;
  const x = cx - span / 2;
  let s = `<g class="site-parking site-parking-exterior">`;
  for (let i = 0; i < count; i++) {
    const px = x + i * (slotW + 6);
    const slotCx = px + slotW / 2;
    const slotCy = y + 9;
    s += `<rect class="park-slot" x="${px}" y="${y}" width="${slotW}" height="18" transform="rotate(-38 ${slotCx} ${slotCy})"/>`;
    s += parkedCar(slotCx, slotCy, -38);
  }
  s += `<text class="site-park-label" x="${cx}" y="${y + 44}" text-anchor="middle">Visitor parking · outside secure fence</text></g>`;
  return s;
}

function gateLabelSvg(label, x, y, anchor) {
  const lines = Array.isArray(label) ? label : [label];
  const anchorAttr = anchor ? ` text-anchor="${anchor}"` : "";
  if (lines.length === 1) {
    return `<text class="site-gate-label mu sm" x="${x}" y="${y}"${anchorAttr}>${lines[0]}</text>`;
  }
  let s = `<text class="site-gate-label mu sm" x="${x}" y="${y}"${anchorAttr}>`;
  for (let i = 0; i < lines.length; i++) {
    s += `<tspan x="${x}" dy="${i === 0 ? 0 : 11}">${lines[i]}</tspan>`;
  }
  return s + `</text>`;
}

function vehicleGateGraphic(gateX, gateY, label, vertical = false) {
  if (vertical) {
    const labelX = gateX + 12;
    const labelY = gateY + 14;
    return `<g class="site-vehicle-gate site-vehicle-gate-vert">
      <rect class="site-gate-post" x="${gateX - 2}" y="${gateY - 10}" width="5" height="20"/>
      <rect class="site-gate-post" x="${gateX - 2}" y="${gateY + 24}" width="5" height="20"/>
      <rect class="site-gate-arm" x="${gateX - 1}" y="${gateY + 8}" width="4" height="28"/>
      ${gateLabelSvg(label, labelX, labelY)}
    </g>`;
  }
  return `<g class="site-vehicle-gate">
    <rect class="site-gate-post" x="${gateX - 46}" y="${gateY - 4}" width="5" height="18"/>
    <rect class="site-gate-post" x="${gateX + 41}" y="${gateY - 4}" width="5" height="18"/>
    <rect class="site-gate-arm" x="${gateX - 38}" y="${gateY + 2}" width="76" height="4" rx="1"/>
    ${gateLabelSvg(label, gateX, gateY - 10, "middle")}
  </g>`;
}

function securedHallFootprint(cx, y, w, h, plan, interiorSvg, meta = {}) {
  const x = cx - w / 2;
  const door = hallManDoor(cx, y, w, h);
  const cool = coolingClassShort(plan.coolingClass);
  const title = meta.title ?? "Secured data hall";
  const showStats = meta.showStats === true;
  const statsLine =
    meta.statsLine ??
    `${formatNum(plan.racks)} racks · ${plan.rows}×${plan.racksPerRow} · ${formatNum(plan.hallKw)} kW IT`;
  const showDoor = meta.showManDoor !== false;
  const statsSvg = showStats
    ? `<rect class="site-hall-stats-bg" x="${x + 3}" y="${y + h - 17}" width="${w - 6}" height="14" rx="2"/>
    <text class="site-hall-stats" x="${cx}" y="${y + h - 7}" text-anchor="middle">${statsLine}</text>`
    : "";
  return `<g class="site-hall-plan site-secured">
    <rect class="site-secure-fence" x="${x - 10}" y="${y - 10}" width="${w + 20}" height="${h + 20}" rx="2"/>
    <rect class="site-hall-foot" x="${x}" y="${y}" width="${w}" height="${h}" rx="2"/>
    ${interiorSvg}
    <text class="site-hall-t" x="${cx}" y="${y + 12}" text-anchor="middle">${title}</text>
    <text class="site-hall-cool-tag mu sm" x="${cx}" y="${y + 26}" text-anchor="middle">${cool}</text>
    ${statsSvg}
    ${
      showDoor
        ? `<rect class="site-man-door" x="${door.rectX}" y="${door.rectY}" width="24" height="14"/>
    <text class="site-man-door-label sm" x="${door.labelX}" y="${door.labelY}" text-anchor="start">NOC / man door</text>`
        : ""
    }
  </g>`;
}

export function renderSiteBandLayers(layout, plan, slots, overlay) {
  const site = getBlock(slots.site);
  const optionalIds = overlay.optionalIds;
  const { W, hallCx } = layout;
  const roadY = layout.roadY ?? 40;
  const roadH = layout.roadH ?? 352;
  const parkY = layout.parkY ?? roadY + roadH + 44;
  const yOut = layout.yOut ?? layout.H - 54;
  const bandH = layout.H ?? roadY + roadH + 280;
  const parkTop = roadY + roadH;
  const mw = overlay.designSiteMw ?? 0;
  const dual = plan.feedRedundancy === "2N";
  const showGen = dual || site?.spec?.upsTopology === "2N" || site?.spec?.upsTopology === "N+1";
  const parts = { space: "", power: "", cool: "", net: "" };

  const roadX = 48;
  const roadW = W - 96;

  parts.space += `<rect class="site-band-bg" x="0" y="0" width="${W}" height="${bandH}"/>`;
  parts.space += `<rect class="site-road" x="${roadX}" y="${roadY}" width="${roadW}" height="${roadH}" rx="16"/>`;
  parts.space += `<text class="site-fence-note mu sm" x="${roadX + 16}" y="${roadY + 22}">Secure campus · ring road · utility yards inside fence · parking outside</text>`;

  const campusScale = {
    campusItMw: overlay.campusItMw,
    hallItMw: overlay.hallItMw,
  };
  const { halls, hallCount, siteDrawCount, sitePlanTruncated, bounds } = layoutCampusHalls(
    plan,
    slots,
    roadW,
    roadY,
    roadH,
    hallCx,
    campusScale,
  );
  let primaryDoor = null;
  for (const hall of halls) {
    const hx = hall.cx - hall.w / 2;
    const interior = siteHallInteriorSvg(hx, hall.y, hall.w, hall.h, plan);
    const showManDoor = hall.index === 0 || hallCount === 1;
    parts.space += securedHallFootprint(hall.cx, hall.y, hall.w, hall.h, plan, interior, {
      title: hall.title,
      showManDoor,
    });
    if (hall.index === 0) primaryDoor = hallManDoor(hall.cx, hall.y, hall.w, hall.h);
  }
  const door = primaryDoor ?? hallManDoor(halls[0].cx, halls[0].y, halls[0].w, halls[0].h);
  const hallX = bounds.left;
  const hallY = bounds.top;
  const hallW = bounds.width;
  const hallH = bounds.height;
  const hallEast = bounds.right;
  const campusCx = bounds.left + bounds.width / 2;
  const hallEastX = () => hallEast;

  const moduleLines = [
    "Each hall module",
    `${formatNum(plan.racks)} racks · ${plan.rows}×${plan.racksPerRow}`,
    `${formatNum(plan.hallKw, 0)} kW IT · ${coolingClassShort(plan.coolingClass)}`,
  ];
  const moduleCallH = calloutHeight(moduleLines.length);
  const moduleCallW = calloutWidth(moduleLines);
  const moduleX = roadX + roadW - moduleCallW - 16;
  const moduleY = roadY + roadH - moduleCallH - 18;
  parts.space += themedCallout(moduleX, moduleY, moduleLines, "space");

  const powerX = roadX + 28;
  let powerY = roadY + Math.round(roadH * 0.18);
  const glyphW = 84;
  const subH = 52;
  const subCenterY = powerY + subH / 2;
  parts.power += substationGlyph(powerX, powerY, glyphW, subH);
  const subCallH = calloutHeight(2);
  const campusItMw = overlay.campusItMw ?? (overlay.hallItMw ?? plan.hallKw / 1000) * hallCount;
  parts.power += themedCallout(
    powerX - 8,
    powerY + subH + 10,
    ["Substation", `${formatNum(campusItMw, 1)} MW IT campus · MV`],
    "power",
  );
  powerY += subH + subCallH + 28;

  let genBottomY = powerY;
  if (showGen) {
    const genH = 48;
    parts.power += generatorGlyph(powerX, powerY, glyphW, genH);
    parts.power += themedCallout(powerX - 8, powerY + genH + 10, ["Standby gen", "Utility yard"], "power");
    genBottomY = powerY + genH;
    powerY += genH + calloutHeight(2) + 28;
  }

  /** West MV bus · substation → hall (mid-yard, not south parking line). */
  const mvBusY = subCenterY;
  const mvTapY = hallY + Math.round(hallH * 0.42);
  parts.power += `<line class="pw flow-pw site-mv-bus" x1="${powerX + glyphW}" x2="${hallX - 8}" y1="${mvBusY}" y2="${mvBusY}"/>`;
  if (showGen) {
    parts.power += `<path class="pw flow-pw site-gen-tie" d="M${powerX + glyphW * 0.5} ${genBottomY} V${mvBusY}" fill="none" stroke-dasharray="4 5"/>`;
  }
  const feedSiteAX = hallX - 18;
  const feedSiteBX = hallX - 4;
  parts.power += `<circle class="feed-port feed-a" cx="${feedSiteAX}" cy="${mvBusY}" r="4.5"/>`;
  parts.power += `<text class="pw-feed-label pw-a-label" x="${feedSiteAX}" y="${mvBusY - 10}" text-anchor="middle">A</text>`;
  if (dual) {
    parts.power += `<circle class="feed-port feed-b" cx="${feedSiteBX}" cy="${mvBusY}" r="4.5"/>`;
    parts.power += `<text class="pw-feed-label pw-b-label" x="${feedSiteBX}" y="${mvBusY - 10}" text-anchor="middle">B</text>`;
  }
  parts.power += `<line class="pw flow-pw site-hall-feed-tap" x1="${hallX}" x2="${hallX}" y1="${mvBusY}" y2="${mvTapY}"/>`;
  parts.power += `<text class="pw-feed-label site-feed-in-fence" x="${hallX - 12}" y="${mvBusY - 18}" text-anchor="end">MV A/B · west bus · from substation</text>`;

  const plantW = 96;
  const plantX = roadX + roadW - plantW - 36;
  const plantY = roadY + Math.round(roadH * 0.16);
  const chillerH = Math.round(roadH * 0.2);
  parts.cool += chillerGlyph(plantX, plantY, plantW, chillerH);
  const plantCallY = plantY + chillerH + 12;
  const plantCallH = calloutHeight(2);
  parts.cool += themedCallout(
    plantX - 6,
    plantCallY,
    [plantCalloutTitle(site?.spec), `${formatNum(overlay.heatTons ?? 0)} t refrigeration`],
    "cool",
  );
  parts.cool += `<text class="site-chw-label diagram-inbox diagram-inbox-cool" x="${plantX + plantW / 2}" y="${plantCallY + plantCallH + 12}" text-anchor="middle">CHW · east liquid rail</text>`;
  parts.space += `<text class="site-utility-note mu sm" x="${plantX + plantW - 4}" y="${plantCallY + plantCallH + 28}" text-anchor="end">Mechanical loading yard</text>`;

  if (optionalIds?.has("cool-cdu")) {
    const cduLines = ["CDU in program"];
    const cduW = calloutWidth(cduLines);
    parts.cool += themedCallout(plantX - cduW + plantW - 8, plantY - calloutHeight(1) - 6, cduLines, "cool");
  }

  /** CHW · plant to hall east (liquid MEP), corridor east of hall — not through ME. */
  const liquidRailY = hallY + Math.round(hallH * 0.48);
  const chwCorridorX = hallEastX() + 14;
  const plantMidY = plantY + Math.round(chillerH * 0.72);
  parts.cool += `<path class="cl flow-cl site-chw" d="M${plantX} ${plantMidY} L${chwCorridorX} ${plantMidY} L${chwCorridorX} ${liquidRailY} L${hallEastX()} ${liquidRailY}" fill="none"/>`;

  /** Meet-me · southeast inside ring, below hall — away from chiller stack. */
  const meW = 68;
  const meH = 26;
  const meX = hallEastX() - meW - 6;
  const meY = hallY + hallH + 20;
  parts.net += `<rect class="net-me" x="${meX}" y="${meY}" width="${meW}" height="${meH}" rx="2"/>`;
  parts.net += textInBox(meX + meW / 2, meY, meW, meH, ["Meet-me"], "net");
  parts.net += `<text class="site-net-yard-label sm" x="${meX - 28}" y="${meY + 6}" text-anchor="end">
    <tspan x="${meX - 28}" dy="0">Carrier entry</tspan>
    <tspan x="${meX - 28}" dy="11">· not plant</tspan>
  </text>`;

  if (optionalIds?.has("net-leaf-64")) {
    parts.net += themedCallout(meX - 4, meY + meH + 10, ["Leaf add-on"], "net");
  }

  /** Fiber · fence-side entry up east face (never crosses chiller yard). */
  const fiberEntryY = hallY + Math.round(hallH * 0.58);
  parts.net += `<path class="fb flow-fb site-fiber" d="M${meX + meW / 2} ${meY} L${meX + meW / 2} ${hallY + hallH + 6} L${chwCorridorX + 10} ${hallY + hallH + 6} L${chwCorridorX + 10} ${fiberEntryY} L${hallEastX()} ${fiberEntryY}" fill="none" stroke-dasharray="5 4"/>`;

  const gateX = campusCx;
  const gateY = parkTop - 14;
  parts.space += vehicleGateGraphic(gateX, gateY, "Main vehicle gate");
  parts.space += vehicleGateGraphic(
    roadX + roadW - 6,
    bounds.top + Math.round(bounds.height * 0.55),
    ["Service", "gate"],
    true,
  );

  const parkCount = Math.min(8, Math.max(5, Math.floor(plan.areaM2 / 120)));
  parts.space += exteriorParking(campusCx, parkY, parkCount, 16);
  const { totalRacks } = campusHallSlices(plan, slots, campusScale);
  if (hallCount > 1) {
    const shown =
      sitePlanTruncated
        ? `${formatNum(hallCount)} halls · ${formatNum(siteDrawCount)} shown (A–${String.fromCharCode(64 + siteDrawCount)}) · `
        : `${formatNum(hallCount)} halls · `;
    const bannerH = bounds.hallBannerH ?? 34;
    parts.space += `<text class="site-hall-count-note" x="${campusCx}" y="${bounds.top - bannerH + 16}" text-anchor="middle">${shown}${formatNum(totalRacks)} racks campus · ${formatNum(plan.racks)} / hall</text>`;
  }

  const pedFromX = roadX + 32;
  const fenceSouth = hallY + hallH + 10;
  parts.space += `<path class="site-ped-route" d="M${pedFromX} ${parkY + 8} L${pedFromX} ${fenceSouth} L${door.cx} ${fenceSouth} L${door.cx} ${door.cy}" fill="none"/>`;
  parts.space += `<text class="site-ped-label sm" x="${pedFromX + 4}" y="${parkY + 50}">
    <tspan x="${pedFromX + 4}" dy="0">Pedestrian · NOC / man door</tspan>
    <tspan x="${pedFromX + 4}" dy="11">(not vehicle gate)</tspan>
  </text>`;

  const serviceStripH = layout.serviceBandH ?? 72;
  const serviceY = layout.serviceY ?? yOut - serviceStripH / 2;
  const captionX = roadX + roadW / 2;

  parts.space += `<rect class="site-service-strip" x="${roadX}" y="${serviceY}" width="${roadW}" height="${serviceStripH}" rx="2"/>`;
  parts.space += `<text class="site-bridge-label" x="${captionX}" y="${yOut + 2}" text-anchor="middle">Hall diagram continues ↓</text>`;
  parts.space += `<text class="site-south-note mu sm" x="${captionX}" y="${parkTop + 18}" text-anchor="middle">Parking &amp; public yard outside fence · power from west substation only</text>`;

  return parts;
}
