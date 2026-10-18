// src/contexts/NotificationsContext.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { MinerNotification } from "@/utils/minerNotifications";

// The local dashboard's -- a board has no notifications. ".local" is a
// leftover of when boards had their own, kept so nothing stored is lost.
const STORAGE_KEY = "axeos.notifications.local";
const READ_STORAGE_KEY = "axeos.notifications.read.local";
const MAX_NOTIFICATIONS = 100;
const MAX_READ_IDS = 200;

interface NotificationsContextValue {
  notifications: MinerNotification[];
  addNotifications: (notifications: MinerNotification[]) => void;
  clear: () => void;
  // Ids the bell has already been opened on, so it can show an "unread"
  // badge count instead of a total count -- see markRead().
  readIds: Set<string>;
  markRead: (ids: string[]) => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(
  null,
);

export const useNotifications = (): NotificationsContextValue => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error(
      "useNotifications must be used within NotificationsProvider",
    );
  }
  return ctx;
};

const loadFromStorage = (): MinerNotification[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MinerNotification[]) : [];
  } catch {
    return [];
  }
};

const loadReadIds = (): Set<string> => {
  try {
    const raw = window.localStorage.getItem(READ_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? (parsed as string[]) : []);
  } catch {
    return new Set();
  }
};

interface NotificationsProviderProps {
  children: React.ReactNode;
}

/**
 * The local dashboard's notifications, kept in the browser (see AppLayout).
 */
export const NotificationsProvider = ({
  children,
}: NotificationsProviderProps) => {
  const [notifications, setNotifications] =
    useState<MinerNotification[]>(loadFromStorage);
  const [readIds, setReadIds] = useState<Set<string>>(loadReadIds);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    } catch {
      // localStorage can throw (private browsing quota, disabled storage) —
      // notifications simply won't survive a refresh in that case.
    }
  }, [notifications]);

  useEffect(() => {
    try {
      // Capped the same way as notifications, oldest first -- read state
      // for an id that's since fallen out of the notifications list is
      // harmless to keep around, this just stops it growing unbounded.
      window.localStorage.setItem(
        READ_STORAGE_KEY,
        JSON.stringify([...readIds].slice(-MAX_READ_IDS)),
      );
    } catch {
      // best-effort only, same reasoning as the notifications persist above.
    }
  }, [readIds]);

  // Stable reference — consumed as a useEffect dependency (see
  // useAlertResolutionEffect), so a new function identity on every render
  // would trigger spurious re-runs. Deduped by id: resolvedAlertsToNotifications
  // recomputes the same deterministic ids on every poll for as long as a
  // resolved alert stays within the fetched history window, so without this
  // the same event would pile up as a new row every 90s instead of once.
  const addNotifications = useCallback((newOnes: MinerNotification[]) => {
    if (newOnes.length === 0) return;
    setNotifications((current) => {
      const existingIds = new Set(current.map((n) => n.id));
      const deduped = newOnes.filter((n) => !existingIds.has(n.id));
      if (deduped.length === 0) return current;
      return [...deduped, ...current].slice(0, MAX_NOTIFICATIONS);
    });
  }, []);

  const clear = useCallback(() => setNotifications([]), []);

  // Marks the given ids as read -- called when the bell popover opens, with
  // the ids currently on screen. Bails out (no new Set) when nothing
  // actually changes, so opening the bell repeatedly with no new
  // notifications in between doesn't churn the read-state persist effect.
  const markRead = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setReadIds((current) => {
      const next = new Set(current);
      let changed = false;
      for (const id of ids) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, []);

  return (
    <NotificationsContext.Provider
      value={{ notifications, addNotifications, clear, readIds, markRead }}
    >
      {children}
    </NotificationsContext.Provider>
  );
};
