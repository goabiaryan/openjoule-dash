/**
 * One white-space grid story for Program (plan), Scale iso, and site footprint.
 * Same rows × racks/row; aspect ratio drives campus box and iso pitch.
 */

import { getBlock } from "../catalog/blocks.js";

export function hallGrid(plan) {
  const rows = Math.max(1, plan?.rows ?? 4);
  const racksPerRow = Math.max(1, plan?.racksPerRow ?? 6);
  /** Width ÷ depth of rack block (aisles included in depth pitch on diagrams). */
  const aspect = racksPerRow / rows;
  return { rows, racksPerRow, aspect };
}

/** Campus plan rectangle · proportional to grid, not fixed % of road. */
export function campusHallSize(plan, roadH = 352) {
  const { rows, racksPerRow, aspect } = hallGrid(plan);
  const base = Math.min(220, 48 + racksPerRow * 14 + rows * 10);
  let hallW = Math.min(268, Math.round(base * Math.sqrt(aspect) * 1.15));
  let hallH = Math.round(hallW / aspect);
  const maxH = Math.round(roadH * 0.42);
  if (hallH > maxH) {
    hallH = maxH;
    hallW = Math.round(hallH * aspect);
  }
  hallW = Math.max(100, hallW);
  hallH = Math.max(56, hallH);
  return { hallW, hallH, rows, racksPerRow, aspect };
}

/** One repeatable hall from Build (same story as Scale isometric · not campus-total racks). */
export function campusHallModule(plan) {
  const racks = Math.max(1, plan.racks ?? (plan.rows ?? 4) * (plan.racksPerRow ?? 6));
  return {
    racks,
    hallKw: plan.hallKw ?? 0,
    areaM2: plan.areaM2 ?? racks * 3,
  };
}

/** Halls that fit campus IT target ÷ Build hall IT MW (no diagram cap). */
export function campusHallCountFromItMw(campusItMw, hallItMw) {
  if (!Number.isFinite(campusItMw) || campusItMw <= 0) return 1;
  if (!hallItMw || hallItMw <= 0) return 1;
  return Math.max(1, Math.round(campusItMw / hallItMw));
}

export function campusHallCount(plan, slots, scale = {}) {
  const module = campusHallModule(plan);
  const hallItMw = scale.hallItMw ?? module.hallKw / 1000;
  const campusItMw = scale.campusItMw ?? 30;
  return campusHallCountFromItMw(campusItMw, hallItMw);
}

/** Campus totals + per-footprint slices (each hall = same Build module). */
export function campusHallSlices(plan, slots, scale = {}) {
  const hallBlock = getBlock(slots?.hall);
  const module = campusHallModule(plan);
  const hallCount = campusHallCount(plan, slots, scale);
  const halls = [];
  for (let i = 0; i < hallCount; i++) {
    halls.push({
      index: i,
      title: hallCount > 1 ? `Data hall ${hallLabel(i)}` : "Secured data hall",
      racksEach: module.racks,
      kwEach: module.hallKw,
      areaEach: module.areaM2,
    });
  }
  const hallItMw = scale.hallItMw ?? module.hallKw / 1000;
  const campusItMw = scale.campusItMw ?? hallCount * hallItMw;
  return {
    hallCount,
    module,
    campusItMw,
    hallItMw,
    totalRacks: module.racks * hallCount,
    totalHallKw: module.hallKw * hallCount,
    nominalRacks: module.racks,
    hallBlockLabel: hallBlock?.label ?? hallBlock?.name ?? "Hall block",
    halls,
  };
}

export function hallLabel(i) {
  if (i < 26) return String.fromCharCode(65 + i);
  return String(i + 1);
}

/** Mini-grid sizing for campus overview SVG (viewBox height). */
export function computeCampusMiniGridMetrics(stripW, plan, hallCount) {
  const drawN = Math.max(1, hallCount);
  const cols = campusHallGridCols(drawN);
  const gridRows = Math.ceil(drawN / cols);
  const gap = 10;
  const labelBand = 14;
  const maxMiniW = Math.floor((stripW - (cols - 1) * gap) / cols);
  const aspect = hallGrid(plan).aspect;
  let miniW = Math.max(28, Math.min(88, maxMiniW));
  let miniH = Math.round(miniW / aspect);
  const maxMiniH = gridRows > 5 ? 40 : 52;
  if (miniH > maxMiniH) {
    miniH = maxMiniH;
    miniW = Math.max(28, Math.round(miniH * aspect));
  }
  const rowPitch = miniH + gap + labelBand;
  const stripTitleH = 28;
  const contentBottom =
    gridRows > 0 ? stripTitleH + (gridRows - 1) * rowPitch + miniH + labelBand : stripTitleH;
  const totalH = contentBottom + 10;
  return { cols, gridRows, miniW, miniH, gap, labelBand, rowPitch, stripTitleH, totalH, drawN };
}

export function campusHallGridCols(hallCount) {
  if (hallCount <= 1) return 1;
  if (hallCount <= 4) return 2;
  if (hallCount <= 9) return 3;
  if (hallCount <= 16) return 4;
  return 5;
}

/** Max hall footprints on Scale site plan (diagram 2). */
export const SITE_CAMPUS_DIAGRAM_MAX_HALLS = 12;

/** Positions for phased campus halls inside the ring road. */
export function layoutCampusHalls(plan, slots, roadW, roadY, roadH, hallCx, campusScale = {}) {
  const campus = campusHallSize(plan, roadH);
  const { hallCount, halls: slices } = campusHallSlices(plan, slots, campusScale);
  const siteMax = campusScale.sitePlanMaxHalls ?? SITE_CAMPUS_DIAGRAM_MAX_HALLS;
  const drawCount = Math.min(hallCount, siteMax);
  const gap = drawCount >= 5 ? 8 : 12;
  const cols = campusHallGridCols(drawCount);
  const gridRows = Math.ceil(drawCount / cols);
  const maxW = roadW * 0.8;
  const maxH = roadH * 0.66;
  const aspect = campus.aspect ?? campus.hallW / campus.hallH;
  const minW = 52;
  const minH = Math.max(36, Math.round(minW / aspect));
  let w = campus.hallW;
  let h = campus.hallH;
  for (let pass = 0; pass < 4; pass++) {
    const blockW = cols * w + (cols - 1) * gap;
    const blockH = gridRows * h + (gridRows - 1) * gap;
    const fit = Math.min(1, maxW / blockW, maxH / blockH);
    w = Math.max(minW, Math.floor(w * fit));
    h = Math.max(minH, Math.floor(h * fit));
    if (w / h > aspect * 1.08) h = Math.max(minH, Math.round(w / aspect));
    else if (h / w > (1 / aspect) * 1.08) w = Math.max(minW, Math.round(h * aspect));
  }
  const blockW = cols * w + (cols - 1) * gap;
  const blockH = gridRows * h + (gridRows - 1) * gap;
  const hallBannerH = hallCount > 1 ? 34 : 0;
  const top =
    roadY +
    hallBannerH +
    Math.max(32, Math.round((roadH - blockH - hallBannerH) * 0.34));
  const left = hallCx - blockW / 2;
  const halls = [];
  for (let i = 0; i < drawCount; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = left + col * (w + gap) + w / 2;
    const y = top + row * (h + gap);
    const slice = slices[i];
    halls.push({
      cx,
      y,
      w,
      h,
      index: i,
      title: slice.title,
      racksEach: slice.racksEach,
      kwEach: slice.kwEach,
    });
  }
  return {
    halls,
    hallCount,
    siteDrawCount: drawCount,
    sitePlanTruncated: hallCount > drawCount,
    bounds: {
      left,
      top,
      width: blockW,
      height: blockH,
      right: left + blockW,
      bottom: top + blockH,
      hallBannerH,
    },
  };
}

/** Isometric rack pitch so block aspect matches plan grid. */
export function isoRackMetrics(plan) {
  const { rows, racksPerRow, aspect } = hallGrid(plan);
  const rGap = 7;
  const rh = 26;
  const skewX = 16;
  const skewY = 9;
  let rw = Math.min(40, Math.max(22, Math.floor(240 / racksPerRow - rGap)));
  let hallW = racksPerRow * (rw + rGap) - rGap;
  const targetDepth = hallW / aspect;
  let rowPitch =
    rows > 1 ? Math.max(rh + 18, Math.round((targetDepth - rh) / (rows - 1))) : rh + 20;
  let hallDepth = (rows - 1) * rowPitch + rh;
  const drift = hallW / hallDepth - aspect;
  if (Math.abs(drift) > 0.08 && rows > 1) {
    hallDepth = hallW / aspect;
    rowPitch = Math.round((hallDepth - rh) / (rows - 1));
    hallDepth = (rows - 1) * rowPitch + rh;
  }
  return { rows, racksPerRow, rw, rh, rGap, rowPitch, skewX, skewY, hallW, hallDepth, aspect };
}

/** SVG schematic inside site hall box (plan view · matches Program aisle logic). */
export function siteHallInteriorSvg(x, y, w, h, plan) {
  const { rows, racksPerRow } = hallGrid(plan);
  const pad = 12;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2 - 28;
  const ix = x + pad;
  const iy = y + pad + 22;
  const rackW = Math.max(3, (innerW - 20) / racksPerRow - 2);
  const rowH = Math.max(6, innerH / rows);
  let s = `<g class="site-hall-interior">`;
  s += `<rect class="site-hall-mep site-hall-mep-power" x="${ix - 4}" y="${iy}" width="8" height="${innerH}" rx="1"/>`;
  s += `<rect class="site-hall-mep site-hall-mep-cool" x="${ix + innerW - 4}" y="${iy}" width="8" height="${innerH}" rx="1"/>`;
  for (let i = 0; i < rows; i++) {
    const ry = iy + i * rowH;
    if (i % 2 === 0) {
      s += `<rect class="aisle-hot" x="${ix}" y="${ry - 3}" width="${innerW}" height="4"/>`;
    }
    s += `<rect class="aisle-cold" x="${ix}" y="${ry + rowH - 6}" width="${innerW}" height="4"/>`;
    for (let j = 0; j < racksPerRow; j++) {
      const rx = ix + 10 + j * (rackW + 2);
      s += `<rect class="site-hall-rack" x="${rx}" y="${ry + 2}" width="${rackW}" height="${Math.max(4, rowH - 10)}"/>`;
    }
  }
  s += `</g>`;
  return s;
}
