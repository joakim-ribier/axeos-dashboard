// src/hooks/useAppSettings.ts
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import { useMode } from "@/contexts/ModeContext";
import {
  type AppSettings,
  type AppSettingsInput,
  appSettingsSchema,
} from "@/schemas/appSettingsSchema";
import { extractErrorMessage } from "@/utils/apiError";

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
  const { apiPaths } = useMode();
  const query = useQuery<AppSettings, Error>({
    queryKey: ["config", "settings", apiPaths.config.settings],
    queryFn: () => fetchAppSettings(apiPaths.config.settings),
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
      const result = await postAppSettings(apiPaths.config.settings, settings);
      await query.refetch();
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
