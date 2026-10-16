import { coolingClassLabel } from "../build/plan.js";
import { designSiteMw } from "../build/program.js";
import { derivePlan, formatNum } from "../calc.js";
import { monitorDomainCards, operateToolsHtml } from "./monitorDomains.js";
import { renderMockDashboards, stopOperateSimulator } from "./mockDashboards.js";

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

export function renderOperateTab(plan, slots, optionalIds) {
  stopOperateSimulator();
  const d = derivePlan(plan);
  const siteMw = designSiteMw(plan, d);

  setText("operate-title", plan.label || "Your build");
  setText(
    "operate-sub",
    `${formatNum(d.racks)} racks · ${formatNum(d.hallKw, 0)} kW IT · ${formatNum(siteMw, 2)} MW design · ${coolingClassLabel(plan.coolingClass)} · ${plan.feedRedundancy}`,
  );

  const domains = document.getElementById("operate-domains");
  if (domains) domains.innerHTML = monitorDomainCards(plan, slots, optionalIds);

  const tools = document.getElementById("operate-tools");
  if (tools) tools.innerHTML = operateToolsHtml();

  renderMockDashboards(plan);
}
