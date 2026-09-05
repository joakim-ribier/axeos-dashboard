// src/schemas/appSettingsSchema.ts
import { z } from "zod";

// Mirrors config.ElectricityConfig/PoolsConfig/RemoteConfig/AppSettingsFirmware
// (server/internal/config/config.go) -- this is both what GET
// /api/config/settings returns and what POST /api/config/settings accepts
// as-is (minus readOnly/lastUpdated, which are response-only).
export const electricitySchema = z.object({
  ratePerKwh: z.number(),
});

export const poolsSchema = z.object({
  dashboards: z.record(z.string(), z.string()),
});

export const remoteSchema = z.object({
  pushURL: z.string(),
  apiKey: z.string(),
});

// Keyed by model -- only "bitaxe"/"nerdaxe" are ever meaningful (see
// config.Model), but the schema doesn't enforce that itself: the server
// is the source of truth for validation, this just needs to round-trip
// whatever it sends back.
export const firmwareReposSchema = z.object({
  repos: z.record(z.string(), z.string()),
});

// The read-only process-launch settings shown for visibility only --
// never sent back on save (see handler.appSettingsReadOnly). Durations
// come pre-formatted as Go's time.Duration.String() (e.g. "2m0s"), not
// parsed further here -- just displayed as-is.
export const appSettingsReadOnlySchema = z.object({
  feederInterval: z.string(),
  healthCheckInterval: z.string(),
  firmwareCacheTTL: z.string(),
  // Most recent firmware-repo check across every model, RFC3339 -- absent
  // if none has ever run yet (fresh install).
  firmwareCacheCheckedAt: z.string().optional(),
  // The feeder's own record of its last attempt to push to hashboard
  // (see server/internal/remotepush) -- all three absent together if
  // remote push has never been attempted.
  remotePushLastAttemptAt: z.string().optional(),
  remotePushLastSuccessAt: z.string().optional(),
  remotePushLastError: z.string().optional(),
});

// The built-in registry (server/internal/config/defaults.go) shown
// read-only next to the editable override lists below -- adding a
// well-known pool or fixing a firmware repo URL is a code change, not
// something this page ever writes to.
export const appSettingsDefaultsSchema = z.object({
  pools: poolsSchema,
  firmware: firmwareReposSchema,
});

export const appSettingsSchema = z.object({
  electricity: electricitySchema,
  // pools/firmware here carry override entries only -- the effective
  // value is defaults merged with these, computed server-side. See
  // appSettingsDefaultsSchema for the built-in half of that merge.
  pools: poolsSchema,
  remote: remoteSchema,
  firmware: firmwareReposSchema,
  defaults: appSettingsDefaultsSchema,
  readOnly: appSettingsReadOnlySchema,
  lastUpdated: z.string().optional(),
});

export type ElectricitySettings = z.infer<typeof electricitySchema>;
export type PoolsSettings = z.infer<typeof poolsSchema>;
export type RemoteSettings = z.infer<typeof remoteSchema>;
export type FirmwareReposSettings = z.infer<typeof firmwareReposSchema>;
export type AppSettingsDefaults = z.infer<typeof appSettingsDefaultsSchema>;
export type AppSettingsReadOnly = z.infer<typeof appSettingsReadOnlySchema>;
export type AppSettings = z.infer<typeof appSettingsSchema>;

// What POST /api/config/settings accepts -- the editable subset only
// (mirrors config.AppSettingsFile server-side, no readOnly/lastUpdated).
export type AppSettingsInput = Pick<
  AppSettings,
  "electricity" | "pools" | "remote" | "firmware"
>;
