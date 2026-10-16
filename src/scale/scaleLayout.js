import { campusHallSlices, computeCampusMiniGridMetrics, isoRackMetrics } from "../hall/hallFootprint.js";

/** Shared hall geometry for site plan + isometric hall (separate SVGs). */
function computeScaleCore(plan) {
  const iso = isoRackMetrics(plan);
  const { rows, racksPerRow, rw, rh, rGap, rowPitch, skewX, skewY, hallW, hallDepth } = iso;
  const netShelfH = 44;
  const trayLift = 30;
  const feedGutter = 188;

  const W = Math.max(1120, feedGutter + hallW + skewX + 300);
  const hallOx = feedGutter + Math.floor((W - feedGutter - hallW - skewX - 80) / 2);
  const hallCx = hallOx + hallW / 2;
  const feedAX = hallOx - 64;
  const feedBX = feedAX + 18;
  const labelColX = feedAX - 78;
  const siteCx = W / 2;
  const netEntryX = hallCx;

  return {
    rows,
    racksPerRow,
    netShelfH,
    rw,
    rh,
    rGap,
    rowPitch,
    skewX,
    skewY,
    hallOx,
    hallW,
    hallDepth,
    trayLift,
    feedAX,
    feedBX,
    netEntryX,
    W,
    siteCx,
    hallCx,
    feedGutter,
    labelColX,
    viewPadTop: 10,
  };
}

/** Campus hall overview (diagram 1) · mini campus grid from capacity slider. */
export function computeCampusHallsOverviewLayout(plan, slots, overlay = {}) {
  const core = computeScaleCore(plan);
  const scale = {
    campusItMw: overlay.campusItMw,
    hallItMw: overlay.hallItMw,
    maxDiagramHalls: overlay.maxDiagramHalls,
  };
  const { hallCount } = campusHallSlices(plan, slots, scale);
  const pad = 28;
  const headerY = 28;
  const summaryY = 68;
  const stripTop = summaryY + 22;
  const stripW = core.W - pad * 2;
  const miniMetrics = computeCampusMiniGridMetrics(stripW, plan, hallCount);
  const footerY = stripTop + miniMetrics.totalH + 18;
  const minDiagramH = Math.round(core.W * 0.4);
  const H = Math.max(minDiagramH, footerY + 20);
  return {
    W: core.W,
    H,
    pad,
    headerY,
    summaryY,
    stripTop,
    footerY,
    miniMetrics,
    viewPadTop: 6,
    viewPadBottom: 12,
  };
}

/** Plan-view campus strip (diagram 2) · tall zones: campus · parking · service entry. */
export function computeSiteLayout(plan) {
  const core = computeScaleCore(plan);
  const roadY = 40;
  const roadH = 408;
  const parkGap = 44;
  const parkBandH = 108;
  const serviceGap = 28;
  const serviceBandH = 72;
  const bottomPad = 16;
  const parkY = roadY + roadH + parkGap;
  const serviceY = parkY + parkBandH + serviceGap;
  const yOut = serviceY + serviceBandH / 2;
  const H = serviceY + serviceBandH + bottomPad;
  const siteH = roadY + roadH;
  const utilBusY = roadY + roadH - 10;

  return {
    ...core,
    siteH,
    roadY,
    roadH,
    parkY,
    serviceY,
    serviceBandH,
    yOut,
    utilBusY,
    siteGap: 0,
    hallTop: siteH,
    hallOy: siteH,
    H,
    viewPadBottom: 12,
    hallStandalone: false,
    serviceEntryY: yOut,
    shelfY: siteH,
  };
}

/** Isometric white-space hall (diagram 2) · rack block centered in viewBox. */
export function computeHallLayout(plan) {
  const core = computeScaleCore(plan);
  const { hallW, hallDepth, skewX, netShelfH, trayLift, skewY } = core;

  const hallTop = 12;
  const bridgeY = 5;
  const shelfY = hallTop + 12;
  const hallOy = shelfY + netShelfH + 20;
  const serviceEntryY = hallTop + 8;
  const H = hallOy + hallDepth + skewY + trayLift + 100;

  const W = Math.max(720, hallW + skewX + 268);
  const hallOx = W / 2 - hallW / 2;
  const hallCx = W / 2;
  const feedAX = hallOx - 64;
  const feedBX = feedAX + 18;
  const labelColX = feedAX - 78;
  const netEntryX = hallCx;

  return {
    ...core,
    W,
    hallOx,
    hallCx,
    feedAX,
    feedBX,
    labelColX,
    netEntryX,
    siteH: 0,
    siteGap: 0,
    hallTop,
    bridgeY,
    shelfY,
    hallOy,
    H,
    hallStandalone: true,
    serviceEntryY,
    viewPadTop: 14,
  };
}

/** @deprecated Combined layout · use computeSiteLayout + computeHallLayout. */
export function computeScaleCompositionLayout(plan) {
  const site = computeSiteLayout(plan);
  const hall = computeHallLayout(plan);
  return {
    ...hall,
    siteH: site.siteH,
    siteGap: 44,
    hallTop: site.siteH + 44,
    hallOy: site.siteH + 44 + hall.netShelfH + 18,
    shelfY: site.siteH + 44 + 6,
    serviceEntryY: site.siteH - 2,
    H: site.siteH + 44 + hall.H - hall.hallTop,
    hallStandalone: false,
  };
}

export function rackPlanOrigin(layout, row, col) {
  const x = layout.hallOx + col * (layout.rw + layout.rGap);
  const y = layout.hallOy + row * layout.rowPitch;
  return { x, y };
}
