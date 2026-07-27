// src/schemas/minerSchema.ts
import { z } from "zod";

export const minerSchema = z.object({
  timestamp: z.string(),

  ip: z.string(),
  macAddr: z.string(),
  hostname: z.string().optional(),
  deviceModel: z.string().optional(),
  alive: z.boolean().optional(),
  aliveCheckedAt: z.string().optional(),
  error: z.string().optional(),

  sharesAccepted: z.number(),
  sharesRejected: z.number(),
  blockFound: z.number(),

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
  stratumUser: z.string().optional(),
  stratumDashboardURL: z.string().optional(),
  fallbackStratumURL: z.string().optional(),
  fallbackStratumUser: z.string().optional(),
  fallbackStratumDashboardURL: z.string().optional(),
  isUsingFallbackStratum: z.number().int().min(0).max(1).optional(),

  electricityRatePerKwh: z.number().optional(),
});

export type Miner = z.infer<typeof minerSchema>;
