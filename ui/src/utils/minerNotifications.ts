// src/utils/minerNotifications.ts
import { Miner } from "@/schemas/minerSchema";

export type NotificationType =
  | "temp"
  | "tempRecovered"
  | "fan"
  | "fanRecovered"
  | "offline"
  | "online"
  | "deviceError"
  | "deviceErrorResolved"
  | "version"
  | "updateAvailable"
  | "settingsUpdated"
  | "autoRefreshToggled"
  | "appUpdateAvailable";

export interface NotificationSettings {
  tempThreshold: number;
  fanThreshold: number;
  notifyTemp: boolean;
  notifyFan: boolean;
  notifyOffline: boolean;
  notifyUpdateAvailable: boolean;
  notifyVersion: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  tempThreshold: 62,
  fanThreshold: 75,
  notifyTemp: true,
  notifyFan: true,
  notifyOffline: true,
  notifyUpdateAvailable: true,
  notifyVersion: true,
};

export interface MinerNotification {
  id: string;
  timestamp: number;
  minerLabel: string;
  type: NotificationType;
  // Extra data needed to render the message (rounded temp/fan value, or
  // "oldVersion → newVersion"). Rendered via i18n at display time.
  detail?: string;
}

const minerKey = (miner: Miner): string => miner.ip;
const minerLabel = (miner: Miner): string => miner.hostname || miner.ip;

let idCounter = 0;
const nextId = (): string => `notif-${Date.now()}-${idCounter++}`;

/**
 * Compares the previous and current miner lists and returns the
 * notifications for any state worth surfacing, gated by `settings`:
 * - temp crosses above settings.tempThreshold, and back below it again
 *   (if settings.notifyTemp)
 * - fan speed crosses above settings.fanThreshold, and back below it again
 *   (if settings.notifyFan)
 * - a miner goes offline, and comes back online again
 *   (if settings.notifyOffline)
 * - a miner has a pending firmware update available (if settings.notifyUpdateAvailable)
 * - a miner's firmware version actually changed, i.e. an update was applied
 *   (if settings.notifyVersion)
 *
 * temp/fan comparisons use the *rounded* reading (matching what's actually
 * displayed on the miner cards), not the raw sensor float — otherwise a
 * miner sitting right at the threshold (e.g. reading 59.95, then 60.05,
 * then 59.98...) would flap between "exceeded"/"recovered" every poll even
 * though the displayed value never visibly changes.
 *
 * temp/fan/offline/updateAvailable use an implicit neutral baseline when
 * there's no previous snapshot for a miner (first fetch, or a miner that
 * just appeared) — a miner that's already hot/offline/pending-update on
 * the very first load still gets notified, it isn't required to "become"
 * that way while the tab is open. Re-notification is still avoided: once
 * a miner is already in that state, it won't fire again on every
 * subsequent poll while it stays there.
 *
 * The "recovered" side — temp/fan dropping back below the threshold, or a
 * miner coming back online — is the mirror image of the above, whether the
 * underlying state is a numeric threshold or a boolean one. It genuinely
 * needs a real previous reading to compare against — there's nothing to
 * "recover from" on a miner's first appearance, so it never fires there.
 *
 * "version changed" is the other exception — it genuinely needs a real
 * previous version string to diff against, so it never fires on a miner's
 * first appearance either.
 */
export const detectNotifications = (
  previous: Miner[] | undefined,
  current: Miner[],
  settings: NotificationSettings,
): MinerNotification[] => {
  const previousByKey = new Map((previous ?? []).map((m) => [minerKey(m), m]));
  const notifications: MinerNotification[] = [];

  for (const miner of current) {
    const prev = previousByKey.get(minerKey(miner));
    const label = minerLabel(miner);

    if (settings.notifyTemp) {
      const prevTemp = prev ? Math.round(prev.temp) : -Infinity;
      const currentTemp = Math.round(miner.temp);
      if (
        prevTemp <= settings.tempThreshold &&
        currentTemp > settings.tempThreshold
      ) {
        notifications.push({
          id: nextId(),
          timestamp: Date.now(),
          minerLabel: label,
          type: "temp",
          detail: String(currentTemp),
        });
      } else if (
        prev &&
        prevTemp > settings.tempThreshold &&
        currentTemp <= settings.tempThreshold
      ) {
        notifications.push({
          id: nextId(),
          timestamp: Date.now(),
          minerLabel: label,
          type: "tempRecovered",
          detail: String(currentTemp),
        });
      }
    }

    if (settings.notifyFan) {
      const prevFan = prev ? Math.round(prev.fanspeed) : -Infinity;
      const currentFan = Math.round(miner.fanspeed);
      if (
        prevFan <= settings.fanThreshold &&
        currentFan > settings.fanThreshold
      ) {
        notifications.push({
          id: nextId(),
          timestamp: Date.now(),
          minerLabel: label,
          type: "fan",
          detail: String(currentFan),
        });
      } else if (
        prev &&
        prevFan > settings.fanThreshold &&
        currentFan <= settings.fanThreshold
      ) {
        notifications.push({
          id: nextId(),
          timestamp: Date.now(),
          minerLabel: label,
          type: "fanRecovered",
          detail: String(currentFan),
        });
      }
    }

    if (settings.notifyOffline) {
      const wasAlive = prev ? prev.alive !== false : true;
      if (wasAlive && miner.alive === false) {
        notifications.push({
          id: nextId(),
          timestamp: Date.now(),
          minerLabel: label,
          type: "offline",
        });
      } else if (prev && prev.alive === false && miner.alive !== false) {
        notifications.push({
          id: nextId(),
          timestamp: Date.now(),
          minerLabel: label,
          type: "online",
        });
      }
    }

    // Always notified, not gated by a settings toggle -- a mac mismatch is a
    // data-integrity problem (wrong device at this IP, or a config typo),
    // not a routine health blip like offline/temp.
    const hadError = Boolean(prev?.error);
    const hasError = Boolean(miner.error);
    if (!hadError && hasError) {
      notifications.push({
        id: nextId(),
        timestamp: Date.now(),
        minerLabel: label,
        type: "deviceError",
        detail: miner.error,
      });
    } else if (prev && hadError && !hasError) {
      notifications.push({
        id: nextId(),
        timestamp: Date.now(),
        minerLabel: label,
        type: "deviceErrorResolved",
      });
    }

    if (settings.notifyUpdateAvailable) {
      const hadUpdateAvailable = prev?.updateAvailable === true;
      if (!hadUpdateAvailable && miner.updateAvailable === true) {
        notifications.push({
          id: nextId(),
          timestamp: Date.now(),
          minerLabel: label,
          type: "updateAvailable",
          detail: miner.latestVersion,
        });
      }
    }

    if (settings.notifyVersion) {
      if (prev?.version && miner.version && prev.version !== miner.version) {
        notifications.push({
          id: nextId(),
          timestamp: Date.now(),
          minerLabel: label,
          type: "version",
          detail: `${prev.version} → ${miner.version}`,
        });
      }
    }
  }

  return notifications;
};

export interface SettingsDiffEntry {
  key: keyof NotificationSettings;
  previousValue: NotificationSettings[keyof NotificationSettings];
  nextValue: NotificationSettings[keyof NotificationSettings];
}

/**
 * Pure diff between two settings snapshots — every field whose value
 * actually changed, keyed and raw (no i18n/formatting here; the caller
 * translates field labels and formats units since this file has no
 * dependency on react-i18next).
 */
export const diffNotificationSettings = (
  previous: NotificationSettings,
  next: NotificationSettings,
): SettingsDiffEntry[] => {
  const keys = Object.keys(next) as (keyof NotificationSettings)[];
  return keys
    .filter((key) => previous[key] !== next[key])
    .map((key) => ({
      key,
      previousValue: previous[key],
      nextValue: next[key],
    }));
};

/**
 * A single, non-miner-specific notification acknowledging that the
 * notification settings themselves were changed (e.g. a threshold edited,
 * a notify-toggle flipped). Intentionally a flat "it changed" signal, not a
 * per-miner re-check — see Home.tsx for why re-checking every miner against
 * a settings edit is the wrong call (each intermediate keystroke would
 * otherwise produce its own batch of notifications).
 *
 * `detail` is expected to be a human-readable, already-translated summary
 * of what changed (built from diffNotificationSettings() by the caller,
 * which has access to i18n) — e.g. "Temp threshold: 60°C → 30°C".
 */
export const createSettingsUpdatedNotification = (
  detail?: string,
): MinerNotification => ({
  id: nextId(),
  timestamp: Date.now(),
  minerLabel: "",
  type: "settingsUpdated",
  detail,
});

/**
 * A single, non-miner-specific notification acknowledging that auto-refresh
 * was turned on or off from the Sidebar. `detail` is expected to already be
 * translated by the caller (e.g. "on"/"off"), same convention as
 * createSettingsUpdatedNotification.
 */
export const createAutoRefreshToggledNotification = (
  detail: string,
): MinerNotification => ({
  id: nextId(),
  timestamp: Date.now(),
  minerLabel: "",
  type: "autoRefreshToggled",
  detail,
});

/**
 * A single, non-miner-specific notification for when a new build of the
 * dashboard app itself has been published -- distinct from
 * "updateAvailable", which is about a miner's own firmware. The actual
 * check runs server-side (internal/appversion in the Go backend); this
 * just fires once per browser when the polled status first flips to
 * "updateAvailable" (see appVersion.ts / Sidebar.tsx).
 */
export const createAppUpdateAvailableNotification = (): MinerNotification => ({
  id: nextId(),
  timestamp: Date.now(),
  minerLabel: "",
  type: "appUpdateAvailable",
});

const SNAPSHOT_STORAGE_PREFIX = "axeos.minerSnapshot.";

/**
 * Persists the last-seen miner list so a page reload doesn't lose track of
 * what's already been notified about. Without this, detectNotifications'
 * "no previous data" case (which intentionally notifies for anything
 * already in a bad state) would re-fire on every reload instead of once.
 */
export const loadMinerSnapshot = (boardId?: string): Miner[] | undefined => {
  try {
    const raw = localStorage.getItem(
      `${SNAPSHOT_STORAGE_PREFIX}${boardId ?? "local"}`,
    );
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Miner[]) : undefined;
  } catch {
    return undefined;
  }
};

export const saveMinerSnapshot = (
  boardId: string | undefined,
  data: Miner[],
): void => {
  try {
    localStorage.setItem(
      `${SNAPSHOT_STORAGE_PREFIX}${boardId ?? "local"}`,
      JSON.stringify(data),
    );
  } catch {
    // best-effort only — a failure here just means the next reload treats
    // this as a fresh baseline again, no functional break.
  }
};
