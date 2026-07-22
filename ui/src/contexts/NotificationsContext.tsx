// src/contexts/NotificationsContext.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useLocation } from "react-router-dom";

import { MinerNotification } from "@/utils/minerNotifications";

const STORAGE_KEY_PREFIX = "axeos.notifications.";
const MAX_NOTIFICATIONS = 100;

interface NotificationsContextValue {
  notifications: MinerNotification[];
  addNotifications: (notifications: MinerNotification[]) => void;
  clear: () => void;
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

interface NotificationsProviderProps {
  children: React.ReactNode;
}

/**
 * Notifications are scoped per board (keyed by boardId, same convention as
 * loadMinerSnapshot/saveMinerSnapshot in minerNotifications.ts) — otherwise
 * a shared/remote deployment serving multiple boards under the same origin
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
  const boardId = location.pathname.slice(1) || undefined;

  const [notifications, setNotifications] = useState<MinerNotification[]>(() =>
    loadFromStorage(boardId),
  );

  useEffect(() => {
    setNotifications(loadFromStorage(boardId));
    // Only re-run when the board itself changes, not on every notifications
    // update (that's handled by the persist effect below).
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

  // Stable references — consumed as a useEffect dependency in Home.tsx, so
  // a new function identity on every render would trigger spurious re-runs.
  const addNotifications = useCallback((newOnes: MinerNotification[]) => {
    if (newOnes.length === 0) return;
    setNotifications((current) =>
      [...newOnes, ...current].slice(0, MAX_NOTIFICATIONS),
    );
  }, []);

  const clear = useCallback(() => setNotifications([]), []);

  return (
    <NotificationsContext.Provider
      value={{ notifications, addNotifications, clear }}
    >
      {children}
    </NotificationsContext.Provider>
  );
};
