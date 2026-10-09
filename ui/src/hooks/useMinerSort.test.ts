import { describe, expect, it } from "vitest";

import { type Miner } from "@/schemas/minerSchema";
import { makeMiner } from "@/test/miner";
import { type MinerStatus } from "@/utils/minerStatus";

import { sortMiners } from "./useMinerSort";

const names = (miners: Miner[]) => miners.map((m) => m.hostname);

describe("sortMiners", () => {
  const allOk = () => "ok" as MinerStatus;

  it("sorts by displayed temperature, then fan, on ties", () => {
    const miners = [
      makeMiner({ hostname: "cool", temp: 55, fanspeed: 90 }),
      // 60.4 and 60.1 both show as 60°C: the fan decides, not the decimals.
      makeMiner({ hostname: "hot-quiet", temp: 60.4, fanspeed: 40 }),
      makeMiner({ hostname: "hot-loud", temp: 60.1, fanspeed: 70 }),
    ];

    expect(names(sortMiners(miners, "temp", allOk))).toEqual([
      "hot-loud",
      "hot-quiet",
      "cool",
    ]);
  });

  it("puts miners with a problem first, most urgent first, whatever the sort", () => {
    const status: Record<string, MinerStatus> = {
      ok: "ok",
      warning: "warning",
      offline: "offline",
      stale: "stale",
    };
    const miners = [
      makeMiner({ hostname: "ok", hashRateTHs: 9 }),
      makeMiner({ hostname: "warning", hashRateTHs: 1 }),
      makeMiner({ hostname: "offline", hashRateTHs: 2 }),
      makeMiner({ hostname: "stale", hashRateTHs: 3 }),
    ];

    expect(
      names(sortMiners(miners, "hashrate", (m) => status[m.hostname!])),
    ).toEqual(["offline", "stale", "warning", "ok"]);
  });

  it("does not modify the list it is given", () => {
    const miners = [
      makeMiner({ hostname: "a", temp: 50 }),
      makeMiner({ hostname: "b", temp: 60 }),
    ];
    sortMiners(miners, "temp", allOk);
    expect(names(miners)).toEqual(["a", "b"]);
  });
});
