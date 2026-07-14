// src/components/ui/GlobalStats/types/index.ts
export interface MinerInfo {
  timestamp?: string;
  hashRateTHs?: number;
  power?: number;
  isUsingFallbackStratum?: number;
  stratumURL?: string;
  fallbackStratumURL?: string;
  sharesAccepted?: number;
  temp?: number;
  fanspeed?: number;
  electricityRatePerKwh?: number;
}

export interface PoolStats {
  hashRate: number;
  shares: number;
  isFallback: boolean;
  minerCount: number;
}

export interface GlobalStatsProps {
  data?: MinerInfo[];
  isLoading: boolean;
}
