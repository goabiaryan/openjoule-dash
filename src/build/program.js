/** Row / hall geometry from blocks only. */

export function mergeProgram(blockDefaults) {
  return {
    rows: blockDefaults.rows,
    racksPerRow: blockDefaults.racksPerRow,
    includeNetworkRow: true,
  };
}

export function designSiteMw(plan, d) {
  const hallKw = d?.hallKw ?? plan.hallKw;
  return (hallKw * (1 + plan.sparePct / 100) * plan.pue) / 1000;
}
