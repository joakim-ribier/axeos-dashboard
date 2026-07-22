// src/contexts/RefreshSettingsContext.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const STORAGE_KEY = "axeos.autoRefreshEnabled";
const DEFAULT_AUTO_REFRESH_ENABLED = true;

interface RefreshSettingsContextValue {
  autoRefreshEnabled: boolean;
  setAutoRefreshEnabled: (enabled: boolean) => void;
}

const RefreshSettingsContext =
  createContext<RefreshSettingsContextValue | null>(null);

export const useRefreshSettings = (): RefreshSettingsContextValue => {
  const ctx = useContext(RefreshSettingsContext);
  if (!ctx) {
    throw new Error(
      "useRefreshSettings must be used within RefreshSettingsProvider",
    );
  }
  return ctx;
};

const loadFromStorage = (): boolean => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_AUTO_REFRESH_ENABLED;
    return raw === "true";
  } catch {
    return DEFAULT_AUTO_REFRESH_ENABLED;
  }
};

interface RefreshSettingsProviderProps {
  children: React.ReactNode;
}

export const RefreshSettingsProvider = ({
  children,
}: RefreshSettingsProviderProps) => {
  const [autoRefreshEnabled, setAutoRefreshEnabledState] =
    useState<boolean>(loadFromStorage);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(autoRefreshEnabled));
    } catch {
      // localStorage can throw (private browsing quota, disabled storage) —
      // the toggle simply won't survive a refresh in that case.
    }
  }, [autoRefreshEnabled]);

  const setAutoRefreshEnabled = useCallback((enabled: boolean) => {
    setAutoRefreshEnabledState(enabled);
  }, []);

  return (
    <RefreshSettingsContext.Provider
      value={{ autoRefreshEnabled, setAutoRefreshEnabled }}
    >
      {children}
    </RefreshSettingsContext.Provider>
  );
};
