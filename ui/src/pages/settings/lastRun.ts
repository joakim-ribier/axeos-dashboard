// src/pages/settings/lastRun.ts
import { useEffect, useState } from "react";

import { useMiners } from "@/hooks/useMiners";
import { parseGoDuration } from "@/utils/format";

/** Latest of a list of possibly-missing ISO timestamps, or undefined if none. */
export const latestTimestamp = (
  values: (string | undefined)[],
): string | undefined =>
  values.reduce<string | undefined>((latest, v) => {
    if (!v) return latest;
    if (!latest || new Date(v).getTime() > new Date(latest).getTime()) {
      return v;
    }
    return latest;
  }, undefined);

// "Stale" means no confirmed run within roughly twice the configured
// interval (a generous margin -- polling isn't perfectly on-beat, and
// this is meant to catch a loop that's actually stuck, not flag normal
// jitter). No data at all (fresh install, nothing enabled yet) reads as
// stale too, since there's nothing to confirm the loop is actually
// running against.
export const isStale = (
  at: number,
  lastAt: string | undefined,
  intervalStr?: string,
) => {
  if (!lastAt) return true;
  const intervalMs = parseGoDuration(intervalStr);
  if (intervalMs <= 0) return false;
  return at - new Date(lastAt).getTime() > intervalMs * 2 + 5_000;
};

/**
 * "Now" for the staleness indicators, captured in an effect rather than read
 * during render (Date.now() is impure) -- refreshed whenever the miners data
 * changes, the natural refresh cadence of what these indicators judge.
 */
export const useNow = (): number | null => {
  const { data: miners } = useMiners();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
  }, [miners]);
  return now;
};
