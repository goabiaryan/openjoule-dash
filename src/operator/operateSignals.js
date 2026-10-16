/** Realistic-ish signal shapes per metric class (EPMS vs Locust vs fabric counters). */

export function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSignalState(seed) {
  const rand = makeRng(seed);
  return {
    rand,
    itLp: 0.28,
    dtwLp: 0.92,
    pueLp: 1.0,
    dtwDip: 0,
    rpsLevel: 0.12,
    stepCounter: 0,
    lastStepRps: 0.12,
    upsLp: 0.35,
    pumpLp: 0.4,
    inletLp: 0.5,
    waterLp: 0.55,
    rhLp: 0.72,
    ttftLevel: 0.2,
    queueLp: 0.15,
    cmmsLp: 0.2,
    backlogLp: 0.3,
    reachLp: 0.97,
    testPulse: 0,
    upsBatLp: 0.92,
  };
}

/**
 * @param {ReturnType<typeof createSignalState>} sig
 * @param {{ load: number, burst: number, tick: number, pueTarget: number }} ctx
 */
export function sampleSignals(sig, ctx) {
  const { load, burst, tick, pueTarget } = ctx;
  const rand = sig.rand;

  /* Inference RPS · steep steps & plateaus (Locust / load generator buckets). */
  sig.stepCounter += 1;
  const targetRps = Math.min(1, Math.max(0.04, load * 0.95 + burst * 0.55));
  if (sig.stepCounter >= 2 || burst > 0.12 || rand() > 0.82) {
    sig.stepCounter = 0;
    const stepUp = rand() > 0.35 ? 1 : -1;
    const jump = burst > 0.1 ? 0.22 + rand() * 0.35 : 0.06 + rand() * 0.14;
    sig.rpsLevel = Math.min(1, Math.max(0.04, targetRps + stepUp * jump * (0.5 + load)));
    sig.lastStepRps = sig.rpsLevel;
  }
  const rpsNorm = sig.lastStepRps;

  /* Hall kW · EPMS: slow envelope + small jitter (1 s–1 min feel). */
  const itTarget = 0.2 + load * 0.74 + burst * 0.12;
  sig.itLp += (itTarget - sig.itLp) * 0.18;
  const itJitter = (rand() - 0.5) * 0.032;
  const itNorm = Math.min(1, Math.max(0.08, sig.itLp + itJitter));

  /* CHW ΔT · thermal mass: smooth, then steep sag on burst, slow recovery. */
  const dtwTarget = 0.78 + (1 - load) * 0.2 - burst * 0.08;
  if (burst > 0.18) sig.dtwDip = Math.min(0.42, sig.dtwDip + 0.2 + rand() * 0.12);
  sig.dtwDip *= 0.9;
  sig.dtwLp += (dtwTarget - sig.dtwLp) * 0.07;
  const dtwNorm = Math.min(1.05, Math.max(0.45, sig.dtwLp - sig.dtwDip + (rand() - 0.5) * 0.012));

  /* PUE · facility ratio: almost flat, tiny drift. */
  sig.pueLp += (pueTarget - sig.pueLp) * 0.035;
  const pueNorm = sig.pueLp + (rand() - 0.5) * 0.004;

  /* ECN / pause · sparse tall candles, flat baseline. */
  let ecnNorm = rand() * 0.04;
  if (rand() > 0.9 && load > 0.25) ecnNorm = 0.15 + rand() * 0.35;
  if (burst > 0.08) ecnNorm = Math.max(ecnNorm, 0.45 + rand() * 0.55);
  if (load > 0.8 && rand() > 0.78) ecnNorm = Math.max(ecnNorm, 0.25 + rand() * 0.75);
  ecnNorm = Math.min(1, ecnNorm);

  /* UPS load · tracks IT, smoother, % scale. */
  const upsTarget = 0.25 + itNorm * 0.62;
  sig.upsLp += (upsTarget - sig.upsLp) * 0.12;
  const upsNorm = Math.min(1, sig.upsLp + (rand() - 0.5) * 0.018);

  /* Phase imbalance · rare spikes. */
  let phaseNorm = 0.02 + rand() * 0.04;
  if (rand() > 0.94) phaseNorm = 0.2 + rand() * 0.5;
  if (itNorm > 0.75 && rand() > 0.88) phaseNorm = Math.max(phaseNorm, 0.15 + rand() * 0.35);

  /* CHW supply (normalized) · slow BMS trend. */
  const supTarget = 0.55 + load * 0.12 + burst * 0.06;
  const chwSupNorm = supTarget + (rand() - 0.5) * 0.008;

  /* Pump speed · steps when load shifts. */
  const pumpTarget = 0.3 + load * 0.55;
  if (sig.stepCounter === 0) sig.pumpLp = pumpTarget;
  else sig.pumpLp += (pumpTarget - sig.pumpLp) * 0.1;
  const pumpNorm = Math.min(1, sig.pumpLp);

  /* Chiller headroom · inverse of load, smooth. */
  const chillerNorm = Math.max(0.08, 0.95 - load * 0.7 - burst * 0.15 + (rand() - 0.5) * 0.02);

  /* GPU util · fast jitter around load. */
  const gpuNorm = Math.min(1, Math.max(0.05, load * 0.88 + burst * 0.25 + (rand() - 0.5) * 0.12));
  const fanNorm = Math.min(1, Math.max(0.1, gpuNorm * 0.85 + (rand() - 0.5) * 0.08));

  /* Rack inlet · lags GPU/IT. */
  const inletTarget = 0.35 + load * 0.45 + burst * 0.2;
  sig.inletLp += (inletTarget - sig.inletLp) * 0.06;
  const inletNorm = Math.min(1, sig.inletLp + (rand() - 0.5) * 0.01);

  /* Optics errors · sparse candles (same class as ECN). */
  let opticsNorm = rand() * 0.03;
  if (burst > 0.1 || load > 0.7) opticsNorm = Math.max(opticsNorm, rand() * 0.15);
  if (burst > 0.2) opticsNorm = Math.max(opticsNorm, 0.35 + rand() * 0.6);

  /* Water flow · very smooth plant loop. */
  const waterTarget = 0.4 + load * 0.45;
  sig.waterLp += (waterTarget - sig.waterLp) * 0.05;
  const waterNorm = sig.waterLp + (rand() - 0.5) * 0.006;

  /* Humidity · tight band. */
  sig.rhLp += ((0.68 + (rand() - 0.5) * 0.02) - sig.rhLp) * 0.03;
  const rhNorm = sig.rhLp;

  /* TTFT p99 · step up under burst. */
  if (sig.stepCounter === 0 || burst > 0.12) {
    sig.ttftLevel = Math.min(1, 0.12 + load * 0.35 + burst * 0.55 + rand() * 0.1);
  }
  const ttftNorm = sig.ttftLevel;

  /* Queue depth · follows RPS with delay. */
  const queueTarget = rpsNorm * 0.85;
  sig.queueLp += (queueTarget - sig.queueLp) * 0.14;
  const queueNorm = Math.min(1, sig.queueLp);

  /* Error rate · sparse steep candles. */
  let errNorm = rand() * 0.02;
  if (burst > 0.15) errNorm = Math.max(errNorm, 0.25 + rand() * 0.65);
  if (load > 0.85 && rand() > 0.9) errNorm = 0.15 + rand() * 0.4;

  /* EPMS facility kW trace · follows IT envelope. */
  const facKwNorm = itNorm;

  /* EPMS alarm count · correlates with phase + fabric stress. */
  let epmsAlmNorm = phaseNorm * 0.5 + ecnNorm * 0.35;
  if (burst > 0.1) epmsAlmNorm = Math.max(epmsAlmNorm, 0.4 + rand() * 0.5);

  /* SNMP reachability · tight band, dips on burst. */
  const reachTarget = 0.99 - (1 - gpuNorm) * 0.04 - burst * 0.08;
  sig.reachLp += (reachTarget - sig.reachLp) * 0.06;
  const reachNorm = Math.min(1, Math.max(0.85, sig.reachLp + (rand() - 0.5) * 0.004));

  /* CMMS open tickets · steps up on errors/burst. */
  const cmmsTarget = 0.08 + errNorm * 0.65 + load * 0.12;
  if (sig.stepCounter === 0) sig.cmmsLp = cmmsTarget;
  else sig.cmmsLp += (cmmsTarget - sig.cmmsLp) * 0.15;
  const cmmsOpenNorm = Math.min(1, sig.cmmsLp);

  /* Backlog age · slow thermal-style drift. */
  sig.backlogLp += (0.25 + load * 0.35 + cmmsOpenNorm * 0.2 - sig.backlogLp) * 0.04;
  const backlogNorm = sig.backlogLp;

  /* NOC sev events · sparse candles. */
  let nocSevNorm = ecnNorm * 0.6 + errNorm * 0.5;
  if (burst > 0.12) nocSevNorm = Math.max(nocSevNorm, 0.5 + rand() * 0.45);

  /* On-call queue · steps with workload queue. */
  const nocPagesNorm = queueNorm;

  /* Generator test · rare pulse (monthly exercise shape). */
  if (tick % 97 === 0) sig.testPulse = 0.85 + rand() * 0.15;
  sig.testPulse *= 0.94;
  const genTestNorm = sig.testPulse;

  /* UPS battery · slow step down during discharge drill. */
  if (tick % 113 === 0) sig.upsBatLp = Math.max(0.55, sig.upsBatLp - 0.08);
  sig.upsBatLp = Math.min(0.98, sig.upsBatLp + 0.002);
  const upsBatNorm = sig.upsBatLp;

  return {
    rpsNorm,
    itNorm,
    dtwNorm,
    pueNorm,
    ecnNorm,
    upsNorm,
    phaseNorm,
    chwSupNorm,
    pumpNorm,
    chillerNorm,
    gpuNorm,
    fanNorm,
    inletNorm,
    opticsNorm,
    waterNorm,
    rhNorm,
    ttftNorm,
    queueNorm,
    errNorm,
    facKwNorm,
    epmsAlmNorm,
    reachNorm,
    cmmsOpenNorm,
    backlogNorm,
    nocSevNorm,
    nocPagesNorm,
    genTestNorm,
    upsBatNorm,
  };
}
