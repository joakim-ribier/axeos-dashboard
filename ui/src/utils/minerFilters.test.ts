import { describe, expect, it } from "vitest";

import { makeMiner } from "@/test/miner";

import {
  matchesQuickFilters,
  NO_QUICK_FILTERS,
  type QuickFilters,
} from "./minerFilters";
import { type MinerStatus } from "./minerStatus";

const baseMiner = makeMiner();

const check = (
  filters: Partial<QuickFilters>,
  miner = baseMiner,
  status: MinerStatus = "ok",
) => matchesQuickFilters(miner, status, { ...NO_QUICK_FILTERS, ...filters });

describe("matchesQuickFilters", () => {
  it("matches everything when no filter is active", () => {
    expect(check({})).toBe(true);
  });

  describe("pool", () => {
    it("matches the active pool URL", () => {
      expect(check({ selectedPool: "stratum+tcp://pool.example.com" })).toBe(
        true,
      );
      expect(check({ selectedPool: "stratum+tcp://other.example.com" })).toBe(
        false,
      );
    });

    it("compares against the fallback URL when the miner is using its fallback", () => {
      const onFallback = makeMiner({ isUsingFallbackStratum: 1 });

      expect(
        check(
          { selectedPool: "stratum+tcp://fallback.example.com" },
          onFallback,
        ),
      ).toBe(true);
      expect(
        check({ selectedPool: "stratum+tcp://pool.example.com" }, onFallback),
      ).toBe(false);
    });
  });

  it("matches the exact device model", () => {
    expect(check({ selectedDeviceModel: "Bitaxe Ultra" })).toBe(true);
    expect(check({ selectedDeviceModel: "NerdQAxe++" })).toBe(false);
  });

  it("matches the exact firmware version", () => {
    expect(check({ selectedVersion: "v2.4.1" })).toBe(true);
    expect(check({ selectedVersion: "v2.5.0" })).toBe(false);
  });

  it("matches the status it is given, not one it recomputes", () => {
    expect(check({ selectedStatus: "stale" }, baseMiner, "stale")).toBe(true);
    expect(check({ selectedStatus: "stale" }, baseMiner, "ok")).toBe(false);
  });

  it("requires every active filter to match", () => {
    const filters = {
      selectedPool: "stratum+tcp://pool.example.com",
      selectedStatus: "warning" as const,
    };

    expect(check(filters, baseMiner, "warning")).toBe(true);
    expect(check(filters, baseMiner, "ok")).toBe(false);
    expect(
      check(
        filters,
        makeMiner({ stratumURL: "stratum+tcp://other.example.com" }),
        "warning",
      ),
    ).toBe(false);
  });
});
