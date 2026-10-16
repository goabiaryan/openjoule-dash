import { formatNum } from "../calc.js";

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function drawFabricDiagram(svgId, fabric) {
  const s = document.getElementById(svgId);
  if (!s || !fabric?.hops?.length) return;

  const hops = fabric.hops;
  const W = 960;
  const nodeH = 56;
  const y = 36;
  const gap = (W - 48) / hops.length;
  let h = "";

  h += `<text class="nm sm" x="0" y="16">East-west training fabric (GPU → leaf → spine)</text>`;

  hops.forEach((node, i) => {
    const x = 24 + gap * i + gap / 2;
    const w = Math.min(gap - 12, 120);
    const left = x - w / 2;
    h += `<rect class="fabric-node" x="${left.toFixed(1)}" y="${y}" width="${w}" height="${nodeH}" rx="3"/>`;
    h += `<foreignObject x="${left.toFixed(1)}" y="${y}" width="${w}" height="${nodeH}">
      <div xmlns="http://www.w3.org/1999/xhtml" class="fabric-node-inner">
        <span class="fabric-node-label">${esc(node.label)}</span>
        <span class="fabric-node-qty">${formatNum(node.qty)} ${node.unit}</span>
      </div>
    </foreignObject>`;
    if (i < hops.length - 1) {
      const x2 = 24 + gap * (i + 1) + gap / 2 - w / 2;
      h += `<line class="fabric-link flow-fb" x1="${(x + w / 2).toFixed(1)}" x2="${(x2 - 8).toFixed(1)}" y1="${y + nodeH / 2}" y2="${y + nodeH / 2}"/>`;
    }
  });

  hops.forEach((node, i) => {
    const x = 24 + gap * i + gap / 2;
    h += `<text class="mu sm fabric-media" x="${x.toFixed(1)}" y="${y + nodeH + 16}" text-anchor="middle">${esc(node.media)}</text>`;
    h += `<text class="mu sm" x="${x.toFixed(1)}" y="${y + nodeH + 30}" text-anchor="middle">${esc(node.sub)}</text>`;
  });

  const H = y + nodeH + 48;
  s.setAttribute("viewBox", `0 0 ${W} ${H}`);
  s.setAttribute("preserveAspectRatio", "xMidYMid meet");
  s.innerHTML = h;
}
