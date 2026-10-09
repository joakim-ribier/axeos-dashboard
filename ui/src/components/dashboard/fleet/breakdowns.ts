import { type TFunction } from "i18next";

import { type Miner } from "@/schemas/minerSchema";
import { activePoolUrl, poolHostname } from "@/utils/minerDisplay";
import {
  MINER_STATUSES,
  type MinerStatus,
  STATUS_COLOR,
} from "@/utils/minerStatus";

import { type BreakdownSegment } from "./BreakdownStrip";

const POOL_COLORS = ["primary.main", "#8b7cf6", "#2ec4b6", "#e07bb5"];

/** How many miners are in each status, most urgent first. */
export const statusSegments = (
  miners: Miner[],
  statusOf: (miner: Miner) => MinerStatus,
  t: TFunction,
): BreakdownSegment[] =>
  MINER_STATUSES.map((status) => {
    const count = miners.filter((m) => statusOf(m) === status).length;
    return {
      key: status,
      label: t(`dashboard.status.${status}`),
      value: count,
      detail: String(count),
      color: STATUS_COLOR[status],
    };
  });

/** Each active pool's share of the fleet's hashrate, biggest first. A pool
 * whose miners are all offline stays listed at 0% -- a filter set on it can
 * still be cleared. */
export const poolSegments = (miners: Miner[]): BreakdownSegment[] => {
  const hashRates = new Map<string, number>();
  miners.forEach((m) => {
    const url = activePoolUrl(m);
    if (!url) return;
    const live = m.alive === false ? 0 : m.hashRateTHs;
    hashRates.set(url, (hashRates.get(url) ?? 0) + live);
  });
  const total = [...hashRates.values()].reduce((a, b) => a + b, 0);

  return [...hashRates]
    .sort((a, b) => b[1] - a[1])
    .map(([url, hashRate], i) => ({
      key: url,
      label: poolHostname(url),
      value: hashRate,
      detail: `${total ? Math.round((hashRate / total) * 100) : 0} %`,
      color: POOL_COLORS[i % POOL_COLORS.length],
    }));
};
