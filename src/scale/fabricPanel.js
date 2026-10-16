import { formatNum } from "../calc.js";
import { deriveFabric } from "./fabric.js";
import { drawFabricDiagram } from "./fabricDiagram.js";

function setHtml(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

/** Physical path & BOQ · counts and ISA fields live in the matrix Network column. */
export function renderFabricPanel(plan, slots, optionalIds) {
  const f = deriveFabric(plan, slots, optionalIds);

  const notes = [];
  if (f.oversubDownToUp != null) {
    notes.push(`Leaf oversub ~${formatNum(f.oversubDownToUp, 1)}:1 (downlink vs uplink capacity)`);
  }
  notes.push("1 training NIC port ↔ 1 GPU scale-out port (illustrative)");
  setHtml(
    "fabric-notes",
    notes.length
      ? `<ul class="fabric-notes-list">${notes.map((n) => `<li>${n}</li>`).join("")}</ul>`
      : "",
  );

  setHtml(
    "fabric-cables",
    `<table class="fabric-cable-tbl"><thead><tr><th>Segment</th><th>Qty</th><th>Cable / media</th><th>Notes</th></tr></thead><tbody>${f.cableRows
      .map(
        (r) =>
          `<tr><td>${r.segment}</td><td class="bom-qty">${formatNum(r.qty)} ${r.unit}</td><td>${r.type}</td><td class="bom-note">${r.note}</td></tr>`,
      )
      .join("")}</tbody></table>`,
  );

  drawFabricDiagram("svg-fabric", f);

  return f;
}
