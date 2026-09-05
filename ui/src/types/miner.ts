// src/types/miner.ts
export interface MinerInfo {
  timestamp: string;
  uptimeSeconds: number;

  ip: string;
  macAddr: string;
  hostname?: string;
  alias?: string;
  deviceModel?: string;
  alive?: boolean;
  aliveCheckedAt?: string;
  error?: string;
  version: string;
  latestVersion?: string;
  updateAvailable?: boolean;
  releaseURL?: string;

  sharesAccepted: number;
  sharesRejected: number;
  blockFound: number;

  // Total* are persistent, reboot-surviving counters -- unlike the fields
  // above, which reset whenever the device itself reboots, these keep
  // accumulating for as long as the miner has been tracked. Absent (0) until
  // the feeder or the backfill tool has written at least one value.
  totalUptimeSeconds?: number;
  totalSharesAccepted?: number;
  totalSharesRejected?: number;

  responseTime: number; // ms

  temp: number; // (°C)
  fanspeed: number; // (%)

  hashRateTHs: number; // TH/s (computed in the backend)
  power: number; // W
  energyJPerTh: number; // J/TH (computed in the backend)
  networkDifficulty: number;
  bestDiff: number;

  stratumURL?: string;
  stratumPort?: number;
  stratumUser?: string;
  stratumDashboardURL?: string;
  fallbackStratumURL?: string;
  fallbackStratumPort?: number;
  fallbackStratumUser?: string;
  fallbackStratumDashboardURL?: string;
  isUsingFallbackStratum?: number; // 0 = main, 1 = fallback

  electricityRatePerKwh?: number; // €/kWh
}
