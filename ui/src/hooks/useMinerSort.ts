// src/hooks/useMinerSort.ts
import { useCallback, useEffect, useState } from "react";

import { type Miner } from "@/schemas/minerSchema";

export type MinerSortKey =
  "oldest" | "sharesAccepted" | "fan" | "temp" | "pool";

const STORAGE_KEY = "axeos.minerSort";
const DEFAULT_SORT: MinerSortKey = "oldest";

const isMinerSortKey = (value: string): value is MinerSortKey =>
  value === "oldest" ||
  value === "sharesAccepted" ||
  value === "fan" ||
  value === "temp" ||
  value === "pool";

const loadFromStorage = (): MinerSortKey => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw && isMinerSortKey(raw)) return raw;
    return DEFAULT_SORT;
  } catch {
    return DEFAULT_SORT;
  }
};

/** The pool a miner is actually mining on right now -- the fallback slot
 * when it's active, the primary one otherwise. Mirrors Home.tsx's own
 * poolEntries grouping logic, so the "by pool" sort groups miners the same
 * way the pool filter chips already do. */
const activePoolURL = (m: Miner): string =>
  (m.isUsingFallbackStratum === 1 ? m.fallbackStratumURL : m.stratumURL) ?? "";

/** Higher-is-first for every numeric criterion (oldest/most shares/hottest
 * fan/highest temp) -- missing values sort last rather than first, so a
 * miner mid-poll with no data yet doesn't jump to the top. Pool is the one
 * alphabetical (A-Z) exception. */
const comparators: Record<MinerSortKey, (a: Miner, b: Miner) => number> = {
  oldest: (a, b) => (b.totalUptimeSeconds ?? -1) - (a.totalUptimeSeconds ?? -1),
  sharesAccepted: (a, b) =>
    (b.totalSharesAccepted ?? -1) - (a.totalSharesAccepted ?? -1),
  fan: (a, b) => b.fanspeed - a.fanspeed,
  temp: (a, b) => b.temp - a.temp,
  pool: (a, b) => activePoolURL(a).localeCompare(activePoolURL(b)),
};

export const sortMiners = (miners: Miner[], sort: MinerSortKey): Miner[] =>
  [...miners].sort(comparators[sort]);

export interface UseMinerSortReturn {
  sort: MinerSortKey;
  setSort: (sort: MinerSortKey) => void;
}

export const useMinerSort = (): UseMinerSortReturn => {
  const [sort, setSortState] = useState<MinerSortKey>(loadFromStorage);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, sort);
    } catch {
      // localStorage can throw (private browsing quota, disabled storage) --
      // the choice simply won't survive a refresh in that case.
    }
  }, [sort]);

  const setSort = useCallback((next: MinerSortKey) => {
    setSortState(next);
  }, []);

  return { sort, setSort };
};
