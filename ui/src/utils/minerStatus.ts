import { type Miner } from "@/schemas/minerSchema";

// A miner's alert thresholds, as the server sends them -- the built-in
// ones on a board, which isn't told a miner's own -- with the server's
// same > rule.
export const tempThreshold = (miner: Miner) => miner.tempThreshold ?? 62;
export const fanThreshold = (miner: Miner) => miner.fanThreshold ?? 75;

export const isTempHigh = (miner: Miner) => miner.temp > tempThreshold(miner);
export const isFanHigh = (miner: Miner) => miner.fanspeed > fanThreshold(miner);

/** Most urgent first -- the order of the status chips, and of the miners
 * pinned at the top of the list. */
export const MINER_STATUSES = [
  "offline",
  "configError",
  "stale",
  "warning",
  "ok",
] as const;

export type MinerStatus = (typeof MINER_STATUSES)[number];

/** Lower is more urgent -- sorts miners worst first. */
export const urgency = (status: MinerStatus) => MINER_STATUSES.indexOf(status);

export const STATUS_COLOR: Record<MinerStatus, string> = {
  offline: "error.main",
  configError: "warning.main",
  stale: "grey.500",
  warning: "#fdd835",
  ok: "success.main",
};

/** `stale`: the miner still answers the health check, but its readings
 * stopped coming in -- see useMinerStatus for the rule. */
export const getMinerStatus = (miner: Miner, stale: boolean): MinerStatus => {
  if (miner.alive === false) return "offline";
  if (miner.error) return "configError";
  if (stale) return "stale";
  if (isTempHigh(miner) || isFanHigh(miner)) return "warning";
  return "ok";
};
