// src/schemas/appSettingsSchema.ts
import { z } from "zod";

export const powerDeviceSchema = z.object({
  name: z.string(),
  power: z.number(),
});

// Mirrors config.ElectricityConfig/PoolsConfig/RemoteConfig/AppSettingsFirmware
// (server/internal/config/config.go) -- this is both what GET
// /api/config/settings returns and what POST /api/config/settings accepts
// as-is (minus readOnly/lastUpdated, which are response-only).
export const electricitySchema = z.object({
  ratePerKwh: z.number(),
  devices: z.array(powerDeviceSchema).optional(),
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

// The feeder's own record of its last attempt to push one config endpoint
// to hashboard (see server/internal/remotepush) -- all three fields absent
// together if that endpoint has never been attempted.
export const remotePushEndpointStatusSchema = z.object({
  lastAttemptAt: z.string().optional(),
  lastSuccessAt: z.string().optional(),
  lastError: z.string().optional(),
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
  // Tracked separately per config endpoint, not merged into one status --
  // one endpoint succeeding must never hide the other currently failing.
  remotePushMinersConfig: remotePushEndpointStatusSchema,
  remotePushSettingsConfig: remotePushEndpointStatusSchema,
  // The feeder's record of the daily audit mail -- absent fields until it
  // first ran.
  auditReport: z
    .object({
      lastFrom: z.string().optional(),
      lastTo: z.string().optional(),
      lastSentAt: z.string().optional(),
      lastAttemptAt: z.string().optional(),
      lastError: z.string().optional(),
    })
    .default({}),
});

// The built-in registry (server/internal/config/defaults.go) shown
// read-only next to the editable override lists below -- adding a
// well-known pool or fixing a firmware repo URL is a code change, not
// something this page ever writes to.
export const appSettingsDefaultsSchema = z.object({
  pools: poolsSchema,
  firmware: firmwareReposSchema,
});

export const smtpSecuritySchema = z.enum(["starttls", "tls", "none"]);

// The SMTP server as GET /api/config/settings shows it: the password itself
// never comes back, only whether one is set.
export const smtpSettingsSchema = z.object({
  host: z.string(),
  port: z.number(),
  security: z.union([smtpSecuritySchema, z.literal("")]),
  username: z.string(),
  from: z.string(),
  passwordSet: z.boolean(),
});

export const reportFrequencySchema = z.enum([
  "daily",
  "every2days",
  "weekly",
  "monthly",
]);

export const auditReportSettingsSchema = z.object({
  enabled: z.boolean(),
  // "" until first set -- daily then.
  frequency: z.union([reportFrequencySchema, z.literal("")]),
  // Empty = every type.
  types: z.array(z.string()),
  skipIfEmpty: z.boolean(),
});

// The mail channel: the SMTP server and the recipients.
export const mailSettingsSchema = z.object({
  smtp: smtpSettingsSchema,
  to: z.array(z.string()),
});

// Everything the dashboard sends on its own (config.NotificationsConfig):
// how its messages read, the channels they go through, and what goes out.
export const notificationsSettingsSchema = z.object({
  // "fr" | "en" -- "" until first set.
  language: z.string().default(""),
  // The dashboard's address, for the messages' links -- "" until set.
  dashboardURL: z.string().default(""),
  mail: mailSettingsSchema,
  auditReport: auditReportSettingsSchema.default({
    enabled: false,
    frequency: "",
    types: [],
    skipIfEmpty: false,
  }),
});

// A board's pushed settings never carry notifications at all -- empty ones
// then.
export const EMPTY_NOTIFICATIONS: z.infer<typeof notificationsSettingsSchema> =
  {
    language: "",
    dashboardURL: "",
    mail: {
      smtp: {
        host: "",
        port: 0,
        security: "",
        username: "",
        from: "",
        passwordSet: false,
      },
      to: [],
    },
    auditReport: {
      enabled: false,
      frequency: "",
      types: [],
      skipIfEmpty: false,
    },
  };

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
  notifications: notificationsSettingsSchema.default(EMPTY_NOTIFICATIONS),
  lastUpdated: z.string().optional(),
});

export type PowerDevice = z.infer<typeof powerDeviceSchema>;
export type AppSettings = z.infer<typeof appSettingsSchema>;

// What POST /api/config/settings accepts -- the editable subset only
// (mirrors config.AppSettingsFile server-side, no readOnly/lastUpdated).
export type AppSettingsInput = Pick<
  AppSettings,
  "electricity" | "pools" | "remote" | "firmware"
> & {
  notifications: Omit<AppSettings["notifications"], "mail"> & {
    mail: {
      // An empty password keeps the stored one (see
      // handler.keepMailSecrets).
      smtp: Omit<
        AppSettings["notifications"]["mail"]["smtp"],
        "passwordSet"
      > & {
        password: string;
      };
      to: string[];
    };
  };
};

export type SmtpSecurity = z.infer<typeof smtpSecuritySchema>;
export type ReportFrequency = z.infer<typeof reportFrequencySchema>;

// The notifications part of a save, from what the server last confirmed:
// no SMTP password, so the stored one is kept.
export const toNotificationsInput = (
  n: AppSettings["notifications"],
): AppSettingsInput["notifications"] => ({
  ...n,
  mail: {
    smtp: {
      host: n.mail.smtp.host,
      port: n.mail.smtp.port,
      security: n.mail.smtp.security,
      username: n.mail.smtp.username,
      from: n.mail.smtp.from,
      password: "",
    },
    to: n.mail.to,
  },
});
