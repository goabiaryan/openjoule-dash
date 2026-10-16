/** GPU blocks with ISA spec tables (public datasheet reference numbers). */

function gpu(id, name, short, group, spec, isa, ops = {}) {
  return {
    id,
    layer: "gpu",
    name,
    short,
    lane: "power",
    color: "var(--hot)",
    spec: { gpuGroup: group, ...spec },
    isa,
    learn: {
      fields: Object.keys(isa),
      watch: ops.watch ?? "Power, temperature, ECC, throttle flags",
      fails: ops.fails ?? "Thermal throttle, XID / HBM errors",
    },
  };
}

function g(spec, extra) {
  return {
    board_power_w: spec.boardPowerW,
    memory_gb: spec.memoryGb,
    max_temp_c: spec.maxTempC,
    scale_out_gbps: spec.scaleOutGbps,
    cooling_method: spec.coolingMethod,
    ...extra,
  };
}

export const GPU_GROUP_LABELS = {
  "l-series": "L-series",
  ampere: "Ampere (A)",
  hopper: "Hopper (H)",
  blackwell: "Blackwell (B)",
  ada: "Ada",
  legacy: "Legacy",
  amd: "AMD Instinct",
};

export const GPU_BLOCKS = [
  gpu(
    "gpu-l4",
    "L4",
    "72 W · 24 GB",
    "l-series",
    { boardPowerW: 72, coolingMethod: "air", maxTempC: 89, scaleOutGbps: 100, memoryGb: 24 },
    g(
      { boardPowerW: 72, memoryGb: 24, maxTempC: 89, scaleOutGbps: 100, coolingMethod: "air" },
      {
        form_factor: "PCIe single-slot",
        memory_type: "GDDR6",
        pcie_gen: "4.0 x16",
        power_cap_range_w: "72",
        scale_up_link: "PCIe only",
        nvlink: "none",
      },
    ),
  ),
  gpu(
    "gpu-l40",
    "L40",
    "300 W · 48 GB",
    "l-series",
    { boardPowerW: 300, coolingMethod: "air", maxTempC: 88, scaleOutGbps: 100, memoryGb: 48 },
    g(
      { boardPowerW: 300, memoryGb: 48, maxTempC: 88, scaleOutGbps: 100, coolingMethod: "air" },
      {
        form_factor: "PCIe dual-slot",
        memory_type: "GDDR6",
        pcie_gen: "4.0 x16",
        power_cap_range_w: "300",
        scale_up_link: "PCIe only",
      },
    ),
  ),
  gpu(
    "gpu-l40s",
    "L40S",
    "350 W · 48 GB",
    "l-series",
    { boardPowerW: 350, coolingMethod: "air", maxTempC: 88, scaleOutGbps: 100, memoryGb: 48 },
    g(
      { boardPowerW: 350, memoryGb: 48, maxTempC: 88, scaleOutGbps: 100, coolingMethod: "air" },
      {
        form_factor: "PCIe dual-slot",
        memory_type: "GDDR6",
        pcie_gen: "4.0 x16",
        power_cap_range_w: "350",
      },
    ),
  ),
  gpu(
    "gpu-l20",
    "L20",
    "275 W · 48 GB",
    "l-series",
    { boardPowerW: 275, coolingMethod: "air", maxTempC: 88, scaleOutGbps: 100, memoryGb: 48 },
    g(
      { boardPowerW: 275, memoryGb: 48, maxTempC: 88, scaleOutGbps: 100, coolingMethod: "air" },
      { form_factor: "PCIe dual-slot", memory_type: "GDDR6", power_cap_range_w: "275" },
    ),
  ),
  gpu(
    "gpu-a10",
    "A10",
    "150 W · 24 GB",
    "ada",
    { boardPowerW: 150, coolingMethod: "air", maxTempC: 85, scaleOutGbps: 50, memoryGb: 24 },
    g(
      { boardPowerW: 150, memoryGb: 24, maxTempC: 85, scaleOutGbps: 50, coolingMethod: "air" },
      { form_factor: "PCIe single-slot", memory_type: "GDDR6", power_cap_range_w: "150" },
    ),
  ),
  gpu(
    "gpu-a30",
    "A30",
    "165 W · 24 GB",
    "ampere",
    { boardPowerW: 165, coolingMethod: "air", maxTempC: 83, scaleOutGbps: 200, memoryGb: 24 },
    g(
      { boardPowerW: 165, memoryGb: 24, maxTempC: 83, scaleOutGbps: 200, coolingMethod: "air" },
      { form_factor: "PCIe single-slot", memory_type: "HBM2", power_cap_range_w: "165" },
    ),
  ),
  gpu(
    "gpu-a100-pcie",
    "A100 PCIe",
    "300 W · 80 GB",
    "ampere",
    { boardPowerW: 300, coolingMethod: "air", maxTempC: 83, scaleOutGbps: 200, memoryGb: 80 },
    g(
      { boardPowerW: 300, memoryGb: 80, maxTempC: 83, scaleOutGbps: 200, coolingMethod: "air" },
      {
        form_factor: "PCIe dual-slot",
        memory_type: "HBM2e",
        memory_bandwidth_gb_s: 1935,
        pcie_gen: "4.0 x16",
        power_cap_range_w: "250–300",
        nvlink: "optional bridge, 600 GB/s",
        scale_up_link: "NVLink bridge (not full NVSwitch)",
      },
    ),
  ),
  gpu(
    "gpu-a100-sxm",
    "A100 SXM",
    "400 W · 80 GB",
    "ampere",
    { boardPowerW: 400, coolingMethod: "cold_plate", maxTempC: 83, scaleOutGbps: 400, memoryGb: 80 },
    g(
      { boardPowerW: 400, memoryGb: 80, maxTempC: 83, scaleOutGbps: 400, coolingMethod: "cold_plate" },
      {
        form_factor: "SXM4",
        memory_type: "HBM2e",
        memory_bandwidth_gb_s: 2039,
        power_cap_range_w: "400",
        scale_up_link: "NVLink 3, 600 GB/s per GPU",
        nvlink_links_per_gpu: 12,
      },
    ),
  ),
  gpu(
    "gpu-a800-sxm",
    "A800 SXM",
    "400 W · 80 GB",
    "ampere",
    { boardPowerW: 400, coolingMethod: "cold_plate", maxTempC: 83, scaleOutGbps: 400, memoryGb: 80 },
    g(
      { boardPowerW: 400, memoryGb: 80, maxTempC: 83, scaleOutGbps: 400, coolingMethod: "cold_plate" },
      {
        form_factor: "SXM4",
        memory_type: "HBM2e",
        power_cap_range_w: "400",
        scale_up_link: "NVLink 3, 400 GB/s per GPU (export SKU)",
      },
    ),
  ),
  gpu(
    "gpu-h100",
    "H100 SXM",
    "700 W · 80 GB",
    "hopper",
    { boardPowerW: 700, coolingMethod: "cold_plate", maxTempC: 83, scaleOutGbps: 400, memoryGb: 80 },
    g(
      { boardPowerW: 700, memoryGb: 80, maxTempC: 83, scaleOutGbps: 400, coolingMethod: "cold_plate" },
      {
        form_factor: "SXM5",
        memory_type: "HBM3",
        memory_bandwidth_gb_s: 3350,
        power_cap_range_w: "350–700",
        scale_up_link: "NVLink 4, 900 GB/s per GPU",
        nvlink_links_per_gpu: 18,
        typical_nic: "ConnectX-7 400GbE/NDR IB",
        hgx_8gpu_nvlink: "900 GB/s all-to-all within node",
      },
    ),
  ),
  gpu(
    "gpu-h100-pcie",
    "H100 PCIe",
    "350 W · 80 GB",
    "hopper",
    { boardPowerW: 350, coolingMethod: "air", maxTempC: 83, scaleOutGbps: 400, memoryGb: 80 },
    g(
      { boardPowerW: 350, memoryGb: 80, maxTempC: 83, scaleOutGbps: 400, coolingMethod: "air" },
      {
        form_factor: "PCIe dual-slot",
        memory_type: "HBM3",
        memory_bandwidth_gb_s: 2000,
        pcie_gen: "5.0 x16",
        power_cap_range_w: "310–350",
        scale_up_link: "PCIe; NVLink bridge optional",
      },
    ),
  ),
  gpu(
    "gpu-h200",
    "H200 SXM",
    "700 W · 141 GB",
    "hopper",
    { boardPowerW: 700, coolingMethod: "cold_plate", maxTempC: 83, scaleOutGbps: 400, memoryGb: 141 },
    g(
      { boardPowerW: 700, memoryGb: 141, maxTempC: 83, scaleOutGbps: 400, coolingMethod: "cold_plate" },
      {
        form_factor: "SXM5",
        memory_type: "HBM3e",
        memory_bandwidth_gb_s: 4800,
        power_cap_range_w: "700",
        scale_up_link: "NVLink 4, 900 GB/s per GPU",
        nvlink_links_per_gpu: 18,
      },
    ),
  ),
  gpu(
    "gpu-b200",
    "B200",
    "1,000 W · 192 GB",
    "blackwell",
    { boardPowerW: 1000, coolingMethod: "liquid", maxTempC: 85, scaleOutGbps: 400, memoryGb: 192 },
    g(
      { boardPowerW: 1000, memoryGb: 192, maxTempC: 85, scaleOutGbps: 400, coolingMethod: "liquid" },
      {
        form_factor: "SXM (Blackwell)",
        memory_type: "HBM3e",
        power_cap_range_w: "1000",
        scale_up_link: "NVLink 5 (within NVL domain)",
        cooling: "direct liquid required",
      },
    ),
  ),
  gpu(
    "gpu-b100",
    "B100",
    "700 W · 192 GB",
    "blackwell",
    { boardPowerW: 700, coolingMethod: "cold_plate", maxTempC: 85, scaleOutGbps: 400, memoryGb: 192 },
    g(
      { boardPowerW: 700, memoryGb: 192, maxTempC: 85, scaleOutGbps: 400, coolingMethod: "cold_plate" },
      { form_factor: "SXM", memory_type: "HBM3e", power_cap_range_w: "700" },
    ),
  ),
  gpu(
    "gpu-t4",
    "T4",
    "70 W · 16 GB",
    "legacy",
    { boardPowerW: 70, coolingMethod: "air", maxTempC: 85, scaleOutGbps: 50, memoryGb: 16 },
    g(
      { boardPowerW: 70, memoryGb: 16, maxTempC: 85, scaleOutGbps: 50, coolingMethod: "air" },
      { form_factor: "PCIe low-profile", memory_type: "GDDR6", power_cap_range_w: "70" },
    ),
  ),
  gpu(
    "gpu-v100-sxm",
    "V100 SXM",
    "300 W · 32 GB",
    "legacy",
    { boardPowerW: 300, coolingMethod: "air", maxTempC: 83, scaleOutGbps: 300, memoryGb: 32 },
    g(
      { boardPowerW: 300, memoryGb: 32, maxTempC: 83, scaleOutGbps: 300, coolingMethod: "air" },
      { form_factor: "SXM2", memory_type: "HBM2", scale_up_link: "NVLink 2, 300 GB/s" },
    ),
  ),
  gpu(
    "gpu-mi210",
    "MI210",
    "300 W · 64 GB",
    "amd",
    { boardPowerW: 300, coolingMethod: "air", maxTempC: 90, scaleOutGbps: 400, memoryGb: 64 },
    g(
      { boardPowerW: 300, memoryGb: 64, maxTempC: 90, scaleOutGbps: 400, coolingMethod: "air" },
      {
        form_factor: "PCIe dual-slot",
        memory_type: "HBM2e",
        scale_up_link: "Infinity Fabric / PCIe",
        vendor: "AMD",
      },
    ),
  ),
  gpu(
    "gpu-mi300x",
    "MI300X",
    "750 W · 192 GB",
    "amd",
    { boardPowerW: 750, coolingMethod: "liquid", maxTempC: 90, scaleOutGbps: 400, memoryGb: 192 },
    g(
      { boardPowerW: 750, memoryGb: 192, maxTempC: 90, scaleOutGbps: 400, coolingMethod: "liquid" },
      {
        form_factor: "OAM",
        memory_type: "HBM3",
        memory_bandwidth_gb_s: 5300,
        power_cap_range_w: "750",
        scale_up_link: "Infinity Fabric",
        vendor: "AMD",
      },
    ),
  ),
  gpu(
    "gpu-mi325x",
    "MI325X",
    "1,000 W · 256 GB",
    "amd",
    { boardPowerW: 1000, coolingMethod: "liquid", maxTempC: 90, scaleOutGbps: 400, memoryGb: 256 },
    g(
      { boardPowerW: 1000, memoryGb: 256, maxTempC: 90, scaleOutGbps: 400, coolingMethod: "liquid" },
      { form_factor: "OAM", memory_type: "HBM3e", power_cap_range_w: "1000", vendor: "AMD" },
    ),
  ),
];

export const GPU_GROUP_ORDER = ["l-series", "ada", "ampere", "hopper", "blackwell", "legacy", "amd"];
