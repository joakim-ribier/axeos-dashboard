// src/pages/settings/AlertThresholdsBlock.tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import SaveIcon from "@mui/icons-material/Save";
import { Box, Stack, TextField, Typography } from "@mui/material";

import { ActionButton } from "@/components/ui/ActionButton";
import {
  fromThreshold,
  thresholdInvalid,
  toThreshold,
} from "@/components/ui/thresholdInput";
import { Writable } from "@/components/ui/Writable";

import { type AppSettingsFrameContext } from "./AppSettingsFrame";
import { SectionTitle } from "./SectionTitle";

/** The thresholds every miner follows unless it has its own (Configuration
 * › Miners) -- a field left empty is the built-in value, shown as its
 * placeholder. */
export const AlertThresholdsBlock = ({
  data,
  readOnly,
  isSaving,
  persist,
  serverBasePayload,
}: AppSettingsFrameContext) => {
  const { t } = useTranslation();
  const saved = data?.alerts;
  const builtIn = data?.defaults.alerts;

  const [temp, setTemp] = useState("");
  const [fan, setFan] = useState("");

  useEffect(() => {
    if (!saved) return;
    setTemp(fromThreshold(saved.tempHigh));
    setFan(fromThreshold(saved.fanHigh));
  }, [saved]);

  const invalid =
    thresholdInvalid("tempHigh", temp) || thresholdInvalid("fanHigh", fan);
  const dirty =
    toThreshold(temp) !== (saved?.tempHigh ?? 0) ||
    toThreshold(fan) !== (saved?.fanHigh ?? 0);

  const handleSave = () =>
    persist({
      ...serverBasePayload(),
      alerts: { tempHigh: toThreshold(temp), fanHigh: toThreshold(fan) },
    });

  return (
    <Box>
      <SectionTitle
        icon={<NotificationsActiveIcon fontSize="small" />}
        title={t("settingsPage.appSettings.alerts.title")}
        description={t("settingsPage.appSettings.alerts.description")}
      />
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", sm: "flex-start" }}
      >
        <TextField
          size="small"
          label={t("settingsPage.appSettings.alerts.tempLabel")}
          placeholder={fromThreshold(builtIn?.tempHigh)}
          value={temp}
          error={thresholdInvalid("tempHigh", temp)}
          onChange={(e) => setTemp(e.target.value)}
          disabled={readOnly}
          slotProps={{
            htmlInput: { inputMode: "decimal" },
            inputLabel: { shrink: true },
          }}
          sx={{ flex: 1 }}
        />
        <TextField
          size="small"
          label={t("settingsPage.appSettings.alerts.fanLabel")}
          placeholder={fromThreshold(builtIn?.fanHigh)}
          value={fan}
          error={thresholdInvalid("fanHigh", fan)}
          onChange={(e) => setFan(e.target.value)}
          disabled={readOnly}
          slotProps={{
            htmlInput: { inputMode: "decimal" },
            inputLabel: { shrink: true },
          }}
          sx={{ flex: 1 }}
        />
        <Writable readOnly={readOnly}>
          <ActionButton
            icon={<SaveIcon fontSize="small" />}
            loading={isSaving}
            disabled={invalid || !dirty}
            onClick={() => void handleSave()}
          >
            {isSaving
              ? t("settingsPage.appSettings.saving")
              : t("settingsPage.appSettings.save")}
          </ActionButton>
        </Writable>
      </Stack>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mt: 1 }}
      >
        {t("settingsPage.appSettings.alerts.clearHint")}
      </Typography>
    </Box>
  );
};
