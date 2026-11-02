// src/components/ui/AlertThresholdsEditor.tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import { Alert, Box, Typography } from "@mui/material";

import { AlertThresholdsForm } from "@/components/ui/AlertThresholdsForm";
import { Writable } from "@/components/ui/Writable";
import { type AlertSettings } from "@/schemas/appSettingsSchema";
import { type MinerConfig } from "@/schemas/minerConfigSchema";
import { type Miner } from "@/schemas/minerSchema";
import { extractErrorMessage } from "@/utils/apiError";

interface AlertThresholdsEditorProps {
  miner: MinerConfig;
  /** Every miner's thresholds and margins -- an empty field's value, and
   * where its alert ends. */
  common: AlertSettings;
  /** Its latest reading, marked on each gauge. */
  liveMiner?: Miner;
  saveMiners: (miners: MinerConfig[]) => Promise<MinerConfig[]>;
  readOnly?: boolean;
}

/** This miner's own alert thresholds -- a field left empty follows every
 * miner's (Configuration › System). Persists via saveMiners, same pattern
 * as AliasEditor. */
export const AlertThresholdsEditor = ({
  miner,
  common,
  liveMiner,
  saveMiners,
  readOnly = false,
}: AlertThresholdsEditorProps) => {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const own = miner.alerts ?? { tempHigh: 0, fanHigh: 0 };

  const handleSave = async ({ tempHigh, fanHigh }: AlertSettings) => {
    setError(null);
    try {
      await saveMiners([{ ...miner, alerts: { tempHigh, fanHigh } }]);
    } catch (err) {
      setError(extractErrorMessage(err));
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
          {t("alertThresholds.title")}
        </Typography>
      </Box>
      <AlertThresholdsForm
        saved={{
          ...own,
          tempMargin: common.tempMargin,
          fanMargin: common.fanMargin,
        }}
        placeholders={common}
        current={liveMiner && { temp: liveMiner.temp, fan: liveMiner.fanspeed }}
        readOnly={readOnly}
        onSave={handleSave}
      />
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
