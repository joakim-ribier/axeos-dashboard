// src/components/ui/GlobalStats/types/index.ts
export interface MinerInfo {
  timestamp?: string;
  hashRateTHs?: number;
  power?: number;
  isUsingFallbackStratum?: number;
  stratumURL?: string;
  fallbackStratumURL?: string;
  sharesAccepted?: number;
  // Persistent, reboot-surviving cumulative total (see MinerInfo in
  // @/types/miner) -- unlike sharesAccepted above, this never drops when a
  // miner itself reboots, so it's what "Total Shares" should actually sum.
  totalSharesAccepted?: number;
  // Persistent, cumulative electricity cost (€) since the miner has been
  // tracked -- same reboot-surviving nature as totalSharesAccepted above.
  // Summed across the fleet for the "Électricité" KPI card's all-time figure.
  totalElectricityCost?: number;
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
