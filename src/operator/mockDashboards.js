import { mountOperateSimulator, stopOperateSimulator } from "./operateSimulator.js";

export function renderMockDashboards(plan) {
  const root = document.getElementById("operate-dashboards");
  if (!root) return;
  mountOperateSimulator(plan, root);
}

export { stopOperateSimulator };
