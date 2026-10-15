// src/pages/settings/AppSettingsFrame.tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Paper, Skeleton, Snackbar } from "@mui/material";

import { useAppSettings } from "@/hooks/useAppSettings";
import { useUiFeatures } from "@/hooks/useMiners";
import {
  type AppSettings,
  type AppSettingsInput,
} from "@/schemas/appSettingsSchema";

export interface AppSettingsFrameContext {
  data: AppSettings | undefined;
  readOnly: boolean;
  isSaving: boolean;
  /** Saves the full settings.yml: `serverBasePayload()` with only the
   * caller's own section overridden. */
  persist: (payload: AppSettingsInput) => Promise<void>;
  serverBasePayload: () => AppSettingsInput;
}

/**
 * Shared frame of the Electricity / Remote / System sections -- the three
 * slices of settings.yml. Each section persists itself as soon as the
 * operator acts on it, but POST /api/config/settings always replaces the
 * whole file (no partial-field updates server-side), so every save is built
 * from serverBasePayload(): the server's last confirmed state (`data`, not
 * any section's local form state), with only the saving section overridden.
 * An unconfirmed, possibly-invalid edit sitting in another section is never
 * sent along.
 */
export const AppSettingsFrame = ({
  children,
}: {
  children: (ctx: AppSettingsFrameContext) => React.ReactNode;
}) => {
  const { t } = useTranslation();
  const { ui } = useUiFeatures();
  const readOnly = ui.page.settings === "readonly";
  const { data, isLoading, saveSettings, isSaving, saveError } =
    useAppSettings();
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  const serverBasePayload = (): AppSettingsInput => ({
    electricity: data?.electricity ?? { ratePerKwh: 0 },
    pools: data?.pools ?? { dashboards: {} },
    remote: data?.remote ?? { pushURL: "", apiKey: "" },
    // Firmware repos are built-in and not editable from this UI (see the
    // System section's read-only table) -- never send an override.
    firmware: { repos: {} },
  });

  const persist = async (payload: AppSettingsInput) => {
    try {
      await saveSettings(payload);
      setSnackbarMessage(t("settingsPage.appSettings.saveSuccess"));
    } catch {
      // saveError from useAppSettings already surfaces the message.
    }
  };

  if (isLoading) {
    return <Skeleton variant="rounded" height={320} sx={{ borderRadius: 3 }} />;
  }

  return (
    <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 }, borderRadius: 3 }}>
      {saveError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {saveError}
        </Alert>
      )}

      {children({ data, readOnly, isSaving, persist, serverBasePayload })}

      <Snackbar
        open={snackbarMessage !== null}
        autoHideDuration={5000}
        onClose={() => setSnackbarMessage(null)}
        message={snackbarMessage ?? ""}
      />
    </Paper>
  );
};
