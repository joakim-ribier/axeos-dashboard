import { describe, expect, it } from "vitest";

import { shouldNotifyForAppUpdate } from "./appVersion";

describe("shouldNotifyForAppUpdate", () => {
  it("does not notify when up to date", () => {
    expect(shouldNotifyForAppUpdate("upToDate", "upToDate")).toBe(false);
  });

  it("notifies when transitioning into updateAvailable", () => {
    expect(shouldNotifyForAppUpdate("upToDate", "updateAvailable")).toBe(true);
  });

  it("notifies on the very first check if already out of date (no previous status)", () => {
    expect(shouldNotifyForAppUpdate(undefined, "updateAvailable")).toBe(true);
  });

  it("does not re-notify while it stays updateAvailable across polls", () => {
    expect(shouldNotifyForAppUpdate("updateAvailable", "updateAvailable")).toBe(
      false,
    );
  });

  it("does not notify when recovering back to upToDate", () => {
    expect(shouldNotifyForAppUpdate("updateAvailable", "upToDate")).toBe(false);
  });

  it("does not notify while the status is unknown", () => {
    expect(shouldNotifyForAppUpdate(undefined, "unknown")).toBe(false);
    expect(shouldNotifyForAppUpdate("unknown", "unknown")).toBe(false);
  });

  it("notifies again if a new update appears after a previous one was applied", () => {
    // upToDate -> updateAvailable (first update, presumably already notified)
    // -> upToDate (user updated) -> updateAvailable (a second, later update)
    expect(shouldNotifyForAppUpdate("upToDate", "updateAvailable")).toBe(true);
  });
});
