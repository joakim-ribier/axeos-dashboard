import { describe, expect, it } from "vitest";

import { minerSchema } from "@/schemas/minerSchema";
import { makeMiner } from "@/test/miner";

import { actionsOnBoard, sharedOnBoard } from "./BoardPanel";

// As a board gets it: what its dashboard doesn't share arrives as "xxxxxxxx",
// an IP not shared as a made-up fd00:: one -- parsed like the real response.
const received = (raw: Record<string, unknown>) =>
  minerSchema.parse({ ...makeMiner(), ...raw });

const HIDDEN = {
  stratumUser: "xxxxxxxx",
  fallbackStratumUser: "xxxxxxxx",
  stratumURL: "xxxxxxxx",
  fallbackStratumURL: "xxxxxxxx",
  ip: "fd00::aabb:ccdd:eeff",
};

describe("sharedOnBoard", () => {
  it("knows nothing without a reading", () => {
    expect(sharedOnBoard([])).toEqual({
      user: "unknown",
      pools: "unknown",
      ip: "unknown",
    });
  });

  it("reads nothing shared off obfuscated readings", () => {
    expect(sharedOnBoard([received(HIDDEN)])).toEqual({
      user: "notSent",
      pools: "notSent",
      ip: "masked",
    });
  });

  it("reads each value shared on its own", () => {
    expect(
      sharedOnBoard([received({ ...HIDDEN, stratumUser: "wallet.office" })]),
    ).toEqual({ user: "sent", pools: "notSent", ip: "masked" });
    expect(
      sharedOnBoard([
        received({ ...HIDDEN, stratumURL: "stratum+tcp://pool.example.com" }),
      ]),
    ).toEqual({ user: "notSent", pools: "sent", ip: "masked" });
    expect(sharedOnBoard([received({ ...HIDDEN, ip: "10.0.0.65" })])).toEqual({
      user: "notSent",
      pools: "notSent",
      ip: "sent",
    });
  });

  it("calls a value shared as soon as one miner sends it", () => {
    expect(
      sharedOnBoard([
        received(HIDDEN),
        received({ ...HIDDEN, stratumUser: "wallet.garage" }),
      ]).user,
    ).toBe("sent");
  });
});

describe("actionsOnBoard", () => {
  const alive = (remoteActions?: string[]) =>
    received({ alive: true, remoteActions });

  it("offers nothing on a public board", () => {
    expect(actionsOnBoard([alive(["restart"])], true)).toEqual({
      restart: "publicBoard",
      switchPool: "publicBoard",
    });
  });

  it("can't tell without a miner still sending data", () => {
    expect(actionsOnBoard([], false).restart).toBe("unknown");
    expect(
      actionsOnBoard(
        [received({ alive: false, remoteActions: ["restart"] })],
        false,
      ),
    ).toEqual({ restart: "unknown", switchPool: "unknown" });
  });

  it("reads each action allowed off the active miners", () => {
    expect(actionsOnBoard([alive(["restart"])], false)).toEqual({
      restart: "allowed",
      switchPool: "notAllowed",
    });
    expect(
      actionsOnBoard([alive(["switch_primary", "switch_fallback"])], false),
    ).toEqual({ restart: "notAllowed", switchPool: "allowed" });
    // None allowed: the field is left out altogether.
    expect(actionsOnBoard([alive()], false)).toEqual({
      restart: "notAllowed",
      switchPool: "notAllowed",
    });
  });
});
