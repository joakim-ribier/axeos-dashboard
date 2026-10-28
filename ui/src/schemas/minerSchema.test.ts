import { describe, expect, it } from "vitest";

import { makeMiner } from "@/test/miner";

import { minerSchema } from "./minerSchema";

describe("minerSchema", () => {
  it("reads a value a board wasn't given as no value", () => {
    const miner = minerSchema.parse(
      makeMiner({
        stratumURL: "xxxxxxxx",
        stratumUser: "xxxxxxxx",
        fallbackStratumURL: "xxxxxxxx",
        fallbackStratumUser: "xxxxxxxx",
      }),
    );

    expect(miner.stratumURL).toBeUndefined();
    expect(miner.stratumUser).toBeUndefined();
    expect(miner.fallbackStratumURL).toBeUndefined();
    expect(miner.fallbackStratumUser).toBeUndefined();
  });

  it("keeps the values that are there", () => {
    const miner = minerSchema.parse(makeMiner());

    expect(miner.stratumURL).toBe("stratum+tcp://pool.example.com");
    expect(miner.stratumUser).toBe("wallet.office");
  });
});
