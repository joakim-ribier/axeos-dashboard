// src/utils/minerNotifications.ts
import {
  type Alert,
  type AlertEntry,
  type AlertEpisode,
  type Miner,
} from "@/schemas/minerSchema";
import { displayName } from "@/utils/minerDisplay";

export type NotificationType =
  | "tempHigh"
  | "tempRecovered"
  | "fanHigh"
  | "fanRecovered"
  | "offline"
  | "macMismatch"
  // No "online" or "macMismatchResolved" -- unlike the other alert types,
  // offline and macMismatch have no resolved notification (see
  // resolvedAlertsToNotifications for why).
  | "firmwareUpdate"
  | "firmwareResolved"
  | "autoRefreshToggled"
  | "appUpdateAvailable";

export interface MinerNotification {
  id: string;
  timestamp: number;
  minerLabel: string;
  type: NotificationType;
  // Extra data needed to render the message (rounded temp/fan value, or the
  // available firmware version). Rendered via i18n at display time. Never
  // set on a "resolved" notification -- the server only stores alert-
  // bearing lines, so there's no reading to show for "back to normal".
  detail?: string;
}

let idCounter = 0;
const nextId = (): string => `notif-${Date.now()}-${idCounter++}`;

// The subset of NotificationType a server-computed Alert.type string can
// actually be (see server/internal/model/alert.go). The rest of
// NotificationType ("Recovered"/"Resolved" variants, plus the two purely
// local one-offs below) never comes from the server -- they're synthesized
// client-side by resolvedAlertsToNotifications.
export const ALERT_TYPES: readonly NotificationType[] = [
  "tempHigh",
  "fanHigh",
  "offline",
  "macMismatch",
  "firmwareUpdate",
];

const isAlertType = (value: string): value is NotificationType =>
  (ALERT_TYPES as readonly string[]).includes(value);

// offline and macMismatch are deliberately absent -- see
// resolvedAlertsToNotifications.
const RESOLVED_TYPE: Record<string, NotificationType> = {
  tempHigh: "tempRecovered",
  fanHigh: "fanRecovered",
  firmwareUpdate: "firmwareResolved",
};

// Shared between the notification bell and the Alerts page, so a given
// alert type always reads the same color everywhere. Red marks a "bad"
// state (a threshold exceeded, a miner offline, a mac mismatch), orange an
// informational one (a firmware update available), green the same states
// resolved.
export const ALERT_TYPE_COLOR: Partial<Record<NotificationType, string>> = {
  tempHigh: "#f44336",
  fanHigh: "#f44336",
  offline: "#f44336",
  macMismatch: "#f44336",
  firmwareUpdate: "#ff9800",
  tempRecovered: "#66bb6a",
  fanRecovered: "#66bb6a",
  firmwareResolved: "#66bb6a",
};

// Matches server/internal/config.NormalizeMac -- strip separators, lowercase.
// Needed to join Miner.macAddr (raw, as the device itself reports it, e.g.
// "AA:BB:CC:DD:EE:FF") against AlertEntry.minerMac (the normalized storage
// key, e.g. "aabbccddeeff") -- see currentAlertState's doc comment for why
// both are needed.
const normalizeMac = (mac: string): string =>
  mac.replace(/[:-]/g, "").toLowerCase();

/**
 * One miner's alert state as keyed by normalized mac. See currentAlertState().
 */
export type AlertState = Record<
  string,
  { label: string; alerts: Partial<Record<NotificationType, Alert>> }
>;

/**
 * Builds each miner's *live* alert state from the miners list (GET
 * /api/miners), not the alert-history endpoint -- the history endpoint
 * only ever stores lines that had an alert, so once a problem clears,
 * nothing new is appended for it and its last entry stays frozen on the
 * old, resolved reading forever. There's no way to tell "still active"
 * from "was active once, nothing since" from that history alone.
 *
 * temp/fan/firmwareUpdate come from Miner.alerts, refreshed on every
 * successful feeder poll (see server/internal/model/miner.go). offline and
 * macMismatch instead come from Miner.alive/Miner.error -- a separate,
 * independent watcher mechanism that keeps updating even while the
 * feeder's own poll is failing, which is exactly the case that matters for
 * "is the miner offline right now" (see CLAUDE.md's healthcheck section).
 */
export const currentAlertState = (miners: Miner[]): AlertState => {
  const state: AlertState = {};

  for (const miner of miners) {
    const mac = normalizeMac(miner.macAddr);
    const alerts: Partial<Record<NotificationType, Alert>> = {};

    for (const alert of miner.alerts ?? []) {
      if (isAlertType(alert.type)) alerts[alert.type] = alert;
    }
    if (miner.alive === false) alerts.offline = { type: "offline" };
    if (miner.error) {
      alerts.macMismatch = { type: "macMismatch", message: miner.error };
    }

    state[mac] = {
      label: displayName(miner) || miner.ip || mac,
      alerts,
    };
  }

  return state;
};

/**
 * Turns the *current* alert state into one notification per active alert --
 * this is what makes an ongoing alert always visible, however long it's
 * been active for: it's recomputed from the live miners list on every call
 * rather than fired once and then relying on a persisted event to still be
 * around later. The id is deterministic (`active-{mac}-{type}`) so React
 * doesn't treat every poll as a new row.
 */
export const activeAlertsToNotifications = (
  miners: Miner[],
): MinerNotification[] => {
  const notifications: MinerNotification[] = [];
  const state = currentAlertState(miners);

  for (const miner of miners) {
    const mac = normalizeMac(miner.macAddr);
    const minerState = state[mac];
    const timestamp = Date.parse(miner.timestamp) || Date.now();

    for (const type of ALERT_TYPES) {
      const alert = minerState.alerts[type];
      if (!alert) continue;
      notifications.push({
        id: `active-${mac}-${type}`,
        timestamp,
        minerLabel: minerState.label,
        type,
        detail:
          alert.value !== undefined
            ? String(Math.round(alert.value))
            : alert.message,
      });
    }
  }

  return notifications;
};

/**
 * Reconstructs "resolved" events by cross-referencing the alert *history*
 * (GET /api/miners/alerts -- used only to find out when a type was last
 * seen active, for a nicer timestamp) against the *live* miners list (used
 * to determine whether it's actually still active -- see currentAlertState
 * for why the history alone can't answer that). For every (miner, type)
 * that appears anywhere in the fetched history window but isn't part of
 * that miner's current live state, a resolved notification is synthesized,
 * anchored to the last history entry where it was still seen active.
 *
 * offline and macMismatch are skipped entirely: both are detected live by a
 * separate, much faster watcher (healthCheck.interval, seconds) than what
 * the feeder polls and persists to history (minutes) -- a blip shorter than
 * one feeder poll cycle clears without ever being written to history at
 * all, so "resolved" would often silently never fire, or fire off a stale
 * history entry from a much earlier, unrelated incident. The live "still
 * offline"/"still mismatched" alert (see currentAlertState /
 * activeAlertsToNotifications) stays accurate regardless -- only the
 * resolved side is unreliable enough to just not show.
 *
 * The id is deterministic (`resolved-{mac}-{type}-{lastActiveTimestamp}`),
 * so re-running this on every poll while that entry is still within the
 * fetched history window is safe -- NotificationsContext dedupes by id, so
 * the same resolution doesn't pile up as a new row each time.
 */
export const resolvedAlertsToNotifications = (
  historyEntries: AlertEntry[],
  miners: Miner[],
): MinerNotification[] => {
  const active = currentAlertState(miners);

  const lastActive = new Map<
    string,
    { mac: string; type: NotificationType; label: string; timestamp: number }
  >();
  for (const entry of historyEntries) {
    const timestamp = Date.parse(entry.timestamp) || 0;
    const label = entry.hostname || entry.minerIp || entry.minerMac;
    for (const alert of entry.alerts) {
      if (
        !isAlertType(alert.type) ||
        alert.type === "offline" ||
        alert.type === "macMismatch"
      )
        continue;
      const key = `${entry.minerMac}::${alert.type}`;
      const existing = lastActive.get(key);
      if (!existing || timestamp > existing.timestamp) {
        lastActive.set(key, {
          mac: entry.minerMac,
          type: alert.type,
          label,
          timestamp,
        });
      }
    }
  }

  const notifications: MinerNotification[] = [];
  for (const [key, seen] of lastActive) {
    if (active[seen.mac]?.alerts[seen.type]) continue; // still active, not resolved

    notifications.push({
      id: `resolved-${key}-${seen.timestamp}`,
      timestamp: seen.timestamp,
      minerLabel: seen.label,
      type: RESOLVED_TYPE[seen.type],
    });
  }

  return notifications;
};

/**
 * One row of the dedicated Alerts page (see hooks/useAlertsHistory.ts) --
 * one row per alert episode. The server already collapses consecutive
 * same-(miner, type) occurrences into a single range (see
 * handler.AlertEpisode), so unlike the bell there's no further grouping to
 * do here: this just adapts the episode shape to what the row renders.
 */
export interface AlertHistoryRow {
  id: string;
  firstSeen: string;
  lastSeen: string;
  occurrences: number;
  minerLabel: string;
  minerIp?: string;
  type: NotificationType;
  detail?: string;
}

export const episodesToAlertHistoryRows = (
  episodes: AlertEpisode[],
): AlertHistoryRow[] => {
  const rows: AlertHistoryRow[] = [];

  for (const episode of episodes) {
    if (!isAlertType(episode.type)) continue;
    rows.push({
      id: `${episode.minerMac}-${episode.type}-${episode.firstSeen}`,
      firstSeen: episode.firstSeen,
      lastSeen: episode.lastSeen,
      occurrences: episode.occurrences,
      minerLabel: episode.hostname || episode.minerIp || episode.minerMac,
      minerIp: episode.minerIp,
      type: episode.type,
      detail:
        episode.peakValue !== undefined
          ? String(Math.round(episode.peakValue))
          : episode.message,
    });
  }

  return rows;
};

/**
 * A single, non-miner-specific notification acknowledging that auto-refresh
 * was turned on or off from the Sidebar. `detail` is expected to already be
 * translated by the caller (e.g. "on"/"off").
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
 * "firmwareUpdate", which is about a miner's own firmware. The actual check
 * runs server-side (internal/appversion in the Go backend); this just fires
 * once per browser when the polled status first flips to "updateAvailable"
 * (see appVersion.ts / Sidebar.tsx).
 */
export const createAppUpdateAvailableNotification = (): MinerNotification => ({
  id: nextId(),
  timestamp: Date.now(),
  minerLabel: "",
  type: "appUpdateAvailable",
});
