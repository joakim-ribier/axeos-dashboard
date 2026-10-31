// src/schemas/minerSchema.ts
import { z } from "zod";

// What a board gets instead of a value its dashboard doesn't share (the
// feeder's remotePayload) -- read as no value at all, so it shows nowhere.
const OBFUSCATED = "xxxxxxxx";
const unlessObfuscated = z.preprocess(
  (value) => (value === OBFUSCATED ? undefined : value),
  z.string().optional(),
);

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

  sharesAccepted: z.number(),
  sharesRejected: z.number(),
  blockFound: z.number(),

  totalUptimeSeconds: z.number().optional(),
  totalSharesAccepted: z.number().optional(),
  totalSharesRejected: z.number().optional(),
  totalElectricityCost: z.number().optional(),

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

  stratumURL: unlessObfuscated,
  stratumPort: z.number().optional(),
  stratumUser: unlessObfuscated,
  stratumDashboardURL: z.string().optional(),
  fallbackStratumURL: unlessObfuscated,
  fallbackStratumPort: z.number().optional(),
  fallbackStratumUser: unlessObfuscated,
  fallbackStratumDashboardURL: z.string().optional(),
  isUsingFallbackStratum: z.number().int().min(0).max(1).optional(),

  electricityRatePerKwh: z.number().optional(),
});

export type Miner = z.infer<typeof minerSchema>;

// An alert raised (when it starts) or cleared (when it ends) -- see
// alerts.Event server-side. value: the reading that raised it (temp/fan);
// message: what it's about (the firmware available, the MAC reported, the
// connection error).
export const alertEventSchema = z.object({
  ts: z.string(),
  mac: z.string(),
  ip: z.string().optional(),
  hostname: z.string().optional(),
  type: z.string(),
  state: z.enum(["raised", "cleared"]),
  value: z.number().optional(),
  threshold: z.number().optional(),
  message: z.string().optional(),
  raisedAt: z.string().optional(),
  // Cleared only: the highest reading while it lasted (temp/fan).
  peak: z.number().optional(),
});

export type AlertEvent = z.infer<typeof alertEventSchema>;

// GET /api/miners/alerts: the bell's content, and up to when it's been read
// (absent: never) -- shared by every browser.
export const alertsResponseSchema = z.object({
  events: z.array(alertEventSchema),
  seenAt: z.string().optional(),
});

export type AlertsResponse = z.infer<typeof alertsResponseSchema>;

// GET /api/miners/alerts/history: one day's events, paginated.
export const alertHistoryResponseSchema = z.object({
  events: z.array(alertEventSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

export type AlertHistoryResponse = z.infer<typeof alertHistoryResponseSchema>;

// GET /api/miners/history (and the remote equivalent) -- see
// handler.HistoryResponse server-side. Each series has one point per
// bucket, oldest first, starting at `from`. A hashRate of 0 means the miner
// was unreachable; null means nothing was recorded at all (feeder stopped).
const minerHistorySchema = z.object({
  ip: z.string(),
  hashRate: z.array(z.number().nullable()),
});

export const minersHistorySchema = z.object({
  from: z.string(),
  bucketSeconds: z.number(),
  miners: z.array(minerHistorySchema),
});

export type MinersHistory = z.infer<typeof minersHistorySchema>;
