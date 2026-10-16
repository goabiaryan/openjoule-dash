/** All-in server and rack kW from GPU TDP + declared platform overhead. */

export function deriveServerKw(gpu, server) {
  if (!server) return 10.2;
  const n = server.spec?.gpusPerServer ?? 8;
  const gpuW = gpu?.spec?.boardPowerW ?? 700;
  const platformW = server.spec?.platformOverheadW ?? 800;
  return (gpuW * n + platformW) / 1000;
}

export function deriveRackKwDisaggregated(gpu, server, rack) {
  const serverKw = deriveServerKw(gpu, server);
  const serversPerRack = rack?.spec?.serversPerRack ?? 4;
  return serverKw * serversPerRack;
}
