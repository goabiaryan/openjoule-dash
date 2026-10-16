import { computeCampusHallsOverviewLayout, computeSiteLayout, computeHallLayout } from "./scaleLayout.js";
import { renderCampusHallsOverviewLayers } from "./campusHallsOverview.js";
import { renderSiteBandLayers } from "./siteBand.js";
import { renderIsoHallLayers } from "./isoHall.js";

function markerDefs(mid) {
  return `<defs>
      <marker id="m-${mid}-pw" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--hot)"/></marker>
      <marker id="m-${mid}-cl" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--cold)"/></marker>
      <marker id="m-${mid}-fb" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--net)"/></marker>
    </defs>`;
}

function paintLayers(svgEl, svgId, layout, layerOrder) {
  const mid = svgId.replace(/[^a-z0-9]/gi, "") || "scale";
  const layers = layerOrder
    .map(([name, body]) => `<g class="hall-layer hall-layer-${name}">${body}</g>`)
    .join("");
  const padT = layout.viewPadTop || 0;
  const padB = layout.viewPadBottom || 0;
  svgEl.setAttribute("viewBox", `0 ${-padT} ${layout.W} ${layout.H + padT + padB}`);
  const tallCampus = svgId.includes("campus") || svgId.includes("site");
  svgEl.setAttribute("preserveAspectRatio", tallCampus ? "xMidYMin meet" : "xMidYMid meet");
  svgEl.innerHTML = `${markerDefs(mid)}${layers}`;
}

function drawCampusOverviewSvg(svgId, plan, slots, overlay) {
  const s = document.getElementById(svgId);
  if (!s) return;
  const layout = computeCampusHallsOverviewLayout(plan, slots, overlay);
  const overview = renderCampusHallsOverviewLayers(layout, plan, slots, overlay);
  paintLayers(s, svgId, layout, [["space", overview.space]]);
}

function drawSiteSvg(svgId, plan, slots, overlay) {
  const s = document.getElementById(svgId);
  if (!s) return;
  const layout = computeSiteLayout(plan);
  const site = renderSiteBandLayers(layout, plan, slots, overlay);
  paintLayers(s, svgId, layout, [
    ["space", site.space],
    ["power", site.power],
    ["cool", site.cool],
    ["net", site.net],
  ]);
}

function drawHallSvg(svgId, plan, slots, overlay) {
  const s = document.getElementById(svgId);
  if (!s) return;
  const layout = computeHallLayout(plan);
  const hall = renderIsoHallLayers(layout, plan, overlay, slots);
  paintLayers(s, svgId, layout, [
    ["space", hall.space],
    ["power", hall.power],
    ["cool", hall.cool],
    ["net", hall.net],
    ["power", hall.powerRows ?? ""],
    ["net", hall.netRows ?? ""],
    ["space-racks", hall.racks],
  ]);
}

export function drawScaleCampusDiagrams(plan, slots, overlay) {
  try {
    drawCampusOverviewSvg("svg-scale-campus", plan, slots, overlay);
    drawSiteSvg("svg-scale-site", plan, slots, overlay);
  } catch (err) {
    console.error("[Scale campus diagram]", err);
  }
}

export function drawScaleComposition(_legacyId, plan, slots, overlay) {
  try {
    drawScaleCampusDiagrams(plan, slots, overlay);
    drawHallSvg("svg-scale-hall", plan, slots, overlay);
  } catch (err) {
    console.error("[Scale diagram]", err);
    for (const id of ["svg-scale-campus", "svg-scale-site", "svg-scale-hall"]) {
      const s = document.getElementById(id);
      if (!s) continue;
      s.setAttribute("viewBox", "0 0 480 100");
      s.innerHTML = `<text x="24" y="52" class="mu" fill="var(--muted)">Scale diagram failed · see console</text>`;
    }
  }
}

export function drawScaleSiteDiagram(plan, slots, overlay) {
  drawSiteSvg("svg-scale-site", plan, slots, overlay);
}

export function drawScaleHallDiagram(plan, slots, overlay) {
  drawHallSvg("svg-scale-hall", plan, slots, overlay);
}
