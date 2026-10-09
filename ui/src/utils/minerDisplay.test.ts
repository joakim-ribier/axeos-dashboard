import { describe, expect, it } from "vitest";

import { activePoolUrl, displayName, poolHostname } from "./minerDisplay";

describe("displayName", () => {
  it("returns the alias when set", () => {
    expect(displayName({ hostname: "bitaxe-1", alias: "Garage rig" })).toBe(
      "Garage rig",
    );
  });

  it("falls back to hostname when alias is unset", () => {
    expect(displayName({ hostname: "bitaxe-1" })).toBe("bitaxe-1");
  });

  it("falls back to hostname when alias is an empty string", () => {
    expect(displayName({ hostname: "bitaxe-1", alias: "" })).toBe("bitaxe-1");
  });

  it("returns undefined when neither is set", () => {
    expect(displayName({})).toBeUndefined();
  });
});

describe("activePoolUrl", () => {
  const miner = {
    stratumURL: "stratum+tcp://main.example.com:3333",
    fallbackStratumURL: "stratum+tcp://backup.example.com:3333",
  };

  it("is the primary pool unless the fallback is in use", () => {
    expect(activePoolUrl(miner)).toBe(miner.stratumURL);
    expect(activePoolUrl({ ...miner, isUsingFallbackStratum: 1 })).toBe(
      miner.fallbackStratumURL,
    );
  });

  it("is empty when the active slot has no URL", () => {
    expect(activePoolUrl({})).toBe("");
  });
});

describe("poolHostname", () => {
  it("drops the scheme and the port", () => {
    expect(poolHostname("stratum+tcp://pool.example.com:3333")).toBe(
      "pool.example.com",
    );
    expect(poolHostname("pool.example.com")).toBe("pool.example.com");
  });
});
