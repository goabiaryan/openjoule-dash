import { miniTile, domainDashboardRow } from "./domainMiniCharts.js";

/** “How halls do it” · one card per ops system with illustrative mini trends. */
export const TOOLS_CHANNELS = [
  {
    id: "epms",
    lane: "power",
    title: "BMS / EPMS / DCIM",
    blurb: "Trends, setpoints, alarms · power often 1 s–1 min; mechanical slower.",
    minis: [
      ["facKw", "Facility kW", "MW", "jitter"],
      ["alms", "Active alarms", "", "candles"],
    ],
  },
  {
    id: "snmp",
    lane: "net",
    title: "SNMP · Redfish · IPMI · fabric",
    blurb: "Device reachability, sensor drift, interface counters.",
    minis: [
      ["reach", "Reachability", "%", "flat"],
      ["ifIn", "If errors", "/min", "candles"],
    ],
  },
  {
    id: "cmms",
    lane: "space",
    title: "CMMS / tickets",
    blurb: "Every alarm and maintenance window tracked to closure.",
    minis: [
      ["open", "Open tickets", "", "step"],
      ["backlog", "Backlog age", "d", "thermal"],
    ],
  },
  {
    id: "noc",
    lane: "net",
    title: "Runbooks + NOC",
    blurb: "Sev routing, on-call queue, runbook steps under incident load.",
    minis: [
      ["sev", "Sev1/2 events", "/hr", "candles"],
      ["pages", "On-call queue", "", "step"],
    ],
  },
  {
    id: "test",
    lane: "power",
    title: "Periodic tests",
    blurb: "Generator load, UPS battery, A-feed maintenance while B carries IT.",
    minis: [
      ["gen", "Gen test", "status", "candles"],
      ["upsBat", "UPS battery", "%", "step"],
    ],
  },
];

export function renderOperateToolsSection() {
  const cards = TOOLS_CHANNELS.map((ch) => {
    const tiles = ch.minis.map(([id, label, unit, shape]) => miniTile(`tools-${ch.id}-${id}`, label, unit, shape));
    return `
    <article class="operate-tool-card operate-domain-${ch.lane}" data-tool-channel="${ch.id}">
      <header class="operate-tool-head">
        <h4 class="operate-tool-title">${ch.title}</h4>
        <p class="operate-tool-blurb">${ch.blurb}</p>
      </header>
      ${domainDashboardRow(`tools-${ch.id}`, tiles)}
    </article>`;
  }).join("");

  return `
    <p class="operate-section-hint operate-tools-hint">Same load-test sim as above · each system shows a typical trace shape.</p>
    <div class="operate-tools-grid">${cards}</div>
    <p class="operate-baseline-note">Floor plan and one-lines on <button type="button" class="text-btn operate-goto" data-app-goto="program">Program</button> / <button type="button" class="text-btn operate-goto" data-app-goto="scale">Scale</button> are the baseline map; traces are <em>illustrative</em>, not live SCADA.</p>`;
}
