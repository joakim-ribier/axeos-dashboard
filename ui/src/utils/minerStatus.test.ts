import { describe, expect, it } from "vitest";

import { makeMiner } from "@/test/miner";

import { getMinerStatus } from "./minerStatus";

describe("getMinerStatus", () => {
  it("is ok for a reachable, fresh, cool miner", () => {
    expect(getMinerStatus(makeMiner(), false)).toBe("ok");
  });

  it("is a warning above the threshold, like the server's alerts", () => {
    expect(getMinerStatus(makeMiner({ temp: 62.1 }), false)).toBe("warning");
    expect(getMinerStatus(makeMiner({ fanspeed: 76 }), false)).toBe("warning");
    // The built-in thresholds, when the server doesn't send the miner's.
    expect(getMinerStatus(makeMiner({ temp: 62 }), false)).toBe("ok");
    expect(getMinerStatus(makeMiner({ fanspeed: 75 }), false)).toBe("ok");
  });

  it("follows the miner's own thresholds", () => {
    const own = { tempThreshold: 70, fanThreshold: 95 };
    expect(
      getMinerStatus(makeMiner({ ...own, temp: 68, fanspeed: 90 }), false),
    ).toBe("ok");
    expect(getMinerStatus(makeMiner({ ...own, temp: 71 }), false)).toBe(
      "warning",
    );
    expect(getMinerStatus(makeMiner({ ...own, fanspeed: 96 }), false)).toBe(
      "warning",
    );
  });

  it("keeps the most urgent status when several apply", () => {
    const hot = { temp: 80 };
    expect(getMinerStatus(makeMiner({ ...hot }), true)).toBe("stale");
    expect(getMinerStatus(makeMiner({ ...hot, error: "mac" }), true)).toBe(
      "configError",
    );
    expect(
      getMinerStatus(makeMiner({ ...hot, error: "mac", alive: false }), true),
    ).toBe("offline");
  });

  it("treats a miner not checked yet as reachable", () => {
    expect(getMinerStatus(makeMiner({ alive: undefined }), false)).toBe("ok");
  });
});
