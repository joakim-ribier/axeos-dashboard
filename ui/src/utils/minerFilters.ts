// src/utils/minerFilters.ts
import { Miner } from "@/schemas/minerSchema";
import { activePoolUrl } from "@/utils/minerDisplay";
import { type MinerStatus } from "@/utils/minerStatus";

export interface QuickFilters {
  selectedPool: string | null;
  selectedDeviceModel: string | null;
  selectedVersion: string | null;
  selectedStatus: MinerStatus | null;
}

export const NO_QUICK_FILTERS: QuickFilters = {
  selectedPool: null,
  selectedDeviceModel: null,
  selectedVersion: null,
  selectedStatus: null,
};

/**
 * Quick, pre-built filters — pool, device model, firmware version and
 * status — as an alternative to typing a comparison into the free text
 * search (matchesSearch in minerSearch.ts, still available alongside
 * these). Every active filter must match.
 */
export const matchesQuickFilters = (
  miner: Miner,
  status: MinerStatus,
  filters: QuickFilters,
): boolean =>
  (!filters.selectedPool || activePoolUrl(miner) === filters.selectedPool) &&
  (!filters.selectedDeviceModel ||
    miner.deviceModel === filters.selectedDeviceModel) &&
  (!filters.selectedVersion || miner.version === filters.selectedVersion) &&
  (!filters.selectedStatus || status === filters.selectedStatus);
