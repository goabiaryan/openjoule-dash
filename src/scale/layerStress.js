/** Illustrative pedagogical factors when Scale hall layers are toggled off. */

export const ILLUS_COOL_THROTTLE = 0.68;
export const ILLUS_SPACE_AIRFLOW = 0.82;
export const ILLUS_NET_FABRIC = 0.35;
export const ILLUS_POWER_OFF = 0;

const STRESS_HINTS = {
  space:
    "Space layer off · white-space / hot–cold aisles hidden. Without containment, recirculation rises → ~82% airflow effectiveness when power and cooling paths are on. Turn Space on to show layout.",
  power:
    "Power layer off · busway / whips hidden. No electrical path → 0 kW IT and no plant: chillers, pumps, CDUs, and fans cannot run, so there is no heat rejection. Turn Power on first · cooling depends on it.",
  cool:
    "Cooling layer off · CHW / CDU path hidden (power is on). Rejected heat accumulates → GPU thermal limit → ~68% effective IT when airflow layout holds. Turn Cooling on to restore rejection.",
  net:
    "Network layer off · spine / leaf / floor fabric hidden. GPUs become islands → collective job bandwidth collapses (~35% illustrative). Rack labels show effective Gbps. Turn Network on to restore fabric.",
};

/** Pumps, fans, and CDUs need the same hall power story as IT. */
export function coolingPlantActive(layerOn) {
  return layerOn.power && layerOn.cool;
}

export function layerStressActive(layerOn) {
  return !layerOn.space || !layerOn.power || !layerOn.cool || !layerOn.net;
}

export function illustrativeEffectiveKw(rackKw, layerOn) {
  const kw = Number(rackKw);
  if (!layerOn.power) return 0;
  let factor = 1;
  if (!coolingPlantActive(layerOn)) factor *= ILLUS_COOL_THROTTLE;
  if (!layerOn.space) factor *= ILLUS_SPACE_AIRFLOW;
  return Math.round(kw * factor);
}

export function illustrativeEffectiveGbps(gbpsPerRack, layerOn) {
  const g = Number(gbpsPerRack);
  if (layerOn.net) return Math.round(g);
  return Math.round(g * ILLUS_NET_FABRIC);
}

export function kwStressActive(layerOn) {
  return !layerOn.power || !coolingPlantActive(layerOn) || !layerOn.space;
}

export function activeStressHints(layerOn) {
  const keys = ["space", "power", "cool", "net"].filter((k) => {
    if (k === "cool") return layerOn.power && !layerOn.cool;
    return !layerOn[k];
  });
  return keys.map((k) => ({ id: k, text: STRESS_HINTS[k] }));
}

/** @deprecated use ILLUS_COOL_THROTTLE */
export const ILLUS_THROTTLE_FACTOR = ILLUS_COOL_THROTTLE;
