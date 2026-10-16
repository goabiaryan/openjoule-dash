import { hallGrid } from "../hall/hallFootprint.js";

/** Shared hall floor geometry from plan (Program plan view). Grid: hallFootprint.js (same rows×cols as Scale). */
export function computeHallLayout(plan, opts = {}) {
  const complete = opts.complete === true;
  const { rows, racksPerRow } = hallGrid(plan);

  const hallInnerX = complete ? 180 : 150;
  const hallboxY = 12;
  const aisleX = complete ? 252 : 222;
  const bannerBandH = complete ? 46 : 0;
  const netZoneY = complete ? hallboxY + bannerBandH + 12 : 22;
  const netZoneH = complete ? 50 : 56;
  const topY = complete ? netZoneY + netZoneH + 28 : 108;
  const minRowH = complete ? 62 : 44;
  let rowH = complete ? 92 : 68;
  const captionPad = complete ? 68 : 48;
  const maxViewH = complete ? 1040 : 680;
  const rackAreaW = complete ? 440 : 334;

  let contentBottom = topY + rows * rowH + 14;
  if (contentBottom + captionPad > maxViewH) {
    rowH = Math.max(minRowH, Math.floor((maxViewH - topY - captionPad) / rows));
    contentBottom = topY + rows * rowH + 14;
  }

  const H = Math.max(complete ? 480 : 440, contentBottom + captionPad);
  const hallboxH = H - hallboxY - 12;

  const rackW = Math.min(complete ? 80 : 54, Math.max(complete ? 16 : 10, Math.floor(rackAreaW / racksPerRow)));
  const rackSpan = rackW * racksPerRow;
  const aisleW = Math.max(complete ? 440 : 358, rackSpan + (complete ? 40 : 28));
  const rackX0 = aisleX + Math.floor((aisleW - rackSpan) / 2);
  const rackH = Math.min(complete ? 54 : 34, Math.max(complete ? 24 : 18, rowH - (complete ? 32 : 28)));
  const aisleEnd = aisleX + aisleW;
  const sideBoxW = 122;
  /* Power west · CHW plant east of rows · fabric trunk beyond plant (matches Scale hall) */
  const clBusX = aisleEnd + (complete ? 12 : 10);
  const coolBoxX = clBusX + (complete ? 16 : 14);
  const fabricX = coolBoxX + sideBoxW + (complete ? 22 : 18);
  const hallboxW = Math.max(complete ? 620 : 556, fabricX + 24 - hallInnerX);
  const W = Math.max(complete ? 960 : 720, hallInnerX + hallboxW + 24);
  const hallMidX = aisleX + aisleW / 2;
  const rowLabelX = Math.min(W - 52, aisleEnd + 8);

  const busY = [];
  const coolBusY = [];
  for (let i = 0; i < rows; i++) {
    const rowY = topY + i * rowH;
    if (complete) {
      busY.push(rowY - 14);
      coolBusY.push(rowY + rackH + 12);
    } else {
      busY.push(rowY + (i % 2 === 0 ? rackH : 0));
      coolBusY.push(rowY + (i % 2 === 0 ? rackH : 0));
    }
  }

  const sideBoxH = Math.min(complete ? 128 : 110, Math.max(88, hallboxH * 0.22));
  const powerBoxY = hallboxY + (complete ? 78 : 72);
  const clFeedY = Math.min(hallboxY + hallboxH - 40, topY + rows * rowH * 0.55);
  const coolBoxY = Math.min(
    Math.max(powerBoxY + sideBoxH + 16, clFeedY - Math.round(sideBoxH * 0.48)),
    hallboxY + hallboxH - sideBoxH - 10,
  );

  const netZoneW = Math.min(aisleW - 12, complete ? 420 : 346);
  const footerY = contentBottom + (complete ? 38 : 18);
  const viewPadTop = complete ? 6 : 0;

  return {
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
    clFeedY,
    pwBusX: complete ? 210 : 196,
    clBusX,
    coolBoxX,
    sideBoxW,
    netZoneW,
    netZoneX: aisleX + (aisleW - netZoneW) / 2,
    netZoneY,
    netZoneH,
    bannerBandH,
    footerY,
    viewPadTop,
    complete,
  };
}
