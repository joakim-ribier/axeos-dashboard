import { describe, expect, it } from "vitest";

import type { Miner } from "@/schemas/minerSchema";

import { detectNotifications } from "./minerNotifications";

const baseMiner: Miner = {
  timestamp: "2026-07-22T10:00:00Z",
  ip: "10.0.0.65",
  macAddr: "AA:BB:CC:DD:EE:FF",
  hostname: "bitaxe-office",
  deviceModel: "Bitaxe Ultra",
  alive: true,
  updateAvailable: false,
  sharesAccepted: 100,
  sharesRejected: 1,
  blockFound: 0,
  version: "v2.4.1",
  latestVersion: "v2.5.0",
  uptimeSeconds: 3600,
  responseTime: 42,
  hashRateTHs: 0.5,
  power: 12,
  energyJPerTh: 24,
  networkDifficulty: 1,
  bestDiff: 1,
  temp: 50,
  fanspeed: 40,
};

describe("detectNotifications", () => {
  describe("first fetch (no previous data)", () => {
    it("returns nothing when nothing is already in a bad state", () => {
      expect(detectNotifications(undefined, [baseMiner])).toEqual([]);
    });

    it("notifies immediately for a miner that's already hot", () => {
      const hot: Miner = { ...baseMiner, temp: 65 };
      const result = detectNotifications(undefined, [hot]);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ type: "temp", detail: "65" });
    });

    it("notifies immediately for a miner that's already offline", () => {
      const offline: Miner = { ...baseMiner, alive: false };
      const result = detectNotifications(undefined, [offline]);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ type: "offline" });
    });

    it("notifies immediately for a miner that already has an update pending", () => {
      const pending: Miner = { ...baseMiner, updateAvailable: true };
      const result = detectNotifications(undefined, [pending]);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: "updateAvailable",
        detail: "v2.5.0",
      });
    });

    it("never notifies a version change on first fetch (nothing to diff against)", () => {
      expect(detectNotifications(undefined, [baseMiner])).toEqual([]);
    });
  });

  describe("temp", () => {
    it("notifies when temp crosses above the threshold", () => {
      const hot: Miner = { ...baseMiner, temp: 65 };
      const result = detectNotifications([baseMiner], [hot]);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: "temp",
        minerLabel: "bitaxe-office",
        detail: "65",
      });
    });

    it("does not re-notify on the next tick if temp stays above threshold", () => {
      const hot: Miner = { ...baseMiner, temp: 65 };
      const stillHot: Miner = { ...baseMiner, temp: 66 };

      expect(detectNotifications([hot], [stillHot])).toEqual([]);
    });

    it("notifies again if temp drops back down and crosses again later", () => {
      const hot: Miner = { ...baseMiner, temp: 65 };
      const cooled: Miner = { ...baseMiner, temp: 50 };
      const hotAgain: Miner = { ...baseMiner, temp: 65 };

      expect(detectNotifications([baseMiner], [hot])).toHaveLength(1);
      expect(detectNotifications([hot], [cooled])).toEqual([]);
      expect(detectNotifications([cooled], [hotAgain])).toHaveLength(1);
    });
  });

  describe("fan", () => {
    it("notifies when fan speed crosses above the threshold", () => {
      const loud: Miner = { ...baseMiner, fanspeed: 80 };
      const result = detectNotifications([baseMiner], [loud]);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ type: "fan", detail: "80" });
    });
  });

  describe("offline", () => {
    it("notifies when a miner goes offline", () => {
      const offline: Miner = { ...baseMiner, alive: false };
      const result = detectNotifications([baseMiner], [offline]);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: "offline",
        minerLabel: "bitaxe-office",
      });
    });

    it("does not re-notify while a miner stays offline", () => {
      const offline: Miner = { ...baseMiner, alive: false };
      expect(detectNotifications([offline], [{ ...offline }])).toEqual([]);
    });
  });

  describe("updateAvailable", () => {
    it("notifies when an update becomes available", () => {
      const pending: Miner = { ...baseMiner, updateAvailable: true };
      const result = detectNotifications([baseMiner], [pending]);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: "updateAvailable",
        detail: "v2.5.0",
      });
    });

    it("does not re-notify while the update stays pending", () => {
      const pending: Miner = { ...baseMiner, updateAvailable: true };
      expect(detectNotifications([pending], [{ ...pending }])).toEqual([]);
    });

    it("notifies again once the update is installed and a new one appears later", () => {
      const pending: Miner = { ...baseMiner, updateAvailable: true };
      const installed: Miner = {
        ...baseMiner,
        version: "v2.5.0",
        updateAvailable: false,
      };
      const pendingAgain: Miner = {
        ...installed,
        updateAvailable: true,
        latestVersion: "v2.6.0",
      };

      expect(detectNotifications([baseMiner], [pending])).toHaveLength(1);
      // installing also triggers a "version" notification (checked below),
      // filter it out here to isolate the updateAvailable behavior
      expect(
        detectNotifications([pending], [installed]).filter(
          (n) => n.type === "updateAvailable",
        ),
      ).toEqual([]);
      expect(detectNotifications([installed], [pendingAgain])).toHaveLength(1);
    });
  });

  describe("version", () => {
    it("notifies when the firmware version changes", () => {
      const updated: Miner = { ...baseMiner, version: "v2.5.0" };
      const result = detectNotifications([baseMiner], [updated]);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: "version",
        detail: "v2.4.1 → v2.5.0",
      });
    });
  });

  it("uses ip as the label when hostname is missing", () => {
    const noHostname: Miner = { ...baseMiner, hostname: undefined };
    const hot: Miner = { ...noHostname, temp: 65 };

    const result = detectNotifications([noHostname], [hot]);
    expect(result[0]).toMatchObject({ minerLabel: "10.0.0.65" });
  });

  it("ignores a miner that only appears in the current list (no previous entry)", () => {
    // baseMiner itself is not in a bad state, so its "first appearance"
    // (treated as neutral baseline) produces nothing either.
    const newMiner: Miner = { ...baseMiner, ip: "10.0.0.99" };
    expect(detectNotifications([baseMiner], [baseMiner, newMiner])).toEqual([]);
  });

  it("can raise multiple notifications for the same miner in one tick", () => {
    const troubled: Miner = { ...baseMiner, temp: 65, fanspeed: 80 };
    const result = detectNotifications([baseMiner], [troubled]);

    expect(result).toHaveLength(2);
    expect(result.map((n) => n.type).sort()).toEqual(["fan", "temp"]);
  });
});
