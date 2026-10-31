import { type TFunction } from "i18next";
import { describe, expect, it } from "vitest";

import { type AlertEvent } from "@/schemas/minerSchema";
import { formatTimestamp } from "@/utils/format";

import {
  alertColor,
  alertSince,
  alertText,
  alertWhen,
  createAppUpdateAvailableNotification,
  createAutoRefreshToggledNotification,
} from "./minerNotifications";

const event = (overrides: Partial<AlertEvent> = {}): AlertEvent => ({
  ts: "2026-10-28T10:00:00Z",
  mac: "aabbccddeeff",
  ip: "10.0.0.65",
  hostname: "bitaxe-office",
  type: "tempHigh",
  state: "raised",
  ...overrides,
});

// Renders the key and its params, to check what alertText asks for.
const t = ((key: string, params: object) =>
  `${key} ${JSON.stringify(params)}`) as unknown as TFunction;

describe("alertColor", () => {
  it("is red for a problem, orange for a firmware update, green once cleared", () => {
    expect(alertColor(event())).toBe("#f44336");
    expect(alertColor(event({ type: "offline" }))).toBe("#f44336");
    expect(alertColor(event({ type: "firmwareUpdate" }))).toBe("#ff9800");
    expect(alertColor(event({ state: "cleared" }))).toBe("#66bb6a");
    expect(
      alertColor(event({ type: "firmwareUpdate", state: "cleared" })),
    ).toBe("#66bb6a");
  });
});

describe("alertText", () => {
  it("picks the message by state and type, the reading rounded", () => {
    expect(alertText(t, event({ value: 64.6 }))).toBe(
      'alerts.raised.tempHigh {"miner":"bitaxe-office","value":65}',
    );
    expect(alertText(t, event({ state: "cleared" }))).toBe(
      'alerts.cleared.tempHigh {"miner":"bitaxe-office"}',
    );
  });

  it("uses the message when there's no reading", () => {
    expect(
      alertText(t, event({ type: "firmwareUpdate", message: "v2.15.4" })),
    ).toBe(
      'alerts.raised.firmwareUpdate {"miner":"bitaxe-office","value":"v2.15.4"}',
    );
  });

  it("names the miner by its ip, then its mac, without a hostname", () => {
    expect(alertText(t, event({ hostname: undefined }))).toContain(
      '"miner":"10.0.0.65"',
    );
    expect(
      alertText(t, event({ hostname: undefined, ip: undefined })),
    ).toContain('"miner":"aabbccddeeff"');
  });
});

describe("alertWhen", () => {
  it("is the time of a raised one", () => {
    expect(alertWhen(t, event())).toBe(formatTimestamp("2026-10-28T10:00:00Z"));
  });

  it("is from when to when, and how long, for one that ended", () => {
    const cleared = event({
      ts: "2026-10-28T11:30:00Z",
      state: "cleared",
      raisedAt: "2026-10-28T10:00:00Z",
    });
    expect(alertWhen(t, cleared)).toBe(
      `${formatTimestamp("2026-10-28T10:00:00Z")} → ${formatTimestamp("2026-10-28T11:30:00Z")} · alerts.lasted {"duration":"1h 30m"}`,
    );
  });
});

describe("alertWhen with a peak", () => {
  it("adds the highest reading while it lasted", () => {
    const cleared = event({
      type: "fanHigh",
      ts: "2026-10-28T11:30:00Z",
      state: "cleared",
      raisedAt: "2026-10-28T10:00:00Z",
      peak: 98.6,
    });
    expect(alertWhen(t, cleared)).toBe(
      `${formatTimestamp("2026-10-28T10:00:00Z")} → ${formatTimestamp("2026-10-28T11:30:00Z")} · alerts.lasted {"duration":"1h 30m"} · alerts.peak.fanHigh {"value":99}`,
    );
  });
});

describe("alertSince", () => {
  it("is when it was raised, and for how long now", () => {
    const ts = new Date(Date.now() - 90 * 60_000).toISOString();
    expect(alertSince(t, event({ ts }))).toBe(
      `${formatTimestamp(ts)} · alerts.ongoingFor {"duration":"1h 30m"}`,
    );
  });

  it("adds the reading that raised it when asked", () => {
    const ts = new Date(Date.now() - 90 * 60_000).toISOString();
    expect(alertSince(t, event({ ts, value: 83.4 }), true)).toBe(
      `${formatTimestamp(ts)} · alerts.ongoingFor {"duration":"1h 30m"} · alerts.atStart.tempHigh {"value":83}`,
    );
    expect(alertSince(t, event({ ts, type: "offline" }), true)).toBe(
      `${formatTimestamp(ts)} · alerts.ongoingFor {"duration":"1h 30m"}`,
    );
  });
});

describe("createAutoRefreshToggledNotification", () => {
  it("creates an autoRefreshToggled notification", () => {
    const notification = createAutoRefreshToggledNotification("off");

    expect(notification).toMatchObject({
      type: "autoRefreshToggled",
      detail: "off",
    });
    expect(notification.id).toBeTruthy();
    expect(notification.timestamp).toBeTypeOf("number");
  });
});

describe("createAppUpdateAvailableNotification", () => {
  it("creates an appUpdateAvailable notification", () => {
    const notification = createAppUpdateAvailableNotification();

    expect(notification).toMatchObject({ type: "appUpdateAvailable" });
    expect(notification.id).toBeTruthy();
    expect(notification.timestamp).toBeTypeOf("number");
  });

  it("gives each one its own id", () => {
    expect(createAppUpdateAvailableNotification().id).not.toBe(
      createAppUpdateAvailableNotification().id,
    );
  });
});
