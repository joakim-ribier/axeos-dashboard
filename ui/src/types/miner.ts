// src/types/miner.ts
export interface MinerInfo {
  timestamp: string;
  uptimeSeconds: number;

  ip: string;
  macAddr: string;
  hostname?: string;
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

  responseTime: number; // ms

  temp: number; // (°C)
  fanspeed: number; // (%)

  hashRateTHs: number; // TH/s (computed in the backend)
  power: number; // W
  energyJPerTh: number; // J/TH (computed in the backend)
  networkDifficulty: number;
  bestDiff: number;

  stratumURL?: string;
  stratumUser?: string;
  stratumDashboardURL?: string;
  fallbackStratumURL?: string;
  fallbackStratumUser?: string;
  fallbackStratumDashboardURL?: string;
  isUsingFallbackStratum?: number; // 0 = main, 1 = fallback

  electricityRatePerKwh?: number; // €/kWh
}
