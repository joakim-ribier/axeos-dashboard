// src/utils/minerNotifications.ts
import { type TFunction } from "i18next";

import { type AlertEvent } from "@/schemas/minerSchema";

// Every alert type, in the order the dashboard offers them -- the server's
// alerts.Types.
export const ALERT_TYPES = [
  "tempHigh",
  "fanHigh",
  "offline",
  "macMismatch",
  "firmwareUpdate",
] as const;

// Shared between the bell and the Alerts page: red for a problem, orange
// for a firmware update available, green for one that ended.
export const alertColor = (event: AlertEvent): string => {
  if (event.state === "cleared") return "#66bb6a";
  return event.type === "firmwareUpdate" ? "#ff9800" : "#f44336";
};

const alertMinerLabel = (event: AlertEvent): string =>
  event.hostname || event.ip || event.mac;

export const alertText = (t: TFunction, event: AlertEvent): string =>
  t(`alerts.${event.state}.${event.type}`, {
    miner: alertMinerLabel(event),
    value: event.value !== undefined ? Math.round(event.value) : event.message,
  });

/** The bell's own events, not miners' -- kept in the browser (see
 * NotificationsContext). */
export interface LocalNotification {
  id: string;
  timestamp: number;
  type: "autoRefreshToggled" | "appUpdateAvailable";
  detail?: string;
}

let idCounter = 0;
const nextId = (): string => `notif-${Date.now()}-${idCounter++}`;

/** Auto-refresh turned on or off from the top bar. `detail` is expected to
 * already be translated by the caller (e.g. "on"/"off"). */
export const createAutoRefreshToggledNotification = (
  detail: string,
): LocalNotification => ({
  id: nextId(),
  timestamp: Date.now(),
  type: "autoRefreshToggled",
  detail,
});

/** A new build of the dashboard app itself has been published -- the
 * check runs server-side (internal/appversion); this fires once per browser
 * when the polled status first flips to "updateAvailable" (see Sidebar). */
export const createAppUpdateAvailableNotification = (): LocalNotification => ({
  id: nextId(),
  timestamp: Date.now(),
  type: "appUpdateAvailable",
});
