/** Mini dashboard tiles embedded in each “What to monitor” domain card. */

const MW = 124;
const MH = 34;

export function miniTile(id, label, unit, shape) {
  const candleG =
    shape === "candles"
      ? `<line class="operate-ecn-base operate-mini-base" x1="2" y1="${MH - 2}" x2="${MW - 2}" y2="${MH - 2}"/><g data-mini-candles="${id}"></g>`
      : shape === "step"
        ? `<path class="operate-spark-step operate-mini-step" data-mini-path="${id}" fill="none"/>`
        : `<polyline class="operate-spark-line" data-mini-line="${id}" fill="none"/>`;
  return `
    <div class="operate-mini operate-mini-${shape}" data-mini-panel="${id}">
      <div class="operate-mini-head">
        <span class="operate-mini-label">${label}</span>
        <span class="operate-mini-val" data-mini-val="${id}">-${unit ? ` <span class="operate-dash-unit">${unit}</span>` : ""}</span>
      </div>
      <svg class="operate-mini-svg" viewBox="0 0 ${MW} ${MH}" width="100%" height="${MH}" aria-hidden="true">${candleG}</svg>
    </div>`;
}

export function domainDashboardRow(domainId, tiles) {
  return `<div class="operate-domain-dashes" data-domain-dashes="${domainId}">${tiles.join("")}</div>`;
}

export const DOMAIN_MINIS = {
  elec: [
    ["ups", "UPS load", "%", "jitter"],
    ["phase", "Phase imbalance", "%", "candles"],
  ],
  mech: [
    ["chwSup", "CHW supply", "°C", "thermal"],
    ["pump", "Pump speed", "%", "step"],
    ["chiller", "Chiller headroom", "%", "thermal"],
  ],
  it: [
    ["gpu", "GPU util", "%", "jitter"],
    ["inlet", "Rack inlet", "°C", "thermal"],
    ["optics", "Optics errors", "/min", "candles"],
  ],
  fac: [
    ["water", "Make-up water", "rel", "thermal"],
    ["rh", "RH", "%", "flat"],
  ],
  wl: [
    ["ttft", "TTFT p99", "rel", "step"],
    ["queue", "Queue depth", "rel", "step"],
    ["err", "Error rate", "rel", "candles"],
  ],
};

export function renderDomainMiniHtml(domainId) {
  const specs = DOMAIN_MINIS[domainId];
  if (!specs) return "";
  const tiles = specs.map(([id, label, unit, shape]) => miniTile(`${domainId}-${id}`, label, unit, shape));
  return domainDashboardRow(domainId, tiles);
}

export { MW as MINI_W, MH as MINI_H };
