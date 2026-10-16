// src/pages/settings/AppSettingsFrame.tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import {
  Alert,
  IconButton,
  Paper,
  Skeleton,
  Snackbar,
  Tooltip,
} from "@mui/material";

import { useAppSettings } from "@/hooks/useAppSettings";
import { useUiFeatures } from "@/hooks/useMiners";
import {
  type AppSettings,
  type AppSettingsInput,
  EMPTY_NOTIFICATIONS,
  toNotificationsInput,
} from "@/schemas/appSettingsSchema";
import { copyToClipboard } from "@/utils/clipboard";

export interface AppSettingsFrameContext {
  data: AppSettings | undefined;
  readOnly: boolean;
  isSaving: boolean;
  /** Saves the full settings.yml: `serverBasePayload()` with only the
   * caller's own section overridden. */
  persist: (payload: AppSettingsInput) => Promise<void>;
  serverBasePayload: () => AppSettingsInput;
  /** Says briefly that something happened -- the same toast as a save.
   * With an error, the toast is a failure's: red, and the error itself
   * one click away from the clipboard. */
  notify: (message: string, error?: string) => void;
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
  const [toast, setToast] = useState<{
    message: string;
    error?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const notify = (message: string, error?: string) => {
    setCopied(false);
    setToast({ message, error });
  };
  const copyError = () =>
    copyToClipboard(toast?.error ?? "")
      .then(() => setCopied(true))
      .catch(() => {});

  const serverBasePayload = (): AppSettingsInput => ({
    electricity: data?.electricity ?? { ratePerKwh: 0 },
    pools: data?.pools ?? { dashboards: {} },
    remote: data?.remote ?? { pushURL: "", apiKey: "" },
    notifications: toNotificationsInput(
      data?.notifications ?? EMPTY_NOTIFICATIONS,
    ),
    // Firmware repos are built-in and not editable from this UI (see the
    // System section's read-only table) -- never send an override.
    firmware: { repos: {} },
  });

  const persist = async (payload: AppSettingsInput) => {
    try {
      await saveSettings(payload);
      notify(t("settingsPage.appSettings.saveSuccess"));
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

      {children({
        data,
        readOnly,
        isSaving,
        persist,
        serverBasePayload,
        notify,
      })}

      <Snackbar
        open={toast !== null}
        // A failure stays longer: there's a reason to read.
        autoHideDuration={toast?.error ? 10_000 : 5000}
        onClose={(_, reason) => {
          // A failure is there to be read and copied: a click elsewhere --
          // or on its own copy button, swapped for a check mark under the
          // pointer -- doesn't take it away. Its time out or ✕ does.
          if (reason === "clickaway" && toast?.error) return;
          setToast(null);
        }}
        message={toast?.message ?? ""}
        slotProps={{
          content: toast?.error
            ? { sx: { borderLeftColor: "error.main" } }
            : undefined,
        }}
        action={
          toast?.error && (
            <>
              <Tooltip
                title={copied ? t("common.copied") : t("common.copyError")}
              >
                <IconButton
                  size="small"
                  color="inherit"
                  onClick={() => void copyError()}
                  aria-label={t("common.copyError")}
                >
                  {copied ? (
                    <CheckIcon
                      fontSize="small"
                      sx={{ color: "success.main" }}
                    />
                  ) : (
                    <ContentCopyIcon fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
              <IconButton
                size="small"
                color="inherit"
                onClick={() => setToast(null)}
                aria-label={t("common.close")}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </>
          )
        }
      />
    </Paper>
  );
};
