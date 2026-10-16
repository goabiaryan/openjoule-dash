const W_DEFAULT = 280;
const H_DEFAULT = 56;

/** Smooth line · min/max auto (IT, ΔT with lag). */
export function sparkLine(values, w = W_DEFAULT, h = H_DEFAULT, pad = 2) {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return pointsToPoly(values, w, h, pad, (v) => (v - min) / span);
}

/** Tight band · PUE barely moves (fixed outer range). */
export function sparkLineTight(values, w = W_DEFAULT, h = H_DEFAULT, pad = 2) {
  if (values.length < 2) return "";
  const mid = values.reduce((a, b) => a + b, 0) / values.length;
  const band = 0.025;
  const lo = mid - band;
  const hi = mid + band;
  const span = hi - lo || 1;
  return pointsToPoly(values, w, h, pad, (v) => Math.min(1, Math.max(0, (v - lo) / span)));
}

/** Step / staircase · request-rate buckets. */
export function sparkStep(values, w = W_DEFAULT, h = H_DEFAULT, pad = 2) {
  if (values.length < 2) return "";
  const min = 0;
  const max = 1;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const n = values.length;
  let d = "";
  for (let i = 0; i < n; i++) {
    const v = values[i];
    const y = pad + innerH - ((v - min) / (max - min)) * innerH;
    const x0 = pad + (i / (n - 1)) * innerW;
    const x1 = pad + ((i + 1) / (n - 1)) * innerW;
    if (i === 0) d += `M ${x0.toFixed(1)} ${y.toFixed(1)}`;
    else d += ` L ${x0.toFixed(1)} ${y.toFixed(1)}`;
    d += ` L ${x1.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}

/** Vertical wicks · sparse ECN / alarm spikes. */
export function sparkCandles(values, w = W_DEFAULT, h = H_DEFAULT, pad = 2) {
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const n = values.length;
  const barW = Math.max(1.2, (innerW / n) * 0.55);
  let s = "";
  values.forEach((v, i) => {
    const x = pad + (i / (n - 1)) * innerW - barW / 2;
    const top = pad + innerH - v * innerH;
    const base = pad + innerH - 1;
    if (v < 0.08) return;
    s += `<line class="operate-ecn-wick" x1="${(x + barW / 2).toFixed(1)}" x2="${(x + barW / 2).toFixed(1)}" y1="${base.toFixed(1)}" y2="${top.toFixed(1)}" stroke-width="${v > 0.5 ? 2.2 : 1.4}"/>`;
  });
  return s;
}

export function trafficAreaStep(values, w = W_DEFAULT, h = H_DEFAULT, pad = 2) {
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const n = values.length;
  let d = `M ${pad} ${h - pad}`;
  for (let i = 0; i < n; i++) {
    const v = values[i];
    const y = pad + innerH - v * innerH;
    const x0 = pad + (i / (n - 1)) * innerW;
    const x1 = pad + ((i + 1) / (n - 1)) * innerW;
    d += ` L ${x0.toFixed(1)} ${y.toFixed(1)} L ${x1.toFixed(1)} ${y.toFixed(1)}`;
  }
  d += ` L ${w - pad} ${h - pad} Z`;
  return d;
}

function pointsToPoly(values, w, h, pad, normFn) {
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  return values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * innerW;
      const y = pad + innerH - normFn(v) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
