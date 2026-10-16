/** Short spec-style notes for ? on metrics (no narrative lenses). */

export const TERMS = {
  board_power_w: {
    label: "board_power_w",
    unit: "W",
    formula: "GPU TDP / power limit at rated workload",
    notes: "Per accelerator; not server all-in.",
  },
  server_power_w: {
    label: "server_power_w",
    unit: "W",
    notes: "CPUs + GPUs + NICs + fans + PSU losses at full load.",
  },
  rack_kw: {
    label: "rack_kw",
    unit: "kW",
    notes: "Sum of IT load in one rack enclosure.",
  },
  hall_it_kw: {
    label: "hall_it_kw",
    unit: "kW",
    notes: "Sum of rack IT load in the hall.",
  },
  cooling_class: {
    label: "cooling_class",
    notes: "air | air_rear_door | direct_liquid",
  },
  cfm: {
    label: "airflow_cfm",
    unit: "CFM",
    formula: "kW × 1000 ÷ (1.2 × 1005 × ΔT_K) × 2118.88",
    notes: "Model uses ΔT 12 K for air.",
  },
  feed_amps: {
    label: "feed_amps",
    unit: "A",
    formula: "W ÷ (1.732 × V × PF)",
    notes: "400 V, 3-phase, PF 0.95 in this app.",
  },
  pue: {
    label: "pue",
    formula: "facility power ÷ IT power",
    notes: "Site layer; multiplies hall IT to grid.",
  },
  spare_pct: {
    label: "spare_pct",
    unit: "%",
    notes: "Design headroom on MW / cooling.",
  },
  feed_2n: {
    label: "feed_redundancy",
    notes: "2N = A/B feeds; N = single path.",
  },
  heat_tons: {
    label: "heat_reject_tons",
    unit: "tons refrigeration",
    formula: "kW ÷ 3.517",
  },
  fabric: {
    label: "scale_out_fabric",
    notes: "Leaf/spine ports ≈ GPU NIC endpoints (400G typical).",
  },
  loop_flow_lpm: {
    label: "loop_flow_lpm",
    unit: "L/min",
    formula: "kW × 60 ÷ (4.186 × ΔT_K)",
    notes: "Model uses ΔT 10 K for water/glycol.",
  },
  leaf_switches: {
    label: "leaf_switches",
    notes: "Downlinks ≈ GPUs ÷ ports per leaf (32 in model).",
  },
};

export function term(id) {
  return TERMS[id] ?? null;
}
