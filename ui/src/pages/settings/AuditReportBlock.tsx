// src/pages/settings/AuditReportBlock.tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import SaveIcon from "@mui/icons-material/Save";
import SummarizeIcon from "@mui/icons-material/Summarize";
import {
  Autocomplete,
  Box,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";

import { ActionButton } from "@/components/ui/ActionButton";
import { useAuditTypes } from "@/hooks/useAudit";
import { type ReportFrequency } from "@/schemas/appSettingsSchema";
import { formatTimestamp } from "@/utils/format";

import { type AppSettingsFrameContext } from "./AppSettingsFrame";
import { SectionTitle } from "./SectionTitle";

// The browser's own zone: the operator's, whatever the Pi or its container
// thinks local time is.
// A "2006-01-02" day, shown in the browser's own way -- noon, so no time
// zone can tip it onto the day before.
const showDay = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString();

// The period a report covered: its first day, or first to last (To is
// excluded, so its last day is the one before).
const periodLabel = (from: string, to: string) => {
  const last = new Date(`${to}T12:00:00`);
  last.setDate(last.getDate() - 1);
  const lastDay = last.toISOString().slice(0, 10);
  return from === lastDay
    ? showDay(from)
    : `${showDay(from)} – ${showDay(lastDay)}`;
};

const FREQUENCIES: ReportFrequency[] = [
  "daily",
  "every2days",
  "weekly",
  "monthly",
];

/** The mail summing up the audit since the previous one (see
 * auditreport) -- UTC days, like the audit's own. */
export const AuditReportBlock = ({
  data,
  isSaving,
  persist,
  serverBasePayload,
}: AppSettingsFrameContext) => {
  const { t } = useTranslation();
  const { data: auditTypes = [] } = useAuditTypes();
  const saved = data?.notifications.auditReport;
  const status = data?.readOnly.auditReport;

  const [enabled, setEnabled] = useState(false);
  const [frequency, setFrequency] = useState<ReportFrequency>("daily");
  const [types, setTypes] = useState<string[]>([]);
  const [skipIfEmpty, setSkipIfEmpty] = useState(false);

  useEffect(() => {
    if (!saved) return;
    setEnabled(saved.enabled);
    setFrequency(saved.frequency || "daily");
    setTypes(saved.types);
    setSkipIfEmpty(saved.skipIfEmpty);
  }, [saved]);

  const handleSave = () => {
    const base = serverBasePayload();
    return persist({
      ...base,
      notifications: {
        ...base.notifications,
        auditReport: { enabled, frequency, types, skipIfEmpty },
      },
    });
  };

  const typeLabel = (type: string) => t(`auditPage.types.${type}`);

  return (
    <Box>
      <SectionTitle
        icon={<SummarizeIcon fontSize="small" />}
        title={t("settingsPage.appSettings.mail.report.title")}
        description={t("settingsPage.appSettings.mail.report.description")}
      />
      <Stack spacing={2}>
        <FormControlLabel
          control={
            <Switch
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
          }
          label={t("settingsPage.appSettings.mail.report.enabledLabel")}
        />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            select
            size="small"
            label={t("settingsPage.appSettings.mail.report.frequencyLabel")}
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as ReportFrequency)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: { sm: 320 }, flexShrink: 0 }}
          >
            {FREQUENCIES.map((f) => (
              <MenuItem key={f} value={f}>
                {t(`settingsPage.appSettings.mail.report.frequencies.${f}`)}
              </MenuItem>
            ))}
          </TextField>
          <Autocomplete
            multiple
            size="small"
            options={auditTypes}
            value={types}
            onChange={(_, value) => setTypes(value)}
            getOptionLabel={typeLabel}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t("settingsPage.appSettings.mail.report.typesLabel")}
                placeholder={
                  types.length === 0
                    ? t("settingsPage.appSettings.mail.report.allTypes")
                    : undefined
                }
                InputLabelProps={{ ...params.InputLabelProps, shrink: true }}
              />
            )}
            sx={{ flexGrow: 1 }}
          />
        </Stack>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems={{ xs: "stretch", sm: "center" }}
        >
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={skipIfEmpty}
                onChange={(e) => setSkipIfEmpty(e.target.checked)}
              />
            }
            label={
              <Typography variant="body2" color="text.secondary">
                {t("settingsPage.appSettings.mail.report.skipIfEmptyLabel")}
              </Typography>
            }
            sx={{ flexGrow: 1, mr: 0 }}
          />
          <ActionButton
            icon={<SaveIcon fontSize="small" />}
            loading={isSaving}
            onClick={() => void handleSave()}
          >
            {isSaving
              ? t("settingsPage.appSettings.saving")
              : t("settingsPage.appSettings.save")}
          </ActionButton>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {t("settingsPage.appSettings.mail.report.utc")}
        </Typography>
        {status?.lastError ? (
          <Typography variant="caption" color="warning.main">
            {t("settingsPage.appSettings.mail.report.lastFailed", {
              date: status.lastAttemptAt
                ? formatTimestamp(status.lastAttemptAt)
                : "?",
              error: status.lastError,
            })}
          </Typography>
        ) : status?.lastSentAt && status.lastFrom && status.lastTo ? (
          <Typography variant="caption" color="success.main">
            {t("settingsPage.appSettings.mail.report.lastSent", {
              period: periodLabel(status.lastFrom, status.lastTo),
              date: formatTimestamp(status.lastSentAt),
            })}
          </Typography>
        ) : (
          saved?.enabled && (
            <Typography variant="caption" color="text.disabled">
              {t("settingsPage.appSettings.mail.report.neverSent")}
            </Typography>
          )
        )}
      </Stack>
    </Box>
  );
};
