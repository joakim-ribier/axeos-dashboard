// src/contexts/NotificationsContext.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { MinerNotification } from "@/utils/minerNotifications";

const STORAGE_KEY = "axeos.notifications";
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

interface NotificationsProviderProps {
  children: React.ReactNode;
}

export const NotificationsProvider = ({
  children,
}: NotificationsProviderProps) => {
  const [notifications, setNotifications] =
    useState<MinerNotification[]>(loadFromStorage);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    } catch {
      // localStorage can throw (private browsing quota, disabled storage) —
      // notifications simply won't survive a refresh in that case.
    }
  }, [notifications]);

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
