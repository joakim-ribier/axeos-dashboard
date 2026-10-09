import { type Miner } from "@/schemas/minerSchema";

// Same values as the server's defaults (model.DefaultTempThreshold/
// DefaultFanThreshold), but reached rather than exceeded: on the dashboard a
// gauge turns red and its miner goes "warning" at the very same reading. The
// server's own alerts (Alerts page, notifications) keep their > rule.
export const TEMP_THRESHOLD = 62;
export const FAN_THRESHOLD = 75;

export const isTempHigh = (miner: Miner) => miner.temp >= TEMP_THRESHOLD;
export const isFanHigh = (miner: Miner) => miner.fanspeed >= FAN_THRESHOLD;

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
