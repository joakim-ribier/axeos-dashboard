import { describe, expect, it } from "vitest";

import type { MinerConfig } from "@/schemas/minerConfigSchema";
import type { Miner } from "@/schemas/minerSchema";

import { poolMismatches } from "./poolDrift";

const configured: MinerConfig = {
  ip: "192.168.1.65",
  hostname: "bitaxe-1",
  mac: "aabbccddeeff",
  model: "bitaxe",
  enabled: true,
  url: "stratum.example.com",
  port: 3333,
  user: "wallet.worker",
  fallbackUrl: "solo.example.com",
  fallbackPort: 4444,
  fallbackUser: "wallet.worker.fallback",
};

const baseLive: Miner = {
  timestamp: "2026-07-22T10:00:00Z",
  ip: "192.168.1.65",
  macAddr: "aabbccddeeff",
  sharesAccepted: 0,
  sharesRejected: 0,
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
  stratumURL: "stratum.example.com",
  stratumPort: 3333,
  stratumUser: "wallet.worker",
  fallbackStratumURL: "solo.example.com",
  fallbackStratumPort: 4444,
  fallbackStratumUser: "wallet.worker.fallback",
};

describe("poolMismatches", () => {
  it("returns nothing when live data is unavailable", () => {
    expect(poolMismatches(configured, undefined)).toEqual([]);
  });

  it("returns nothing when everything matches", () => {
    expect(poolMismatches(configured, baseLive)).toEqual([]);
  });

  it("flags a primary URL mismatch", () => {
    const live = { ...baseLive, stratumURL: "other-pool.example.com" };
    expect(poolMismatches(configured, live)).toEqual([
      {
        field: "url",
        configured: "stratum.example.com",
        live: "other-pool.example.com",
      },
    ]);
  });

  it("flags a primary port mismatch", () => {
    const live = { ...baseLive, stratumPort: 4000 };
    expect(poolMismatches(configured, live)).toEqual([
      { field: "port", configured: "3333", live: "4000" },
    ]);
  });

  it("flags a fallback user mismatch", () => {
    const live = { ...baseLive, fallbackStratumUser: "someone.else" };
    expect(poolMismatches(configured, live)).toEqual([
      {
        field: "fallbackUser",
        configured: "wallet.worker.fallback",
        live: "someone.else",
      },
    ]);
  });

  it("collects every mismatching field", () => {
    const live: Miner = {
      ...baseLive,
      stratumURL: "other.example.com",
      fallbackStratumPort: 5555,
    };
    const mismatches = poolMismatches(configured, live);
    expect(mismatches.map((m) => m.field).sort()).toEqual([
      "fallbackPort",
      "url",
    ]);
  });

  it("never treats an unpolled device (port 0 / empty url) as a mismatch", () => {
    const live: Miner = {
      ...baseLive,
      stratumURL: undefined,
      stratumPort: 0,
      stratumUser: undefined,
      fallbackStratumURL: undefined,
      fallbackStratumPort: 0,
      fallbackStratumUser: undefined,
    };
    expect(poolMismatches(configured, live)).toEqual([]);
  });
});
