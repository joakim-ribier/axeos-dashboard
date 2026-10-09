import type { Miner } from "@/schemas/minerSchema";

/** A healthy, reachable miner -- override only what a test is about. */
export const makeMiner = (overrides: Partial<Miner> = {}): Miner => ({
  timestamp: "2026-07-22T10:00:00Z",
  ip: "10.0.0.65",
  macAddr: "AA:BB:CC:DD:EE:FF",
  hostname: "bitaxe-office",
  deviceModel: "Bitaxe Ultra",
  alive: true,
  sharesAccepted: 100,
  sharesRejected: 1,
  blockFound: 0,
  version: "v2.4.1",
  uptimeSeconds: 3600,
  responseTime: 42,
  hashRateTHs: 0.5,
  power: 12,
  energyJPerTh: 24,
  networkDifficulty: 1,
  bestDiff: 1,
  temp: 55,
  fanspeed: 40,
  stratumURL: "stratum+tcp://pool.example.com",
  stratumUser: "wallet.office",
  fallbackStratumURL: "stratum+tcp://fallback.example.com",
  fallbackStratumUser: "wallet.fallback",
  ...overrides,
});
