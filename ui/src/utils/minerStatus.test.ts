import { describe, expect, it } from "vitest";

import { makeMiner } from "@/test/miner";

import { FAN_THRESHOLD, getMinerStatus, TEMP_THRESHOLD } from "./minerStatus";

describe("getMinerStatus", () => {
  it("is ok for a reachable, fresh, cool miner", () => {
    expect(getMinerStatus(makeMiner(), false)).toBe("ok");
  });

  it("is a warning from the threshold itself, like the gauges", () => {
    expect(getMinerStatus(makeMiner({ temp: TEMP_THRESHOLD }), false)).toBe(
      "warning",
    );
    expect(getMinerStatus(makeMiner({ fanspeed: FAN_THRESHOLD }), false)).toBe(
      "warning",
    );
    expect(
      getMinerStatus(makeMiner({ temp: TEMP_THRESHOLD - 0.1 }), false),
    ).toBe("ok");
  });

  it("ignores the server's firmware-update alert", () => {
    const outdated = makeMiner({ alerts: [{ type: "firmwareUpdate" }] });
    expect(getMinerStatus(outdated, false)).toBe("ok");
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
