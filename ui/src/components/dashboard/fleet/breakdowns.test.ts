import { type TFunction } from "i18next";
import { describe, expect, it } from "vitest";

import { makeMiner } from "@/test/miner";
import { type MinerStatus } from "@/utils/minerStatus";

import { poolSegments, statusSegments } from "./breakdowns";

const t = ((key: string) => key) as unknown as TFunction;

describe("statusSegments", () => {
  it("counts miners per status, most urgent first", () => {
    const status: Record<string, MinerStatus> = {
      a: "ok",
      b: "ok",
      c: "offline",
    };
    const miners = ["a", "b", "c"].map((ip) => makeMiner({ ip }));

    const segments = statusSegments(miners, (m) => status[m.ip], t);

    expect(segments.map((s) => [s.key, s.value])).toEqual([
      ["offline", 1],
      ["configError", 0],
      ["stale", 0],
      ["warning", 0],
      ["ok", 2],
    ]);
  });
});

describe("poolSegments", () => {
  const main = "stratum+tcp://main.example.com:3333";
  const solo = "stratum+tcp://solo.example.com:3333";

  it("shares the fleet's hashrate between active pools, biggest first", () => {
    const segments = poolSegments([
      makeMiner({ stratumURL: solo, hashRateTHs: 1 }),
      makeMiner({ stratumURL: main, hashRateTHs: 2 }),
      makeMiner({ stratumURL: main, hashRateTHs: 1 }),
    ]);

    expect(segments.map((s) => [s.label, s.value, s.detail])).toEqual([
      ["main.example.com", 3, "75 %"],
      ["solo.example.com", 1, "25 %"],
    ]);
  });

  it("keeps a pool whose miners are all offline, at 0%", () => {
    const segments = poolSegments([
      makeMiner({ stratumURL: main, hashRateTHs: 2 }),
      makeMiner({ stratumURL: solo, hashRateTHs: 1, alive: false }),
    ]);

    expect(segments.map((s) => [s.label, s.value, s.detail])).toEqual([
      ["main.example.com", 2, "100 %"],
      ["solo.example.com", 0, "0 %"],
    ]);
  });
});
