import { getBlock } from "../catalog/blocks.js";
import { miniTile } from "./domainMiniCharts.js";

const LAYER_ORDER = ["gpu", "server", "rack", "row", "hall", "site"];

/** Illustrative traces for each ISA layer’s “watch” signals. */
export const LAYER_WATCH_MINIS = {
  gpu: [
    ["pwr", "Board power", "W", "jitter"],
    ["therm", "GPU temp", "°C", "thermal"],
  ],
  server: [
    ["inlet", "Inlet temp", "°C", "thermal"],
    ["fan", "Fan PWM", "%", "jitter"],
  ],
  rack: [
    ["kw", "Rack kW", "kW", "jitter"],
    ["flow", "Loop flow", "L/m", "step"],
  ],
  row: [
    ["amps", "Busway A", "A", "jitter"],
    ["contain", "Containment ΔT", "K", "thermal"],
  ],
  hall: [
    ["it", "Hall IT", "kW", "jitter"],
    ["loop", "CHW loop", "L/m", "thermal"],
  ],
  site: [
    ["pue", "PUE", "", "flat"],
    ["mw", "Grid import", "MW", "jitter"],
  ],
};

function layerMinisHtml(layer) {
  const specs = LAYER_WATCH_MINIS[layer];
  if (!specs) return "";
  const tiles = specs.map(([id, label, unit, shape]) => miniTile(`layer-${layer}-${id}`, label, unit, shape));
  return `<div class="op-layer-minis">${tiles.join("")}</div>`;
}

export function renderLayerWatchRows(slots, plan, activeLayer) {
  const layers = plan.integrated ? LAYER_ORDER.filter((l) => l !== "server") : LAYER_ORDER;
  return layers
    .map((layer) => {
      const b = getBlock(slots[layer]);
      const L = b?.learn;
      const active = activeLayer === layer ? " matrix-row-active" : "";
      const lane = layerLane(layer);
      return `<tr class="op-row op-row-${lane}${active}" data-layer="${layer}" tabindex="0">
        <th scope="row">${layer.charAt(0).toUpperCase() + layer.slice(1)}</th>
        <td class="op-watch-text">${L?.watch ?? "-"}</td>
        <td class="op-trace-cell">${layerMinisHtml(layer)}</td>
        <td class="op-fail-text">${L?.fails ?? "-"}</td>
      </tr>`;
    })
    .join("");
}

function layerLane(layer) {
  if (layer === "gpu" || layer === "server" || layer === "rack" || layer === "row") {
    if (layer === "row") return "power";
    if (layer === "rack") return "cool";
    return "net";
  }
  if (layer === "hall") return "cool";
  return "power";
}

export function wireLayerWatchTable(onLayerFocus) {
  const tb = document.getElementById("op-body");
  if (!tb || tb.dataset.wired) return;
  tb.dataset.wired = "1";
  const focus = (tr) => {
    if (tr && onLayerFocus) onLayerFocus(tr.dataset.layer);
  };
  tb.addEventListener("click", (e) => focus(e.target.closest("[data-layer]")));
  tb.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const tr = e.target.closest("[data-layer]");
    if (tr) {
      e.preventDefault();
      focus(tr);
    }
  });
}
