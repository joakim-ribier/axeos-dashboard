// src/utils/minerFilters.ts
import { Miner } from "@/schemas/minerSchema";

export interface QuickFilters {
  selectedPool: string | null;
  selectedDeviceModel: string | null;
  alertTemp: boolean;
  alertFan: boolean;
  alertOffline: boolean;
}

export const NO_QUICK_FILTERS: QuickFilters = {
  selectedPool: null,
  selectedDeviceModel: null,
  alertTemp: false,
  alertFan: false,
  alertOffline: false,
};

const minerPoolUrl = (miner: Miner): string | undefined =>
  miner.isUsingFallbackStratum === 1
    ? miner.fallbackStratumURL
    : miner.stratumURL;

/**
 * Quick, pre-built filters — pool, device model, and "currently in an
 * alert state" — as an alternative to typing a comparison into the free
 * text search (matchesSearch in minerSearch.ts, still available alongside
 * these). Pool and device model narrow the set (AND'd with everything
 * else); the three alert flags are OR'd together when more than one is
 * active — "show anyone flagged for ANY of these reasons" reads more
 * useful at a glance than requiring all of them at once.
 *
 * The alert flags read the miner's own `alerts` field -- computed
 * server-side by the feeder (see server/internal/model/alert.go) -- so
 * "who's over the line" always agrees with what's shown in the alerts
 * history and the notification bell, with no threshold duplicated here.
 */
export const matchesQuickFilters = (
  miner: Miner,
  filters: QuickFilters,
): boolean => {
  if (filters.selectedPool && minerPoolUrl(miner) !== filters.selectedPool) {
    return false;
  }

  if (
    filters.selectedDeviceModel &&
    miner.deviceModel !== filters.selectedDeviceModel
  ) {
    return false;
  }

  const anyAlertActive =
    filters.alertTemp || filters.alertFan || filters.alertOffline;
  if (anyAlertActive) {
    const alertTypes = new Set(miner.alerts?.map((a) => a.type));
    const isOverTemp = filters.alertTemp && alertTypes.has("tempHigh");
    const isOverFan = filters.alertFan && alertTypes.has("fanHigh");
    const isOffline = filters.alertOffline && miner.alive === false;
    if (!isOverTemp && !isOverFan && !isOffline) return false;
  }

  return true;
};
