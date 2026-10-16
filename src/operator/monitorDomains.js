import { getBlock } from "../catalog/blocks.js";
import { designSiteMw } from "../build/program.js";
import { amps, derivePlan, formatNum, formulas, lpm, tons } from "../calc.js";
import { deriveFabric } from "../scale/fabric.js";
import { renderDomainMiniHtml } from "./domainMiniCharts.js";

/** Steady-state domains · compare live EPMS/DCIM/NOC signals to design from Build. */
export function monitorDomainCards(plan, slots, optionalIds) {
  const d = derivePlan(plan);
  const siteMw = designSiteMw(plan, d);
  const fabric = deriveFabric(plan, slots, optionalIds);
  const rowA = amps(plan.rowKw);
  const dual = plan.feedRedundancy === "2N";
  const hallLpm = Math.round(lpm(d.hallKw));
  const liquid =
    plan.coolingClass === "direct_liquid" || plan.coolingClass === "air_rear_door";

  const domains = [
    {
      id: "elec",
      lane: "power",
      title: "Electrical",
      systems: "EPMS · switchgear · UPS · busway",
      compare: [
        `Design ${formatNum(siteMw, 2)} MW utility · ${formatNum(d.hallKw, 0)} kW IT`,
        `Row busway ~${formatNum(Math.round(rowA))} A @ ${formulas.volts} V 3φ`,
        dual
          ? `${plan.feedRedundancy} feeds · balance A vs B (neither side > ~55% long-term)`
          : `${plan.feedRedundancy} feed · no hidden single-path maintenance`,
      ],
      watch: [
        "UPS load %, battery runtime, breaker trips",
        "PDU/busway amps and phase imbalance",
        "Generator exercise and transfer tests",
      ],
    },
    {
      id: "mech",
      lane: "cool",
      title: "Mechanical / cooling",
      systems: "BMS · chiller plant · pumps · CDU/CRAH",
      compare: [
        liquid
          ? `Hall loop ~${formatNum(hallLpm)} L/min · ΔT water ${formulas.dTw} K model`
          : `Air ΔT ${formulas.dTa} K model · ${plan.coolingClass}`,
        `Reject ~${formatNum(Math.round(tons(d.hallKw)))} tons at full IT`,
        optionalIds?.has("cool-cdu") ? "CDU in program · manifold pressure + leaks" : "Size CDU add-on if liquid at rack",
      ],
      watch: [
        "CHW supply/return and collapse of ΔT under load",
        "Pump faults, chiller capacity, hot spots vs containment",
        liquid ? "Quick-connect leaks, CDU flow per rack" : "CRAH/fan status, aisle recirculation",
      ],
    },
    {
      id: "it",
      lane: "net",
      title: "IT / compute · fabric",
      systems: "Redfish/IPMI · GPU tools · SNMP · optics",
      compare: [
        `${formatNum(d.gpus)} GPUs · ${formatNum(plan.rackKw, 0)} kW/rack nameplate`,
        `${formatNum(fabric.leafCount)} leaf · ${formatNum(fabric.spineCount)} spine (matrix)`,
        "Rack inlet where instrumented vs GPU spec",
      ],
      watch: [
        "Host/GPU power, thermals, ECC, driver/firmware drift",
        "Optics errors, PFC/ECN, congestion vs fabric design",
        "Failed nodes, RMA queue, row-level power caps",
      ],
    },
    {
      id: "fac",
      lane: "space",
      title: "Whole facility",
      systems: "DCIM · water · fire · security · env",
      compare: [
        `PUE target ${formatNum(plan.pue, 2)} · +${plan.sparePct}% spare on MW`,
        `~${formatNum(Math.round(d.areaM2))} m² white space (model)`,
        `Site: ${getBlock(slots.site)?.name ?? "-"}`,
      ],
      watch: [
        "Facility kW vs IT (PUE trend), water use",
        "Humidity, smoke, suppression arm state",
        "Access control, cage door, delivery path conflicts",
      ],
    },
    {
      id: "wl",
      lane: "net",
      title: "Workloads",
      systems: "Serving · queues · SLO · (Joule-class telemetry)",
      compare: [
        "Diagram = capacity map; monitoring = within ratings under today's jobs",
        "Classic DCIM rarely ties MW to tokens/SLO goodput",
        "Burst traffic (load tests) stress power + fabric together",
      ],
      watch: [
        "TTFT/TPOT, error rate, queue depth vs SLO",
        "Load-test ramps (Locust/k6) vs row thermal and ECN",
        "Per-tenant caps in colo; full stack in neocloud you operate",
      ],
    },
  ];

  return domains
    .map(
      (dom) => `
    <article class="operate-domain operate-domain-${dom.lane}" data-domain="${dom.id}">
      <header class="operate-domain-head">
        <h4 class="operate-domain-title">${dom.title}</h4>
        <p class="operate-domain-systems">${dom.systems}</p>
      </header>
      ${renderDomainMiniHtml(dom.id)}
      <div class="operate-domain-col">
        <p class="operate-domain-label">Compare to design</p>
        <ul>${dom.compare.map((c) => `<li>${c}</li>`).join("")}</ul>
      </div>
      <div class="operate-domain-col">
        <p class="operate-domain-label">Typical alarms</p>
        <ul>${dom.watch.map((c) => `<li>${c}</li>`).join("")}</ul>
      </div>
    </article>`,
    )
    .join("");
}

export { renderOperateToolsSection as operateToolsHtml } from "./toolsMiniCharts.js";
