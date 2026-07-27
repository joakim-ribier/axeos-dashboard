import { describe, expect, it } from "vitest";

import type { Miner } from "@/schemas/minerSchema";

import {
  createAutoRefreshToggledNotification,
  createSettingsUpdatedNotification,
  DEFAULT_NOTIFICATION_SETTINGS,
  detectNotifications,
  diffNotificationSettings,
  type NotificationSettings,
} from "./minerNotifications";

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

// Defaults to DEFAULT_NOTIFICATION_SETTINGS unless overridden, to keep the
// bulk of the tests below focused on detection behavior rather than settings.
const detect = (
  previous: Miner[] | undefined,
  current: Miner[],
  settings: NotificationSettings = DEFAULT_NOTIFICATION_SETTINGS,
) => detectNotifications(previous, current, settings);

describe("detectNotifications", () => {
  describe("first fetch (no previous data)", () => {
    it("returns nothing when nothing is already in a bad state", () => {
      expect(detect(undefined, [baseMiner])).toEqual([]);
    });

    it("notifies immediately for a miner that's already hot", () => {
      const hot: Miner = { ...baseMiner, temp: 65 };
      const result = detect(undefined, [hot]);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ type: "temp", detail: "65" });
    });

    it("notifies immediately for a miner that's already offline", () => {
      const offline: Miner = { ...baseMiner, alive: false };
      const result = detect(undefined, [offline]);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ type: "offline" });
    });

    it("notifies immediately for a miner that already has an update pending", () => {
      const pending: Miner = { ...baseMiner, updateAvailable: true };
      const result = detect(undefined, [pending]);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: "updateAvailable",
        detail: "v2.5.0",
      });
    });

    it("never notifies a version change on first fetch (nothing to diff against)", () => {
      expect(detect(undefined, [baseMiner])).toEqual([]);
    });

    it("never notifies 'recovered' on first fetch (nothing to recover from)", () => {
      const cool: Miner = { ...baseMiner, temp: 40, fanspeed: 30 };
      expect(detect(undefined, [cool])).toEqual([]);
    });
  });

  describe("temp", () => {
    it("notifies when temp crosses above the threshold", () => {
      const hot: Miner = { ...baseMiner, temp: 65 };
      const result = detect([baseMiner], [hot]);

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

      expect(detect([hot], [stillHot])).toEqual([]);
    });

    it("notifies again if temp drops back down and crosses again later", () => {
      const hot: Miner = { ...baseMiner, temp: 65 };
      const cooled: Miner = { ...baseMiner, temp: 50 };
      const hotAgain: Miner = { ...baseMiner, temp: 65 };

      expect(detect([baseMiner], [hot])).toHaveLength(1);
      expect(detect([hot], [cooled]).filter((n) => n.type === "temp")).toEqual(
        [],
      );
      expect(detect([cooled], [hotAgain])).toHaveLength(1);
    });

    it("notifies 'recovered' when temp drops back below the threshold", () => {
      const hot: Miner = { ...baseMiner, temp: 65 };
      const cooled: Miner = { ...baseMiner, temp: 50 };
      const result = detect([hot], [cooled]);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: "tempRecovered",
        minerLabel: "bitaxe-office",
        detail: "50",
      });
    });

    it("does not notify 'recovered' while temp stays below the threshold", () => {
      const cool: Miner = { ...baseMiner, temp: 50 };
      const stillCool: Miner = { ...baseMiner, temp: 45 };

      expect(detect([cool], [stillCool])).toEqual([]);
    });

    it("suppresses 'recovered' too when notifyTemp is false", () => {
      const hot: Miner = { ...baseMiner, temp: 65 };
      const cooled: Miner = { ...baseMiner, temp: 50 };
      const settings: NotificationSettings = {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        notifyTemp: false,
      };

      expect(detect([hot], [cooled], settings)).toEqual([]);
    });

    it("compares the rounded reading, not the raw sensor float, against the threshold", () => {
      // Both readings round to 60, straddling a 60 threshold at the raw
      // level (59.95 -> 60.05) — should not flap between
      // exceeded/recovered since the displayed value never actually moves.
      // Uses an explicit threshold rather than the default so this test
      // doesn't silently stop testing the boundary if the default changes.
      const settings: NotificationSettings = {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        tempThreshold: 60,
      };
      const justUnder: Miner = { ...baseMiner, temp: 59.95 };
      const justOver: Miner = { ...baseMiner, temp: 60.05 };

      expect(detect([justUnder], [justOver], settings)).toEqual([]);
      expect(detect([justOver], [justUnder], settings)).toEqual([]);
    });
  });

  describe("fan", () => {
    it("notifies when fan speed crosses above the threshold", () => {
      const loud: Miner = { ...baseMiner, fanspeed: 80 };
      const result = detect([baseMiner], [loud]);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ type: "fan", detail: "80" });
    });

    it("notifies 'recovered' when fan speed drops back below the threshold", () => {
      const loud: Miner = { ...baseMiner, fanspeed: 80 };
      const quiet: Miner = { ...baseMiner, fanspeed: 40 };
      const result = detect([loud], [quiet]);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ type: "fanRecovered", detail: "40" });
    });

    it("compares the rounded reading, not the raw sensor float, against the threshold", () => {
      const justUnder: Miner = { ...baseMiner, fanspeed: 74.95 };
      const justOver: Miner = { ...baseMiner, fanspeed: 75.05 };

      expect(detect([justUnder], [justOver])).toEqual([]);
      expect(detect([justOver], [justUnder])).toEqual([]);
    });
  });

  describe("offline", () => {
    it("notifies when a miner goes offline", () => {
      const offline: Miner = { ...baseMiner, alive: false };
      const result = detect([baseMiner], [offline]);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: "offline",
        minerLabel: "bitaxe-office",
      });
    });

    it("does not re-notify while a miner stays offline", () => {
      const offline: Miner = { ...baseMiner, alive: false };
      expect(detect([offline], [{ ...offline }])).toEqual([]);
    });

    it("notifies 'online' when a miner comes back online", () => {
      const offline: Miner = { ...baseMiner, alive: false };
      const result = detect([offline], [baseMiner]);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: "online",
        minerLabel: "bitaxe-office",
      });
    });

    it("never notifies 'online' on first fetch (nothing to recover from)", () => {
      expect(detect(undefined, [baseMiner])).toEqual([]);
    });

    it("does not re-notify while a miner stays online", () => {
      expect(detect([baseMiner], [{ ...baseMiner }])).toEqual([]);
    });

    it("suppresses 'online' too when notifyOffline is false", () => {
      const offline: Miner = { ...baseMiner, alive: false };
      const settings: NotificationSettings = {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        notifyOffline: false,
      };

      expect(detect([offline], [baseMiner], settings)).toEqual([]);
    });
  });

  describe("deviceError", () => {
    it("notifies when a miner develops a configuration error", () => {
      const errored: Miner = { ...baseMiner, error: "mac mismatch" };
      const result = detect([baseMiner], [errored]);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: "deviceError",
        minerLabel: "bitaxe-office",
        detail: "mac mismatch",
      });
    });

    it("does not re-notify while the error persists", () => {
      const errored: Miner = { ...baseMiner, error: "mac mismatch" };
      expect(detect([errored], [{ ...errored }])).toEqual([]);
    });

    it("notifies 'deviceErrorResolved' when the error clears", () => {
      const errored: Miner = { ...baseMiner, error: "mac mismatch" };
      const result = detect([errored], [baseMiner]);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: "deviceErrorResolved",
        minerLabel: "bitaxe-office",
      });
    });

    it("notifies immediately on first fetch if already in error (unlike online/offline)", () => {
      const errored: Miner = { ...baseMiner, error: "mac mismatch" };
      const result = detect(undefined, [errored]);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ type: "deviceError" });
    });

    it("never notifies 'deviceErrorResolved' on first fetch (nothing to resolve from)", () => {
      expect(detect(undefined, [baseMiner])).toEqual([]);
    });

    it("is not suppressible via NotificationSettings (always notified)", () => {
      const errored: Miner = { ...baseMiner, error: "mac mismatch" };
      const settings: NotificationSettings = {
        ...DEFAULT_NOTIFICATION_SETTINGS,
      };
      const result = detect([baseMiner], [errored], settings);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("deviceError");
    });
  });

  describe("updateAvailable", () => {
    it("notifies when an update becomes available", () => {
      const pending: Miner = { ...baseMiner, updateAvailable: true };
      const result = detect([baseMiner], [pending]);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: "updateAvailable",
        detail: "v2.5.0",
      });
    });

    it("does not re-notify while the update stays pending", () => {
      const pending: Miner = { ...baseMiner, updateAvailable: true };
      expect(detect([pending], [{ ...pending }])).toEqual([]);
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

      expect(detect([baseMiner], [pending])).toHaveLength(1);
      // installing also triggers a "version" notification (checked below),
      // filter it out here to isolate the updateAvailable behavior
      expect(
        detect([pending], [installed]).filter(
          (n) => n.type === "updateAvailable",
        ),
      ).toEqual([]);
      expect(detect([installed], [pendingAgain])).toHaveLength(1);
    });
  });

  describe("version", () => {
    it("notifies when the firmware version changes", () => {
      const updated: Miner = { ...baseMiner, version: "v2.5.0" };
      const result = detect([baseMiner], [updated]);

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

    const result = detect([noHostname], [hot]);
    expect(result[0]).toMatchObject({ minerLabel: "10.0.0.65" });
  });

  it("ignores a miner that only appears in the current list (no previous entry)", () => {
    // baseMiner itself is not in a bad state, so its "first appearance"
    // (treated as neutral baseline) produces nothing either.
    const newMiner: Miner = { ...baseMiner, ip: "10.0.0.99" };
    expect(detect([baseMiner], [baseMiner, newMiner])).toEqual([]);
  });

  it("can raise multiple notifications for the same miner in one tick", () => {
    const troubled: Miner = { ...baseMiner, temp: 65, fanspeed: 80 };
    const result = detect([baseMiner], [troubled]);

    expect(result).toHaveLength(2);
    expect(result.map((n) => n.type).sort()).toEqual(["fan", "temp"]);
  });

  describe("configurable settings", () => {
    it("respects a custom temp threshold", () => {
      const warm: Miner = { ...baseMiner, temp: 55 };
      const settings: NotificationSettings = {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        tempThreshold: 50,
      };

      // 55 doesn't cross the default 62 threshold...
      expect(detect([baseMiner], [warm])).toEqual([]);
      // ...but does cross a custom 50 threshold.
      expect(detect([baseMiner], [warm], settings)).toHaveLength(1);
    });

    it("respects a custom fan threshold", () => {
      const breezy: Miner = { ...baseMiner, fanspeed: 60 };
      const settings: NotificationSettings = {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        fanThreshold: 50,
      };

      expect(detect([baseMiner], [breezy])).toEqual([]);
      expect(detect([baseMiner], [breezy], settings)).toHaveLength(1);
    });

    it("suppresses temp notifications when notifyTemp is false", () => {
      const hot: Miner = { ...baseMiner, temp: 90 };
      const settings: NotificationSettings = {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        notifyTemp: false,
      };

      expect(detect([baseMiner], [hot], settings)).toEqual([]);
    });

    it("suppresses offline notifications when notifyOffline is false", () => {
      const offline: Miner = { ...baseMiner, alive: false };
      const settings: NotificationSettings = {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        notifyOffline: false,
      };

      expect(detect([baseMiner], [offline], settings)).toEqual([]);
    });

    it("suppresses updateAvailable notifications when notifyUpdateAvailable is false", () => {
      const pending: Miner = { ...baseMiner, updateAvailable: true };
      const settings: NotificationSettings = {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        notifyUpdateAvailable: false,
      };

      expect(detect([baseMiner], [pending], settings)).toEqual([]);
    });

    it("suppresses version notifications when notifyVersion is false", () => {
      const updated: Miner = { ...baseMiner, version: "v2.5.0" };
      const settings: NotificationSettings = {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        notifyVersion: false,
      };

      expect(detect([baseMiner], [updated], settings)).toEqual([]);
    });

    it("suppresses fan notifications when notifyFan is false", () => {
      const loud: Miner = { ...baseMiner, fanspeed: 90 };
      const settings: NotificationSettings = {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        notifyFan: false,
      };

      expect(detect([baseMiner], [loud], settings)).toEqual([]);
    });
  });
});

describe("createSettingsUpdatedNotification", () => {
  it("creates a non-miner-specific settingsUpdated notification", () => {
    const notification = createSettingsUpdatedNotification(
      "Temp threshold: 60°C → 30°C",
    );

    expect(notification).toMatchObject({
      type: "settingsUpdated",
      minerLabel: "",
      detail: "Temp threshold: 60°C → 30°C",
    });
    expect(notification.id).toBeTruthy();
    expect(notification.timestamp).toBeTypeOf("number");
  });

  it("allows an undefined detail", () => {
    const notification = createSettingsUpdatedNotification();
    expect(notification.detail).toBeUndefined();
  });
});

describe("diffNotificationSettings", () => {
  it("returns nothing when settings are identical", () => {
    expect(
      diffNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS, {
        ...DEFAULT_NOTIFICATION_SETTINGS,
      }),
    ).toEqual([]);
  });

  it("reports a changed temp threshold", () => {
    const next: NotificationSettings = {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      tempThreshold: 30,
    };

    expect(
      diffNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS, next),
    ).toEqual([{ key: "tempThreshold", previousValue: 62, nextValue: 30 }]);
  });

  it("reports a flipped boolean toggle", () => {
    const next: NotificationSettings = {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      notifyOffline: false,
    };

    expect(
      diffNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS, next),
    ).toEqual([
      { key: "notifyOffline", previousValue: true, nextValue: false },
    ]);
  });

  it("reports every field that changed across a whole edit session", () => {
    const next: NotificationSettings = {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      tempThreshold: 30,
      fanThreshold: 50,
      notifyOffline: false,
    };

    const result = diffNotificationSettings(
      DEFAULT_NOTIFICATION_SETTINGS,
      next,
    );
    expect(result).toHaveLength(3);
    expect(result.map((d) => d.key).sort()).toEqual([
      "fanThreshold",
      "notifyOffline",
      "tempThreshold",
    ]);
  });
});

describe("createAutoRefreshToggledNotification", () => {
  it("creates a non-miner-specific autoRefreshToggled notification", () => {
    const notification = createAutoRefreshToggledNotification("off");

    expect(notification).toMatchObject({
      type: "autoRefreshToggled",
      minerLabel: "",
      detail: "off",
    });
    expect(notification.id).toBeTruthy();
    expect(notification.timestamp).toBeTypeOf("number");
  });
});
