import { coolingClassLabel } from "../build/plan.js";
import { designSiteMw } from "../build/program.js";
import { derivePlan, formatNum } from "../calc.js";
import { syncProgramFlow } from "../program/flowDrive.js";
import { renderFabricPanel } from "../scale/fabricPanel.js";
import { renderCompleteHallDiagram } from "../scale/completeHall.js";
import { deriveFabric } from "../scale/fabric.js";
import { bindCampusCapacity } from "../scale/campusCapacity.js";
import { bindScaleHallInteraction } from "../scale/hallInteraction.js";

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function scaleLabel(racks) {
  if (racks <= 8) return "Pod";
  if (racks <= 24) return "Hall";
  return "Tranche";
}

export function renderScaleTab(plan, slots, optionalIds, stats) {
  const d = derivePlan(plan);
  const fabric = deriveFabric(plan, slots, optionalIds);
  const siteMw = designSiteMw(plan, d);

  setText("size-title", plan.label || "Your build");
  setText(
    "size-sub",
    `${scaleLabel(d.racks)} · ${formatNum(d.racks)} racks · ${plan.rows}×${plan.racksPerRow} · ${coolingClassLabel(plan.coolingClass)}`,
  );

  setText(
    "scale-hall-caption",
    `Hall: ${formatNum(d.hallKw)} kW · ${formatNum(siteMw, 2)} MW · ${formatNum(fabric.leafCount)} leaf · ${plan.feedRedundancy} · layers / zoom / click rack`,
  );

  renderCompleteHallDiagram(plan, slots, optionalIds, stats);
  bindCampusCapacity(plan, slots, optionalIds, stats);
  bindScaleHallInteraction(plan, slots, optionalIds, fabric);
  renderFabricPanel(plan, slots, optionalIds);
  syncProgramFlow(plan, stats);
}
