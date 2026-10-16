import { analyzeFacility } from "./facility.js";
import { renderProgramTab } from "../program/render.js";

export function renderFacilityStudio(plan, slots, optionalIds) {
  const f = analyzeFacility(plan, slots, optionalIds);
  renderProgramTab(plan, slots, optionalIds, f);
  return f;
}
