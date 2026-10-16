/** ~px width per character at 9px mono · for SVG callout sizing. */
const CHAR_W = 5.35;
const LINE_H = 13;
const CALLOUT_PAD_X = 12;
const CALLOUT_PAD_TOP = 11;

export function calloutWidth(lines) {
  const maxLen = Math.max(1, ...lines.map((l) => String(l).length));
  return Math.max(76, Math.ceil(maxLen * CHAR_W) + CALLOUT_PAD_X * 2);
}

export function calloutHeight(lineCount) {
  return CALLOUT_PAD_TOP + lineCount * LINE_H + 7;
}

/**
 * @param {"power"|"cool"|"net"|"space"} theme
 */
export function themedCallout(x, y, lines, theme) {
  const w = calloutWidth(lines);
  const h = calloutHeight(lines.length);
  let tsp = "";
  lines.forEach((line, i) => {
    tsp += `<tspan x="${x + w / 2}" dy="${i === 0 ? 0 : LINE_H}">${line}</tspan>`;
  });
  return `<g class="site-callout site-callout-${theme}">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2"/>
    <text class="site-callout-t" x="${x + w / 2}" y="${y + CALLOUT_PAD_TOP + 2}" text-anchor="middle">${tsp}</text>
  </g>`;
}

/** Centered label(s) inside a fixed rect · normal spacing, no synthetic stretch. */
export function textInBox(cx, topY, w, h, lines, tone) {
  const count = lines.length;
  const blockH = count * LINE_H;
  const startY = topY + (h - blockH) / 2 + 9;
  return lines
    .map((line, i) => {
      const y = startY + i * LINE_H;
      return `<text class="diagram-inbox diagram-inbox-${tone}" x="${cx}" y="${y}" text-anchor="middle">${line}</text>`;
    })
    .join("");
}
