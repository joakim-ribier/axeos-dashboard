// src/contexts/NotificationsContext.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { type LocalNotification } from "@/utils/minerNotifications";

const STORAGE_KEY = "axeos.notifications";
const CLEARED_AT_KEY = "axeos.notifications.clearedAt";
const MAX_NOTIFICATIONS = 100;

interface NotificationsContextValue {
  notifications: LocalNotification[];
  addNotifications: (notifications: LocalNotification[]) => void;
  // The bell's items up to this time (ms) are hidden, in this browser.
  clearedAt: number;
  clear: (timestamp: number) => void;
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

const load = <T,>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const save = (key: string, value: unknown) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage can throw (private browsing quota, disabled storage) --
    // the bell then simply starts over on a refresh.
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
  const [notifications, setNotifications] = useState<LocalNotification[]>(() =>
    load(STORAGE_KEY, []),
  );
  const [clearedAt, setClearedAt] = useState(() => load(CLEARED_AT_KEY, 0));

  useEffect(() => save(STORAGE_KEY, notifications), [notifications]);
  useEffect(() => save(CLEARED_AT_KEY, clearedAt), [clearedAt]);

  // Stable reference -- consumed as a useEffect dependency (see Sidebar).
  const addNotifications = useCallback((newOnes: LocalNotification[]) => {
    if (newOnes.length === 0) return;
    setNotifications((current) =>
      [...newOnes, ...current].slice(0, MAX_NOTIFICATIONS),
    );
  }, []);

  const clear = useCallback((timestamp: number) => {
    setClearedAt((current) => Math.max(current, timestamp));
    setNotifications([]);
  }, []);

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        addNotifications,
        clearedAt,
        clear,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
};
