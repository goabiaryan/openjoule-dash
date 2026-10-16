/** Build A / B parameters and first-principles derivations for the ISA figures. */

export const buildA = {
  gpusPerServer: 8,
  serverKw: 10.2,
  gpuKw: 0.7,
  serversPerRack: 4,
  racksPerRow: 6,
  rows: 4,
  pue: 1.3,
};

export const buildB = {
  gpusPerRack: 72,
  rackKw: 120,
  racksPerRow: 4,
  rows: 2,
  pue: 1.2,
};

export const formulas = {
  volts: 400,
  pf: 0.95,
  dTw: 10,
  dTa: 12,
  tonKw: 3.517,
  m2PerRack: 3,
};

export function amps(kw) {
  return (kw * 1000) / (Math.sqrt(3) * formulas.volts * formulas.pf);
}

export function lpm(kw) {
  return (kw * 60) / (4.186 * formulas.dTw);
}

export function cfm(kw) {
  return ((kw * 1000) / (1.2 * 1005 * formulas.dTa)) * 2118.88;
}

export function tons(kw) {
  return kw / formulas.tonKw;
}

/** Derive ladder metrics from an assembled block plan (see build/plan.js). */
export function derivePlan(plan) {
  return {
    rackKw: plan.rackKw,
    rowKw: plan.rowKw,
    racks: plan.racks,
    hallKw: plan.hallKw,
    siteKw: plan.siteKw,
    gpusPerRack: plan.gpusPerRack,
    gpus: plan.gpus,
    areaM2: plan.areaM2,
  };
}

export function deriveA() {
  const d = {};
  d.rackKw = buildA.serverKw * buildA.serversPerRack;
  d.rowKw = d.rackKw * buildA.racksPerRow;
  d.racks = buildA.racksPerRow * buildA.rows;
  d.hallKw = d.rackKw * d.racks;
  d.siteKw = d.hallKw * buildA.pue;
  d.gpusPerRack = buildA.gpusPerServer * buildA.serversPerRack;
  d.gpus = d.gpusPerRack * d.racks;
  d.areaM2 = d.racks * formulas.m2PerRack;
  return d;
}

export function deriveB() {
  const d = {};
  d.rackKw = buildB.rackKw;
  d.racks = buildB.racksPerRow * buildB.rows;
  d.hallKw = d.rackKw * d.racks;
  d.siteKw = d.hallKw * buildB.pue;
  d.gpusPerRack = buildB.gpusPerRack;
  d.gpus = d.gpusPerRack * d.racks;
  d.areaM2 = d.racks * formulas.m2PerRack;
  return d;
}

export function formatNum(x, dp) {
  return x.toLocaleString("en-US", {
    minimumFractionDigits: dp || 0,
    maximumFractionDigits: dp || 0,
  });
}

export function round100(x) {
  return Math.round(x / 100) * 100;
}
