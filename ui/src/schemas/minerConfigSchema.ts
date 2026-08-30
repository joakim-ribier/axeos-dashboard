// src/schemas/minerConfigSchema.ts
import { z } from "zod";

// One schedule entry, as configured in the managed miners file -- the
// action a cron-triggered job runs for this miner (switch to a given
// pool, or restart).
export const cronScheduleSchema = z.object({
  cron: z.string(),
  action: z.enum(["switch_primary", "switch_fallback", "restart"]),
});

export type CronSchedule = z.infer<typeof cronScheduleSchema>;

// Mirrors config.Bitaxe (server/internal/config/config.go) field for field --
// this is both what GET /api/config/miners and GET /api/config/discover
// return, and what a future POST /api/config/miners will accept as-is.
export const minerConfigSchema = z.object({
  ip: z.string(),
  hostname: z.string(),
  mac: z.string(),
  model: z.string(),
  enabled: z.boolean(),
  url: z.string(),
  port: z.number(),
  user: z.string(),
  fallbackUrl: z.string(),
  fallbackPort: z.number(),
  fallbackUser: z.string(),
  schedule: z.array(cronScheduleSchema).optional(),
});

export type MinerConfig = z.infer<typeof minerConfigSchema>;

// GET /api/config/miners and GET /api/config/discover both respond
// {"bitaxes": [...]}, mirroring the managed miners file's own top-level
// shape (see handler.bitaxesResponse server-side). lastUpdated is that
// file's own mtime (RFC3339) -- only ever set on /api/config/miners
// responses (list and save), never on a discovery response, which
// doesn't reflect the file on disk.
export const bitaxesResponseSchema = z.object({
  bitaxes: z.array(minerConfigSchema),
  lastUpdated: z.string().optional(),
});

// normalizeMac strips the colon/hyphen separators a MAC address is
// conventionally written with and lowercases it -- mirrors
// config.NormalizeMac server-side. Two MACs are the same device iff their
// normalized forms match, regardless of how each one happens to be
// formatted (a discovered device's mac comes from the device itself,
// typically uppercase with colons; a hand-written entry in the managed
// miners file could be anything).
export const normalizeMac = (mac: string): string =>
  mac.replace(/[:-]/g, "").toLowerCase();
