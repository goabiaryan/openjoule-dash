import { getActiveView } from "../app/shell.js";
import { compactBlockSpec, glossarySpec, programSpecSheet } from "./specSheet.js";

let pinnedTermId = null;
let lastPlan = null;
let lastSlots = null;

export function setSpecContext(plan, slots) {
  lastPlan = plan;
  lastSlots = slots;
}

export function renderContextPanel(blockId) {
  const root = document.querySelector(".app-view.is-active .context-panel");
  if (!root) return;
  const view = getActiveView();
  let html = "";
  if (pinnedTermId) {
    html =
      `<button type="button" class="guide-back" data-guide-back>← Back</button>` + glossarySpec(pinnedTermId);
  } else if (view === "build" && blockId) {
    html = compactBlockSpec(blockId);
  } else if (view === "build" && lastPlan && lastSlots) {
    html = programSpecSheet(lastPlan, lastSlots);
  }
  /* Program / Scale / Operate: hall summary + full GPU isa live in those views · skip repeat sidebar */
  root.innerHTML = html;
}

export function clearPinnedTerm() {
  pinnedTermId = null;
}

export function wireContextPanel(getSelectedBlockId) {
  document.body.addEventListener("click", (e) => {
    const metric = e.target.closest("[data-term-id]");
    if (metric) {
      pinnedTermId = metric.dataset.termId;
      renderContextPanel(getSelectedBlockId());
      return;
    }
    if (e.target.closest("[data-guide-back]")) {
      clearPinnedTerm();
      renderContextPanel(getSelectedBlockId());
    }
  });
}

export function metricTermId(label) {
  const map = {
    "GPUs in hall": "fabric",
    "IT load": "hall_it_kw",
    "Rack density": "rack_kw",
    "All-in power per GPU": "server_power_w",
    "Cooling class": "cooling_class",
    "Heat to reject": "heat_tons",
    "Cooling per rack": "cfm",
    "Feed per rack (400 V 3φ)": "feed_amps",
    "Grid demand": "pue",
    "Design w/ headroom": "spare_pct",
    "Electrical feeds": "feed_2n",
  };
  return map[label] ?? null;
}
