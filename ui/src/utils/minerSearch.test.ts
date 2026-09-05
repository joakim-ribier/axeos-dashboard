import { describe, expect, it } from "vitest";

import type { Miner } from "@/schemas/minerSchema";

import { matchesSearch } from "./minerSearch";

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

describe("matchesSearch", () => {
  it("matches an empty or whitespace-only query unconditionally", () => {
    expect(matchesSearch(baseMiner, "")).toBe(true);
    expect(matchesSearch(baseMiner, "   ")).toBe(true);
  });

  it("matches on hostname, case-insensitively", () => {
    expect(matchesSearch(baseMiner, "OFFICE")).toBe(true);
  });

  it("matches on alias", () => {
    expect(matchesSearch({ ...baseMiner, alias: "Garage rig" }, "garage")).toBe(
      true,
    );
  });

  it("matches on ip", () => {
    expect(matchesSearch(baseMiner, "10.0.0.65")).toBe(true);
  });

  it("matches on deviceModel", () => {
    expect(matchesSearch(baseMiner, "ultra")).toBe(true);
  });

  it("matches on the primary and fallback pool URL", () => {
    expect(matchesSearch(baseMiner, "pool.example")).toBe(true);
    expect(matchesSearch(baseMiner, "fallback.example")).toBe(true);
  });

  it("matches on the primary and fallback pool user", () => {
    expect(matchesSearch(baseMiner, "wallet.office")).toBe(true);
    expect(matchesSearch(baseMiner, "wallet.fallback")).toBe(true);
  });

  it("matches on version and latestVersion", () => {
    expect(matchesSearch(baseMiner, "v2.4.1")).toBe(true);
    expect(matchesSearch(baseMiner, "v2.5.0")).toBe(true);
  });

  it("returns false when nothing matches", () => {
    expect(matchesSearch(baseMiner, "nonexistent-term")).toBe(false);
  });

  it("does not throw when optional fields are undefined", () => {
    const minimal: Miner = {
      ...baseMiner,
      hostname: undefined,
      deviceModel: undefined,
      stratumURL: undefined,
      stratumUser: undefined,
      fallbackStratumURL: undefined,
      fallbackStratumUser: undefined,
      latestVersion: undefined,
    };

    expect(() => matchesSearch(minimal, "anything")).not.toThrow();
    expect(matchesSearch(minimal, "10.0.0.65")).toBe(true);
  });

  describe("numeric comparisons", () => {
    // baseMiner: temp 55, fanspeed 40, hashRateTHs 0.5, power 12, uptimeSeconds 3600

    it("supports > and >= on temp/fan", () => {
      expect(matchesSearch(baseMiner, "temp>50")).toBe(true);
      expect(matchesSearch(baseMiner, "temp>60")).toBe(false);
      expect(matchesSearch(baseMiner, "temp>=55")).toBe(true);
      expect(matchesSearch(baseMiner, "fan>=100")).toBe(false);
    });

    it("supports < and <= on temp/fan", () => {
      expect(matchesSearch(baseMiner, "temp<60")).toBe(true);
      expect(matchesSearch(baseMiner, "fan<100")).toBe(true);
      expect(matchesSearch(baseMiner, "fan<=40")).toBe(true);
    });

    it("supports equality", () => {
      expect(matchesSearch(baseMiner, "fan=40")).toBe(true);
      expect(matchesSearch(baseMiner, "fan=41")).toBe(false);
    });

    it("tolerates whitespace and mixed case", () => {
      expect(matchesSearch(baseMiner, "TEMP > 50")).toBe(true);
      expect(matchesSearch(baseMiner, "  fan >= 40  ")).toBe(true);
    });

    it("tolerates a trailing s (temps/fans)", () => {
      expect(matchesSearch(baseMiner, "temps >= 55")).toBe(true);
      expect(matchesSearch(baseMiner, "temps > 59")).toBe(false);
      expect(matchesSearch(baseMiner, "fans<=40")).toBe(true);
    });

    it("falls back to plain text search for unknown fields", () => {
      // "volts" isn't a supported comparison field — treated as plain
      // text, so it simply doesn't match rather than throwing.
      expect(matchesSearch(baseMiner, "volts>10")).toBe(false);
    });

    it("compares temp/fan against the rounded value shown on the card, not the raw one", () => {
      // MinerCard displays temp/fan via toFixed(0) — a raw 59.6 shows as
      // "60°C", so ">=60" and ">59" must agree once rounded.
      const fractional: Miner = { ...baseMiner, temp: 59.6 };

      expect(matchesSearch(fractional, "temp>59")).toBe(true);
      expect(matchesSearch(fractional, "temp>=60")).toBe(true);
    });

    it("supports hashrate (compared raw, not rounded)", () => {
      expect(matchesSearch(baseMiner, "hashrate<0.6")).toBe(true);
      expect(matchesSearch(baseMiner, "hashrate<0.3")).toBe(false);
      expect(matchesSearch(baseMiner, "hashrate=0.5")).toBe(true);
    });

    it("supports power (compared raw, not rounded)", () => {
      expect(matchesSearch(baseMiner, "power>15")).toBe(false);
      expect(matchesSearch(baseMiner, "power<=12")).toBe(true);
    });

    it("supports uptime in raw seconds", () => {
      expect(matchesSearch(baseMiner, "uptime>3600")).toBe(false);
      expect(matchesSearch(baseMiner, "uptime>=3600")).toBe(true);
      expect(matchesSearch(baseMiner, "uptime<7200")).toBe(true);
    });
  });

  describe("the offline keyword", () => {
    it('matches "offline" only when the miner is explicitly not alive', () => {
      expect(matchesSearch({ ...baseMiner, alive: false }, "offline")).toBe(
        true,
      );
      expect(matchesSearch(baseMiner, "offline")).toBe(false);
    });

    it('matches "!offline"/"-offline" for anything not explicitly offline', () => {
      expect(matchesSearch(baseMiner, "!offline")).toBe(true);
      expect(matchesSearch(baseMiner, "-offline")).toBe(true);
      expect(matchesSearch({ ...baseMiner, alive: false }, "!offline")).toBe(
        false,
      );
    });

    it("treats unknown alive status as not offline", () => {
      const unknown: Miner = { ...baseMiner, alive: undefined };
      expect(matchesSearch(unknown, "offline")).toBe(false);
      expect(matchesSearch(unknown, "!offline")).toBe(true);
    });
  });

  describe("negation works uniformly on any term type", () => {
    it("negates a plain substring with - or !", () => {
      expect(matchesSearch(baseMiner, "-office")).toBe(false);
      expect(matchesSearch(baseMiner, "!office")).toBe(false);
      expect(matchesSearch(baseMiner, "-nonexistent")).toBe(true);
    });

    it('negates a numeric comparison ("!temp>60" behaves like "temp<=60")', () => {
      expect(matchesSearch(baseMiner, "!temp>60")).toBe(true); // temp is 55
      expect(matchesSearch(baseMiner, "!temp>50")).toBe(false); // temp is 55
      expect(matchesSearch(baseMiner, "-fan>=100")).toBe(true); // fan is 40
    });

    it("negates the offline keyword (already covered above, sanity check here too)", () => {
      expect(matchesSearch(baseMiner, "!offline")).toBe(true);
    });

    it("treats a lone - or ! as a no-op rather than throwing", () => {
      expect(() => matchesSearch(baseMiner, "-")).not.toThrow();
      expect(matchesSearch(baseMiner, "-")).toBe(true);
    });
  });

  describe("combining multiple terms (AND)", () => {
    it("combines a plain text term with a numeric comparison", () => {
      expect(matchesSearch(baseMiner, "office temp>50")).toBe(true);
      expect(matchesSearch(baseMiner, "office temp>60")).toBe(false);
    });

    it("combines the offline keyword with a negated term", () => {
      // baseMiner's stratumUser is "wallet.office" and fallbackStratumUser
      // is "wallet.fallback" — "-fallback" excludes it via that field.
      expect(matchesSearch(baseMiner, "!offline -fallback")).toBe(false);
      expect(matchesSearch(baseMiner, "!offline -nonexistent")).toBe(true);
    });

    it("requires every term to match", () => {
      expect(matchesSearch(baseMiner, "office ultra temp<60")).toBe(true);
      expect(matchesSearch(baseMiner, "office ultra temp>60")).toBe(false);
    });
  });
});
