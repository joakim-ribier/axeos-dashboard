// src/schemas/minerSchema.ts
import { z } from "zod";

export const alertSchema = z.object({
  type: z.string(),
  message: z.string().optional(),
  value: z.number().optional(),
  threshold: z.number().optional(),
});

export type Alert = z.infer<typeof alertSchema>;

export const minerSchema = z.object({
  timestamp: z.string(),

  ip: z.string(),
  macAddr: z.string(),
  hostname: z.string().optional(),
  // Operator-set override for hostname (see minerConfigSchema.alias) --
  // empty when not set, use utils/minerDisplay.displayName() to get the
  // effective label rather than reading hostname directly.
  alias: z.string().optional(),
  deviceModel: z.string().optional(),
  alive: z.boolean().optional(),
  aliveCheckedAt: z.string().optional(),
  error: z.string().optional(),
  // Computed server-side by the feeder on the poll that produced this
  // sample -- not re-derived client-side, so it always agrees with what's
  // persisted in the day's JSONL (see GET /api/miners/alerts).
  alerts: z.array(alertSchema).optional(),

  sharesAccepted: z.number(),
  sharesRejected: z.number(),
  blockFound: z.number(),

  totalUptimeSeconds: z.number().optional(),
  totalSharesAccepted: z.number().optional(),
  totalSharesRejected: z.number().optional(),

  version: z.string(),
  latestVersion: z.string().optional(),
  updateAvailable: z.boolean().optional(),
  releaseURL: z.string().optional(),
  uptimeSeconds: z.number(),
  responseTime: z.number(),

  hashRateTHs: z.number(),
  power: z.number(),
  energyJPerTh: z.number(),
  networkDifficulty: z.number(),
  bestDiff: z.number(),

  temp: z.number(),
  fanspeed: z.number(),

  stratumURL: z.string().optional(),
  stratumPort: z.number().optional(),
  stratumUser: z.string().optional(),
  stratumDashboardURL: z.string().optional(),
  fallbackStratumURL: z.string().optional(),
  fallbackStratumPort: z.number().optional(),
  fallbackStratumUser: z.string().optional(),
  fallbackStratumDashboardURL: z.string().optional(),
  isUsingFallbackStratum: z.number().int().min(0).max(1).optional(),

  electricityRatePerKwh: z.number().optional(),
});

export type Miner = z.infer<typeof minerSchema>;

// One alert-bearing history line, as returned by GET /api/miners/alerts (and
// the remote equivalent) -- see handler.AlertEntry server-side.
export const alertEntrySchema = z.object({
  timestamp: z.string(),
  minerIp: z.string().optional(),
  minerMac: z.string(),
  hostname: z.string().optional(),
  alerts: z.array(alertSchema),
});

export type AlertEntry = z.infer<typeof alertEntrySchema>;

// One contiguous stretch of the same alert type on the same miner within a
// requested day, as returned by GET /api/miners/alerts/history (and the
// remote equivalent) -- see handler.AlertEpisode server-side. Consecutive
// occurrences of the same (miner, type) are collapsed server-side into one
// episode, so a condition that holds across many polls in a row (e.g. a fan
// stuck high for hours) is one row here, not dozens.
export const alertEpisodeSchema = z.object({
  type: z.string(),
  minerIp: z.string().optional(),
  minerMac: z.string(),
  hostname: z.string().optional(),
  firstSeen: z.string(),
  lastSeen: z.string(),
  occurrences: z.number(),
  peakValue: z.number().optional(),
  threshold: z.number().optional(),
  message: z.string().optional(),
});

export type AlertEpisode = z.infer<typeof alertEpisodeSchema>;

// Paginated response for GET /api/miners/alerts/history (and the remote
// equivalent) -- see handler.AlertHistoryResponse server-side. Unlike
// alertEntrySchema's endpoint (recent-per-miner, for the notification
// bell), this scans one explicitly requested day, grouped into episodes,
// and is the source for the dedicated Alerts page.
export const alertHistoryResponseSchema = z.object({
  episodes: z.array(alertEpisodeSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

export type AlertHistoryResponse = z.infer<typeof alertHistoryResponseSchema>;
