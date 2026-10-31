// src/components/ui/AlertThresholdsEditor.tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import SaveIcon from "@mui/icons-material/Save";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import {
  fromThreshold,
  thresholdInvalid,
  toThreshold,
} from "@/components/ui/thresholdInput";
import { Writable } from "@/components/ui/Writable";
import { type AlertThresholds } from "@/schemas/appSettingsSchema";
import { type MinerConfig } from "@/schemas/minerConfigSchema";
import { extractErrorMessage } from "@/utils/apiError";

interface AlertThresholdsEditorProps {
  miner: MinerConfig;
  /** The thresholds every miner follows, shown as the empty fields'
   * placeholders. */
  defaults: AlertThresholds;
  saveMiners: (miners: MinerConfig[]) => Promise<MinerConfig[]>;
  readOnly?: boolean;
}

/** This miner's own alert thresholds -- a field left empty follows every
 * miner's (Configuration › System). Persists via saveMiners, same pattern
 * as AliasEditor. */
export const AlertThresholdsEditor = ({
  miner,
  defaults,
  saveMiners,
  readOnly = false,
}: AlertThresholdsEditorProps) => {
  const { t } = useTranslation();
  const saved = miner.alerts ?? { tempHigh: 0, fanHigh: 0 };

  const [temp, setTemp] = useState(fromThreshold(saved.tempHigh));
  const [fan, setFan] = useState(fromThreshold(saved.fanHigh));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invalid =
    thresholdInvalid("tempHigh", temp) || thresholdInvalid("fanHigh", fan);
  const isDirty =
    toThreshold(temp) !== saved.tempHigh || toThreshold(fan) !== saved.fanHigh;

  const handleSave = async () => {
    if (!isDirty || invalid) return;
    setIsSaving(true);
    setError(null);
    try {
      await saveMiners([
        {
          ...miner,
          alerts: { tempHigh: toThreshold(temp), fanHigh: toThreshold(fan) },
        },
      ]);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, py: 1 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <NotificationsActiveIcon
          fontSize="small"
          sx={{ color: "text.secondary" }}
        />
        <Typography variant="subtitle2" fontWeight={700}>
          {t("settingsPage.configured.alerts.title")}
        </Typography>
      </Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        alignItems={{ xs: "stretch", sm: "flex-start" }}
        sx={{ width: "100%" }}
      >
        <TextField
          size="small"
          fullWidth
          label={t("settingsPage.configured.alerts.tempLabel")}
          placeholder={fromThreshold(defaults.tempHigh)}
          value={temp}
          error={thresholdInvalid("tempHigh", temp)}
          onChange={(e) => setTemp(e.target.value)}
          disabled={readOnly}
          slotProps={{
            htmlInput: { inputMode: "decimal" },
            inputLabel: { shrink: true },
          }}
        />
        <TextField
          size="small"
          fullWidth
          label={t("settingsPage.configured.alerts.fanLabel")}
          placeholder={fromThreshold(defaults.fanHigh)}
          value={fan}
          error={thresholdInvalid("fanHigh", fan)}
          onChange={(e) => setFan(e.target.value)}
          disabled={readOnly}
          slotProps={{
            htmlInput: { inputMode: "decimal" },
            inputLabel: { shrink: true },
          }}
        />
        <Writable readOnly={readOnly}>
          <Button
            variant="contained"
            size="small"
            disabled={!isDirty || invalid || isSaving}
            onClick={() => void handleSave()}
            startIcon={
              isSaving ? (
                <CircularProgress size={14} color="inherit" />
              ) : (
                <SaveIcon fontSize="small" />
              )
            }
            sx={{ flexShrink: 0, height: 40 }}
          >
            {isSaving
              ? t("settingsPage.configured.alias.saving")
              : t("settingsPage.configured.alias.save")}
          </Button>
        </Writable>
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {t("settingsPage.configured.alerts.hint", {
          temp: defaults.tempHigh,
          fan: defaults.fanHigh,
        })}
      </Typography>

      <Writable readOnly={readOnly}>
        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
      </Writable>
    </Box>
  );
};
