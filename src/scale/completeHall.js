import { derivePlan, tons } from "../calc.js";
import { designSiteMw } from "../build/program.js";
import { campusScaleFromPlan } from "./campusCapacity.js";
import { deriveFabric } from "./fabric.js";
import { drawScaleComposition } from "./scaleComposition.js";

export function buildScaleOverlay(plan, slots, optionalIds, stats) {
  const d = derivePlan(plan);
  return {
    fabric: deriveFabric(plan, slots, optionalIds),
    optionalIds,
    designSiteMw: designSiteMw(plan, d),
    hallLoopLpm: stats?.hallLoopLpm ?? Math.round((plan.hallKw * 60) / (4.186 * 10)),
    heatTons: stats?.heatTons ?? Math.round(tons(plan.hallKw)),
    ...campusScaleFromPlan(plan),
  };
}

export function renderCompleteHallDiagram(plan, slots, optionalIds, stats) {
  drawScaleComposition("svg-scale-hall", plan, slots, buildScaleOverlay(plan, slots, optionalIds, stats));
}
