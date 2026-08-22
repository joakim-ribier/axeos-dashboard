// src/contexts/NotificationsContext.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useLocation } from "react-router-dom";

import { boardIdFromPathname } from "@/utils/boardId";
import { MinerNotification } from "@/utils/minerNotifications";

const STORAGE_KEY_PREFIX = "axeos.notifications.";
const READ_STORAGE_KEY_PREFIX = "axeos.notifications.read.";
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

const storageKey = (boardId: string | undefined): string =>
  `${STORAGE_KEY_PREFIX}${boardId ?? "local"}`;

const loadFromStorage = (boardId: string | undefined): MinerNotification[] => {
  try {
    const raw = window.localStorage.getItem(storageKey(boardId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MinerNotification[]) : [];
  } catch {
    return [];
  }
};

const readStorageKey = (boardId: string | undefined): string =>
  `${READ_STORAGE_KEY_PREFIX}${boardId ?? "local"}`;

const loadReadIds = (boardId: string | undefined): Set<string> => {
  try {
    const raw = window.localStorage.getItem(readStorageKey(boardId));
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
 * Notifications are scoped per board (keyed by boardId) — otherwise a
 * shared/remote deployment serving multiple boards under the same origin
 * would mix every board's notification history into a single list, since
 * localStorage is shared across all paths on that origin.
 *
 * This provider is mounted once above the routing tree (see App.tsx), so it
 * derives boardId from the URL directly via useLocation() rather than
 * ModeContext, same reasoning as Sidebar/useBuildSHA. It reloads from
 * storage whenever boardId changes, in case client-side navigation between
 * boards is ever introduced (today every board is a distinct URL, so a
 * fresh mount already picks up the right key on its own).
 */
export const NotificationsProvider = ({
  children,
}: NotificationsProviderProps) => {
  const location = useLocation();
  const boardId = boardIdFromPathname(location.pathname);

  const [notifications, setNotifications] = useState<MinerNotification[]>(() =>
    loadFromStorage(boardId),
  );
  const [readIds, setReadIds] = useState<Set<string>>(() =>
    loadReadIds(boardId),
  );

  useEffect(() => {
    setNotifications(loadFromStorage(boardId));
    setReadIds(loadReadIds(boardId));
    // Only re-run when the board itself changes, not on every notifications
    // update (that's handled by the persist effects below).
  }, [boardId]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        storageKey(boardId),
        JSON.stringify(notifications),
      );
    } catch {
      // localStorage can throw (private browsing quota, disabled storage) —
      // notifications simply won't survive a refresh in that case.
    }
  }, [notifications, boardId]);

  useEffect(() => {
    try {
      // Capped the same way as notifications, oldest first -- read state
      // for an id that's since fallen out of the notifications list is
      // harmless to keep around, this just stops it growing unbounded.
      window.localStorage.setItem(
        readStorageKey(boardId),
        JSON.stringify([...readIds].slice(-MAX_READ_IDS)),
      );
    } catch {
      // best-effort only, same reasoning as the notifications persist above.
    }
  }, [readIds, boardId]);

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
