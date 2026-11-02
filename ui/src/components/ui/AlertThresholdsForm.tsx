// src/components/ui/AlertThresholdsForm.tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import SaveIcon from "@mui/icons-material/Save";
import { Box, Stack, TextField, Typography } from "@mui/material";

import { ThresholdBar } from "@/components/dashboard/miners/MetricBar";
import { ActionButton } from "@/components/ui/ActionButton";
import {
  fromThreshold,
  thresholdInvalid,
  toThreshold,
} from "@/components/ui/thresholdInput";
import { Writable } from "@/components/ui/Writable";
import { type AlertSettings } from "@/schemas/appSettingsSchema";

type Key = keyof AlertSettings;

// Each measure: its threshold, its margin, its gauge's scale -- the same as
// the miners' gauges (see MetricBar).
const MEASURES = [
  {
    threshold: "tempHigh",
    margin: "tempMargin",
    current: "temp",
    unit: "°C",
    max: (threshold: number) => Math.max(80, threshold + 10),
  },
  {
    threshold: "fanHigh",
    margin: "fanMargin",
    current: "fan",
    unit: "%",
    max: () => 100,
  },
] as const;

const KEYS: Key[] = ["tempHigh", "tempMargin", "fanHigh", "fanMargin"];

const toFields = (values: AlertSettings) =>
  Object.fromEntries(
    KEYS.map((key) => [key, fromThreshold(values[key])]),
  ) as Record<Key, string>;

interface AlertThresholdsFormProps {
  /** The saved values, 0 for unset. */
  saved: AlertSettings;
  /** What an empty field stands for, shown as its placeholder. */
  placeholders: AlertSettings;
  /** The margins as fields too -- otherwise the saved ones only draw the
   * gauges. */
  withMargins?: boolean;
  /** A miner's latest readings, marked on the gauges. */
  current?: { temp?: number; fan?: number };
  onSave: (values: AlertSettings) => Promise<unknown>;
  readOnly?: boolean;
}

/** Alert thresholds, wherever they're set: a field per threshold (and
 * margin), each measure's gauge under it -- where its alert starts, where
 * it ends, where the miner is now. */
export const AlertThresholdsForm = ({
  saved,
  placeholders,
  withMargins = false,
  current,
  onSave,
  readOnly = false,
}: AlertThresholdsFormProps) => {
  const { t } = useTranslation();
  const [fields, setFields] = useState(() => toFields(saved));
  const [isSaving, setIsSaving] = useState(false);

  const { tempHigh, tempMargin, fanHigh, fanMargin } = saved;
  useEffect(() => {
    setFields(toFields({ tempHigh, tempMargin, fanHigh, fanMargin }));
  }, [tempHigh, tempMargin, fanHigh, fanMargin]);

  const invalid = KEYS.some((key) => thresholdInvalid(key, fields[key]));
  const dirty = KEYS.some((key) => toThreshold(fields[key]) !== saved[key]);
  // What a field means right now: its value, else what an empty one is.
  const effective = (key: Key) =>
    (thresholdInvalid(key, fields[key])
      ? saved[key]
      : toThreshold(fields[key])) || placeholders[key];

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(
        Object.fromEntries(
          KEYS.map((key) => [key, toThreshold(fields[key])]),
        ) as AlertSettings,
      );
    } finally {
      setIsSaving(false);
    }
  };

  const field = (key: Key) => (
    <TextField
      size="small"
      label={t(`alertThresholds.${key}`)}
      placeholder={fromThreshold(placeholders[key])}
      value={fields[key]}
      error={thresholdInvalid(key, fields[key])}
      onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
      disabled={readOnly}
      slotProps={{
        htmlInput: { inputMode: "decimal" },
        inputLabel: { shrink: true },
      }}
      sx={{ flex: 1, minWidth: 0 }}
    />
  );

  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      spacing={3}
      alignItems={{ xs: "stretch", md: "flex-start" }}
    >
      {MEASURES.map((m) => {
        const threshold = effective(m.threshold);
        const clear = Math.max(0, threshold - effective(m.margin));
        const value = current?.[m.current];
        return (
          <Box key={m.threshold} sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: "flex", gap: 1.5 }}>
              {field(m.threshold)}
              {withMargins && field(m.margin)}
            </Box>
            <Box sx={{ mt: 1.5 }}>
              <ThresholdBar
                value={value}
                threshold={threshold}
                clearBelow={clear}
                max={m.max(threshold)}
              />
            </Box>
            {/* Side by side, or one under the other in a narrow column --
                never cut inside one. */}
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                columnGap: 1.5,
                mt: 0.75,
                whiteSpace: "nowrap",
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {t("alertThresholds.backToNormal", {
                  value: `${clear} ${m.unit}`,
                })}
              </Typography>
              {value !== undefined && (
                <Typography variant="caption" color="text.secondary">
                  {t("alertThresholds.now", {
                    value: `${value.toFixed(0)} ${m.unit}`,
                  })}
                </Typography>
              )}
            </Box>
          </Box>
        );
      })}
      <Writable readOnly={readOnly}>
        <ActionButton
          icon={<SaveIcon fontSize="small" />}
          loading={isSaving}
          disabled={invalid || !dirty}
          onClick={() => void handleSave()}
        >
          {isSaving ? t("alertThresholds.saving") : t("alertThresholds.save")}
        </ActionButton>
      </Writable>
    </Stack>
  );
};
