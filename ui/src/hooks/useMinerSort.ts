// src/hooks/useMinerSort.ts
import { type Miner } from "@/schemas/minerSchema";
import { activePoolUrl } from "@/utils/minerDisplay";
import { type MinerStatus, urgency } from "@/utils/minerStatus";

import { useStoredChoice } from "./useStoredChoice";

export const MINER_SORT_KEYS = [
  "temp",
  "hashrate",
  "fan",
  "sharesAccepted",
  "oldest",
  "pool",
] as const;

export type MinerSortKey = (typeof MINER_SORT_KEYS)[number];

// Temp and fan are shown as whole numbers -- sorting on the hidden decimals
// would put a "60°C" above another "60°C" for no visible reason.
const shownTemp = (m: Miner) => Math.round(m.temp);
const shownFan = (m: Miner) => Math.round(m.fanspeed);

/** Higher-is-first for every numeric criterion -- missing values sort last
 * rather than first, so a miner mid-poll with no data yet doesn't jump to
 * the top. Hottest breaks ties on the fan, the other sign of a miner
 * working hard. Pool is the one alphabetical (A-Z) exception. */
const comparators: Record<MinerSortKey, (a: Miner, b: Miner) => number> = {
  temp: (a, b) => shownTemp(b) - shownTemp(a) || shownFan(b) - shownFan(a),
  hashrate: (a, b) => b.hashRateTHs - a.hashRateTHs,
  fan: (a, b) => shownFan(b) - shownFan(a),
  sharesAccepted: (a, b) =>
    (b.totalSharesAccepted ?? -1) - (a.totalSharesAccepted ?? -1),
  oldest: (a, b) => (b.totalUptimeSeconds ?? -1) - (a.totalUptimeSeconds ?? -1),
  pool: (a, b) => activePoolUrl(a).localeCompare(activePoolUrl(b)),
};

/** A miner with a problem always comes first, most urgent first, whatever
 * the chosen sort -- that only orders miners within the same status. */
export const sortMiners = (
  miners: Miner[],
  sort: MinerSortKey,
  statusOf: (miner: Miner) => MinerStatus,
): Miner[] => {
  const rank = (m: Miner) => urgency(statusOf(m));
  return [...miners].sort(
    (a, b) => rank(a) - rank(b) || comparators[sort](a, b),
  );
};

export const useMinerSort = () =>
  useStoredChoice<MinerSortKey>("axeos.minerSort", MINER_SORT_KEYS, "temp");
