// src/hooks/useAppSettings.ts
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

import { useMode } from "@/contexts/ModeContext";
import {
  type AppSettings,
  type AppSettingsInput,
  appSettingsSchema,
} from "@/schemas/appSettingsSchema";
import { extractErrorMessage } from "@/utils/apiError";

// The local dashboard's own settings -- a board has none.
const SETTINGS_PATH = "/api/config/settings";

const fetchAppSettings = async (url: string): Promise<AppSettings> => {
  const { data } = await axios.get(url);
  return appSettingsSchema.parse(data);
};

const postAppSettings = async (
  url: string,
  settings: AppSettingsInput,
): Promise<AppSettings> => {
  const { data } = await axios.post(url, settings);
  return appSettingsSchema.parse(data);
};

export interface UseAppSettingsReturn {
  data: AppSettings | undefined;
  isLoading: boolean;
  error: Error | null;
  /**
   * Saves the editable subset of app settings (electricity, pools
   * dashboards, remote, firmware repos). Resolves with the full, updated
   * settings on success and refreshes `data` to match -- effective
   * immediately on this dashboard-api process (see Router.snapshotConfig),
   * and picked up by the feeder (a separate process) within one of its own
   * polling cycles via mtime-based hot-reload (see config.AppSettingsStore)
   * -- no restart needed either way.
   */
  saveSettings: (settings: AppSettingsInput) => Promise<AppSettings>;
  isSaving: boolean;
  saveError: string | null;
}

/**
 * The managed app settings (electricity rate, pool dashboard links, remote
 * push credentials, firmware repos) -- the operational subset of
 * dashboard.yml editable from /settings. `readOnly` on the response also
 * carries a few process-launch settings (poll intervals, firmware cache
 * TTL) shown for visibility only -- never part of what saveSettings sends.
 */
export const useAppSettings = (): UseAppSettingsReturn => {
  const queryClient = useQueryClient();
  const { mode } = useMode();
  const query = useQuery<AppSettings, Error>({
    queryKey: ["config", "settings", SETTINGS_PATH],
    queryFn: () => fetchAppSettings(SETTINGS_PATH),
    // A board has no settings of its own (see useMinerStatus's fallback).
    enabled: mode === "local",
    // Always refetched on mount, same reasoning as useMinersConfig: this
    // page needs to see a save made just moments ago, not a stale snapshot.
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const saveSettings = async (
    settings: AppSettingsInput,
  ): Promise<AppSettings> => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const result = await postAppSettings(SETTINGS_PATH, settings);
      await query.refetch();
      // GET /api/miners echoes electricity.devices -- drop its cached copy
      // so the dashboard shows a device added/removed here right away.
      void queryClient.invalidateQueries({ queryKey: ["miners"] });
      // GET /api/status says whether remote push is configured: refreshed
      // so the board's link follows a push turned on or off.
      void queryClient.invalidateQueries({ queryKey: ["servicesStatus"] });
      return result;
    } catch (err: unknown) {
      setSaveError(extractErrorMessage(err));
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error ?? null,
    saveSettings,
    isSaving,
    saveError,
  };
};
