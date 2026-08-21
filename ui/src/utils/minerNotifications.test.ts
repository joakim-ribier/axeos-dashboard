import { describe, expect, it } from "vitest";

import type { AlertEntry, AlertEpisode, Miner } from "@/schemas/minerSchema";

import {
  activeAlertsToNotifications,
  createAppUpdateAvailableNotification,
  createAutoRefreshToggledNotification,
  currentAlertState,
  episodesToAlertHistoryRows,
  resolvedAlertsToNotifications,
} from "./minerNotifications";

const miner = (overrides: Partial<Miner> = {}): Miner => ({
  timestamp: "2026-07-22T10:00:00Z",
  ip: "10.0.0.65",
  macAddr: "AA:BB:CC:DD:EE:FF",
  hostname: "bitaxe-office",
  sharesAccepted: 0,
  sharesRejected: 0,
  blockFound: 0,
  version: "2.0",
  uptimeSeconds: 0,
  responseTime: 0,
  hashRateTHs: 0,
  power: 0,
  energyJPerTh: 0,
  networkDifficulty: 0,
  bestDiff: 0,
  temp: 60,
  fanspeed: 50,
  ...overrides,
});

const historyEntry = (overrides: Partial<AlertEntry> = {}): AlertEntry => ({
  timestamp: "2026-07-22T10:00:00Z",
  minerIp: "10.0.0.65",
  minerMac: "aabbccddeeff",
  hostname: "bitaxe-office",
  alerts: [{ type: "tempHigh", value: 65, threshold: 62 }],
  ...overrides,
});

const alertEpisode = (overrides: Partial<AlertEpisode> = {}): AlertEpisode => ({
  type: "tempHigh",
  minerIp: "10.0.0.65",
  minerMac: "aabbccddeeff",
  hostname: "bitaxe-office",
  firstSeen: "2026-07-22T10:00:00Z",
  lastSeen: "2026-07-22T10:00:00Z",
  occurrences: 1,
  peakValue: 65,
  threshold: 62,
  ...overrides,
});

describe("currentAlertState", () => {
  it("keys state by the normalized mac, regardless of the raw macAddr's casing/separators", () => {
    const state = currentAlertState([
      miner({ alerts: [{ type: "tempHigh", value: 65 }] }),
    ]);
    expect(Object.keys(state)).toEqual(["aabbccddeeff"]);
  });

  it("uses ip as the label when hostname is missing", () => {
    const state = currentAlertState([miner({ hostname: undefined })]);
    expect(state["aabbccddeeff"].label).toBe("10.0.0.65");
  });

  it("takes tempHigh/fanHigh/firmwareUpdate from Miner.alerts", () => {
    const state = currentAlertState([
      miner({
        alerts: [
          { type: "tempHigh", value: 65 },
          { type: "fanHigh", value: 80 },
        ],
      }),
    ]);
    expect(Object.keys(state["aabbccddeeff"].alerts).sort()).toEqual([
      "fanHigh",
      "tempHigh",
    ]);
  });

  it("derives offline from Miner.alive rather than Miner.alerts", () => {
    const state = currentAlertState([miner({ alive: false })]);
    expect(state["aabbccddeeff"].alerts.offline).toBeDefined();
  });

  it("does not report offline once the miner is alive again", () => {
    const state = currentAlertState([miner({ alive: true })]);
    expect(state["aabbccddeeff"].alerts.offline).toBeUndefined();
  });

  it("derives macMismatch from Miner.error rather than Miner.alerts", () => {
    const state = currentAlertState([miner({ error: "mac doesn't match" })]);
    expect(state["aabbccddeeff"].alerts.macMismatch).toMatchObject({
      message: "mac doesn't match",
    });
  });

  it("ignores an alert type it doesn't know how to render", () => {
    const state = currentAlertState([
      miner({ alerts: [{ type: "somethingUnknown" }] }),
    ]);
    expect(state["aabbccddeeff"].alerts).toEqual({});
  });

  it("returns an empty state for an empty input", () => {
    expect(currentAlertState([])).toEqual({});
  });
});

describe("activeAlertsToNotifications", () => {
  it("emits one notification per currently active alert", () => {
    const result = activeAlertsToNotifications([
      miner({ alerts: [{ type: "tempHigh", value: 65 }] }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "active-aabbccddeeff-tempHigh",
      minerLabel: "bitaxe-office",
      type: "tempHigh",
      detail: "65",
    });
  });

  it("uses a stable id so the same active alert doesn't churn across polls", () => {
    const first = activeAlertsToNotifications([
      miner({ alerts: [{ type: "tempHigh", value: 65 }] }),
    ]);
    const second = activeAlertsToNotifications([
      miner({
        timestamp: "2026-07-22T10:02:00Z",
        alerts: [{ type: "tempHigh", value: 66 }],
      }),
    ]);

    expect(first[0].id).toBe(second[0].id);
  });

  it("shows a miner that's currently offline, even with no alerts entries", () => {
    const result = activeAlertsToNotifications([miner({ alive: false })]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("offline");
  });

  it("shows a miner with a mac mismatch, even with no alerts entries", () => {
    const result = activeAlertsToNotifications([
      miner({ error: "mac doesn't match" }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "macMismatch",
      detail: "mac doesn't match",
    });
  });

  it("uses the alert's message as detail when there is no numeric value", () => {
    const result = activeAlertsToNotifications([
      miner({ alerts: [{ type: "firmwareUpdate", message: "2.1 available" }] }),
    ]);
    expect(result[0].detail).toBe("2.1 available");
  });

  it("rounds a numeric value for display", () => {
    const result = activeAlertsToNotifications([
      miner({ alerts: [{ type: "tempHigh", value: 65.7 }] }),
    ]);
    expect(result[0].detail).toBe("66");
  });

  it("returns nothing when no miner currently has an alert", () => {
    expect(activeAlertsToNotifications([miner()])).toEqual([]);
  });
});

describe("resolvedAlertsToNotifications", () => {
  it("emits nothing when the miner is still active per the live miners list", () => {
    const result = resolvedAlertsToNotifications(
      [historyEntry({ alerts: [{ type: "tempHigh", value: 65 }] })],
      [miner({ alerts: [{ type: "tempHigh", value: 65 }] })],
    );
    expect(result).toEqual([]);
  });

  it("never resolves offline, even when history shows it and the live miner is back -- see the function's doc comment for why", () => {
    const result = resolvedAlertsToNotifications(
      [
        historyEntry({
          timestamp: "2026-07-22T09:00:00Z",
          alerts: [{ type: "offline", message: "connection refused" }],
        }),
      ],
      [miner({ alive: true })], // the live miners list, refreshed independently, says it's back
    );

    expect(result).toEqual([]);
  });

  it("never resolves macMismatch either -- same reliability gap as offline", () => {
    const result = resolvedAlertsToNotifications(
      [
        historyEntry({
          timestamp: "2026-07-22T09:00:00Z",
          alerts: [{ type: "macMismatch", message: "mac doesn't match" }],
        }),
      ],
      [miner({ error: undefined })], // live state says it's no longer mismatched
    );

    expect(result).toEqual([]);
  });

  it("uses a deterministic id anchored to the last-seen-active entry, so repeated polls don't duplicate it", () => {
    const history = [
      historyEntry({
        timestamp: "2026-07-22T09:00:00Z",
        alerts: [{ type: "tempHigh", value: 65 }],
      }),
    ];
    const miners = [miner()]; // no longer reports tempHigh -- resolved

    const first = resolvedAlertsToNotifications(history, miners);
    const second = resolvedAlertsToNotifications(history, miners);
    expect(first[0].id).toBe(second[0].id);
  });

  it("only reports types that actually resolved, not ones still active", () => {
    const result = resolvedAlertsToNotifications(
      [
        historyEntry({
          timestamp: "2026-07-22T09:00:00Z",
          alerts: [
            { type: "tempHigh", value: 65 },
            { type: "fanHigh", value: 80 },
          ],
        }),
      ],
      [miner({ alerts: [{ type: "fanHigh", value: 80 }] })],
    );

    expect(result.map((n) => n.type)).toEqual(["tempRecovered"]);
  });

  it("returns nothing for empty inputs", () => {
    expect(resolvedAlertsToNotifications([], [])).toEqual([]);
  });
});

describe("episodesToAlertHistoryRows", () => {
  it("maps a single episode to a single row", () => {
    const result = episodesToAlertHistoryRows([alertEpisode()]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      minerLabel: "bitaxe-office",
      minerIp: "10.0.0.65",
      type: "tempHigh",
      detail: "65",
    });
  });

  it("carries firstSeen/lastSeen/occurrences through for a multi-occurrence episode", () => {
    const result = episodesToAlertHistoryRows([
      alertEpisode({
        firstSeen: "2026-07-22T08:00:00Z",
        lastSeen: "2026-07-22T10:00:00Z",
        occurrences: 24,
        peakValue: 83,
      }),
    ]);

    expect(result[0]).toMatchObject({
      firstSeen: "2026-07-22T08:00:00Z",
      lastSeen: "2026-07-22T10:00:00Z",
      occurrences: 24,
      detail: "83",
    });
  });

  it("maps each episode in the array to its own row -- one row per (miner, type), already grouped server-side", () => {
    const result = episodesToAlertHistoryRows([
      alertEpisode({ type: "tempHigh" }),
      alertEpisode({ type: "fanHigh", peakValue: 80 }),
    ]);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.type).sort()).toEqual(["fanHigh", "tempHigh"]);
  });

  it("uses the episode's message as detail when there is no peak value", () => {
    const result = episodesToAlertHistoryRows([
      alertEpisode({
        type: "offline",
        peakValue: undefined,
        threshold: undefined,
        message: "connection refused",
      }),
    ]);
    expect(result[0].detail).toBe("connection refused");
  });

  it("skips an alert type it doesn't know how to render", () => {
    const result = episodesToAlertHistoryRows([
      alertEpisode({ type: "somethingUnknown" }),
    ]);
    expect(result).toEqual([]);
  });

  it("returns an empty list for an empty input", () => {
    expect(episodesToAlertHistoryRows([])).toEqual([]);
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

describe("createAppUpdateAvailableNotification", () => {
  it("creates a non-miner-specific appUpdateAvailable notification", () => {
    const notification = createAppUpdateAvailableNotification();

    expect(notification).toMatchObject({
      type: "appUpdateAvailable",
      minerLabel: "",
    });
    expect(notification.id).toBeTruthy();
    expect(notification.timestamp).toBeTypeOf("number");
  });
});
