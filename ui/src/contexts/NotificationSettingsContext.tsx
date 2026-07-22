// src/contexts/NotificationSettingsContext.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NotificationSettings,
} from "@/utils/minerNotifications";

const STORAGE_KEY = "axeos.notificationSettings";

interface NotificationSettingsContextValue {
  settings: NotificationSettings;
  updateSettings: (patch: Partial<NotificationSettings>) => void;
}

const NotificationSettingsContext =
  createContext<NotificationSettingsContextValue | null>(null);

export const useNotificationSettings = (): NotificationSettingsContextValue => {
  const ctx = useContext(NotificationSettingsContext);
  if (!ctx) {
    throw new Error(
      "useNotificationSettings must be used within NotificationSettingsProvider",
    );
  }
  return ctx;
};

const loadFromStorage = (): NotificationSettings => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_SETTINGS;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return DEFAULT_NOTIFICATION_SETTINGS;
    }
    return { ...DEFAULT_NOTIFICATION_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
};

interface NotificationSettingsProviderProps {
  children: React.ReactNode;
}

export const NotificationSettingsProvider = ({
  children,
}: NotificationSettingsProviderProps) => {
  const [settings, setSettings] =
    useState<NotificationSettings>(loadFromStorage);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // localStorage can throw (private browsing quota, disabled storage) —
      // settings simply won't survive a refresh in that case.
    }
  }, [settings]);

  const updateSettings = useCallback((patch: Partial<NotificationSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
  }, []);

  return (
    <NotificationSettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </NotificationSettingsContext.Provider>
  );
};
