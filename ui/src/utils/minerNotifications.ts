// src/utils/minerNotifications.ts
import { Miner } from "@/schemas/minerSchema";

export const TEMP_THRESHOLD = 60;
export const FAN_THRESHOLD = 75;

export type NotificationType =
  "temp" | "fan" | "offline" | "version" | "updateAvailable";

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
 * notifications for any state worth surfacing:
 * - temp crosses above TEMP_THRESHOLD
 * - fan speed crosses above FAN_THRESHOLD
 * - a miner goes offline (alive transitions to false)
 * - a miner has a pending firmware update available
 * - a miner's firmware version actually changed (an update was applied)
 *
 * temp/fan/offline/updateAvailable use an implicit neutral baseline when
 * there's no previous snapshot for a miner (first fetch, or a miner that
 * just appeared) — a miner that's already hot/offline/pending-update on
 * the very first load still gets notified, it isn't required to "become"
 * that way while the tab is open. Re-notification is still avoided: once
 * a miner is already in that state, it won't fire again on every
 * subsequent poll while it stays there.
 *
 * "version changed" is the one exception — it genuinely needs a real
 * previous version string to diff against, so it never fires on a miner's
 * first appearance.
 */
export const detectNotifications = (
  previous: Miner[] | undefined,
  current: Miner[],
): MinerNotification[] => {
  const previousByKey = new Map((previous ?? []).map((m) => [minerKey(m), m]));
  const notifications: MinerNotification[] = [];

  for (const miner of current) {
    const prev = previousByKey.get(minerKey(miner));
    const label = minerLabel(miner);

    const prevTemp = prev?.temp ?? -Infinity;
    if (prevTemp <= TEMP_THRESHOLD && miner.temp > TEMP_THRESHOLD) {
      notifications.push({
        id: nextId(),
        timestamp: Date.now(),
        minerLabel: label,
        type: "temp",
        detail: String(Math.round(miner.temp)),
      });
    }

    const prevFan = prev?.fanspeed ?? -Infinity;
    if (prevFan <= FAN_THRESHOLD && miner.fanspeed > FAN_THRESHOLD) {
      notifications.push({
        id: nextId(),
        timestamp: Date.now(),
        minerLabel: label,
        type: "fan",
        detail: String(Math.round(miner.fanspeed)),
      });
    }

    const wasAlive = prev ? prev.alive !== false : true;
    if (wasAlive && miner.alive === false) {
      notifications.push({
        id: nextId(),
        timestamp: Date.now(),
        minerLabel: label,
        type: "offline",
      });
    }

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

  return notifications;
};

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
