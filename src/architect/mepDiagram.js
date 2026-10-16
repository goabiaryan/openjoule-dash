function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const MEP_W = 960;

function chain(nodes, y, colorClass, W) {
  const n = nodes.length;
  const gap = (W - 48) / n;
  const nodeH = 62;
  let h = "";
  nodes.forEach((node, i) => {
    const x = 24 + gap * i + gap / 2;
    const w = Math.min(gap - 14, 128);
    const left = x - w / 2;
    h += `<rect class="mep-node ${colorClass}" x="${left.toFixed(1)}" y="${y}" width="${w}" height="${nodeH}" rx="3"/>`;
    h += `<foreignObject x="${left.toFixed(1)}" y="${y}" width="${w}" height="${nodeH}">
      <div xmlns="http://www.w3.org/1999/xhtml" class="mep-node-inner mep-node-inner-lg">
        <span class="mep-node-label">${esc(node.label)}</span>
        <span class="mep-node-sub">${esc(node.sub)}</span>
      </div>
    </foreignObject>`;
    if (i < n - 1) {
      const x2 = 24 + gap * (i + 1) + gap / 2 - w / 2;
      const flowClass = colorClass === "mep-c" ? "flow-cl" : "flow-pw";
      h += `<line class="mep-arrow ${flowClass}" x1="${(x + w / 2).toFixed(1)}" x2="${(x2 - 8).toFixed(1)}" y1="${y + nodeH / 2}" y2="${y + nodeH / 2}"/>`;
    }
  });
  return h;
}

export function drawMepDiagram(svgId, mep) {
  const s = document.getElementById(svgId);
  if (!s || !mep) return;
  const W = MEP_W;
  const H = 228;
  let h = "";
  h += `<text class="nm sm mep-row-title" x="0" y="18">Power path</text>`;
  h += chain(mep.power, 28, "mep-p", W);
  h += `<text class="nm sm mep-row-title" x="0" y="132">Cooling path</text>`;
  h += chain(mep.cool, 142, "mep-c", W);
  s.setAttribute("viewBox", `0 0 ${W} ${H}`);
  s.setAttribute("preserveAspectRatio", "xMidYMid meet");
  s.innerHTML = h;
}
