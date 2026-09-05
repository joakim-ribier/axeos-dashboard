import { describe, expect, it } from "vitest";

import { displayName } from "./minerDisplay";

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
