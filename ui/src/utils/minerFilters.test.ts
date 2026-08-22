import { describe, expect, it } from "vitest";

import type { Miner } from "@/schemas/minerSchema";

import {
  matchesQuickFilters,
  NO_QUICK_FILTERS,
  type QuickFilters,
} from "./minerFilters";

const baseMiner: Miner = {
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
  latestVersion: "v2.5.0",
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
};

const check = (miner: Miner, filters: Partial<QuickFilters>) =>
  matchesQuickFilters(miner, { ...NO_QUICK_FILTERS, ...filters });

describe("matchesQuickFilters", () => {
  it("matches everything when no filter is active", () => {
    expect(check(baseMiner, {})).toBe(true);
  });

  describe("pool", () => {
    it("matches the primary pool URL", () => {
      expect(
        check(baseMiner, { selectedPool: "stratum+tcp://pool.example.com" }),
      ).toBe(true);
    });

    it("does not match a different pool URL", () => {
      expect(
        check(baseMiner, { selectedPool: "stratum+tcp://other.example.com" }),
      ).toBe(false);
    });

    it("compares against the fallback URL when the miner is using its fallback", () => {
      const onFallback: Miner = { ...baseMiner, isUsingFallbackStratum: 1 };

      expect(
        check(onFallback, {
          selectedPool: "stratum+tcp://fallback.example.com",
        }),
      ).toBe(true);
      expect(
        check(onFallback, { selectedPool: "stratum+tcp://pool.example.com" }),
      ).toBe(false);
    });
  });

  describe("device model", () => {
    it("matches the exact device model", () => {
      expect(check(baseMiner, { selectedDeviceModel: "Bitaxe Ultra" })).toBe(
        true,
      );
    });

    it("does not match a different device model", () => {
      expect(check(baseMiner, { selectedDeviceModel: "NerdQAxe++" })).toBe(
        false,
      );
    });
  });

  describe("alerts", () => {
    it("matches a miner flagged tempHigh by the server when alertTemp is on", () => {
      const hot: Miner = {
        ...baseMiner,
        alerts: [{ type: "tempHigh", value: 90, threshold: 62 }],
      };
      expect(check(hot, { alertTemp: true })).toBe(true);
      expect(check(baseMiner, { alertTemp: true })).toBe(false);
    });

    it("matches a miner flagged fanHigh by the server when alertFan is on", () => {
      const loud: Miner = {
        ...baseMiner,
        alerts: [{ type: "fanHigh", value: 90, threshold: 75 }],
      };
      expect(check(loud, { alertFan: true })).toBe(true);
      expect(check(baseMiner, { alertFan: true })).toBe(false);
    });

    it("matches an offline miner when alertOffline is on", () => {
      const offline: Miner = { ...baseMiner, alive: false };
      expect(check(offline, { alertOffline: true })).toBe(true);
      expect(check(baseMiner, { alertOffline: true })).toBe(false);
    });

    it("ORs multiple active alerts together", () => {
      const offline: Miner = { ...baseMiner, alive: false };
      const hot: Miner = {
        ...baseMiner,
        alerts: [{ type: "tempHigh", value: 90, threshold: 62 }],
      };

      // Both alertTemp and alertOffline are active; a miner matching
      // either one should pass, not just one that matches both.
      expect(check(offline, { alertTemp: true, alertOffline: true })).toBe(
        true,
      );
      expect(check(hot, { alertTemp: true, alertOffline: true })).toBe(true);
      expect(check(baseMiner, { alertTemp: true, alertOffline: true })).toBe(
        false,
      );
    });

    it("reads the alert flag as-is, with no threshold recomputed client-side", () => {
      // The raw temp reading is unremarkable, but the server already
      // flagged this poll as tempHigh (e.g. it briefly spiked) -- the
      // filter must trust that, not recompute against its own threshold.
      const flaggedButCool: Miner = {
        ...baseMiner,
        temp: 40,
        alerts: [{ type: "tempHigh", value: 90, threshold: 62 }],
      };
      expect(check(flaggedButCool, { alertTemp: true })).toBe(true);
    });
  });

  it("combines pool, device model, and alerts (all must pass)", () => {
    const hotOnOtherPool: Miner = {
      ...baseMiner,
      alerts: [{ type: "tempHigh", value: 90, threshold: 62 }],
      stratumURL: "stratum+tcp://other.example.com",
    };

    expect(
      check(hotOnOtherPool, {
        selectedPool: "stratum+tcp://pool.example.com",
        alertTemp: true,
      }),
    ).toBe(false);

    const hotOnRightPool: Miner = {
      ...baseMiner,
      alerts: [{ type: "tempHigh", value: 90, threshold: 62 }],
    };
    expect(
      check(hotOnRightPool, {
        selectedPool: "stratum+tcp://pool.example.com",
        alertTemp: true,
      }),
    ).toBe(true);
  });
});
