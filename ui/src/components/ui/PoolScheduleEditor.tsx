// src/components/ui/PoolScheduleEditor.tsx
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ScheduleIcon from "@mui/icons-material/Schedule";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import {
  type CronSchedule,
  type MinerConfig,
} from "@/schemas/minerConfigSchema";
import { extractErrorMessage } from "@/utils/apiError";
import {
  describeCron,
  nextCronRuns,
  normalizeCronExpression,
} from "@/utils/cron";
import { formatTimestamp } from "@/utils/format";

interface PoolScheduleEditorProps {
  miner: MinerConfig;
  saveMiners: (miners: MinerConfig[]) => Promise<MinerConfig[]>;
}

/** Per-miner pool scheduler editor: shows the currently saved poolSchedule
 * entries and a small form to add another one. Every add/remove persists
 * immediately via saveMiners (POST /api/config/miners upserts by MAC),
 * same pattern as the enable/disable toggle in ConfiguredMinersTable. */
export const PoolScheduleEditor = ({
  miner,
  saveMiners,
}: PoolScheduleEditorProps) => {
  const { t, i18n } = useTranslation();
  const schedule = miner.poolSchedule ?? [];

  const [cron, setCron] = useState("");
  const [target, setTarget] = useState<CronSchedule["target"]>("fallback");
  const [isAdding, setIsAdding] = useState(false);
  const [removingIndex, setRemovingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trimmedCron = cron.trim();
  const description = useMemo(
    () => describeCron(trimmedCron, i18n.language),
    [trimmedCron, i18n.language],
  );
  const upcoming = useMemo(() => nextCronRuns(trimmedCron, 3), [trimmedCron]);
  const cronIsInvalid = trimmedCron.length > 0 && description === null;
  const cronIsDuplicate =
    trimmedCron.length > 0 &&
    !cronIsInvalid &&
    schedule.some(
      (s) =>
        normalizeCronExpression(s.cron) ===
        normalizeCronExpression(trimmedCron),
    );

  const persist = async (updated: CronSchedule[]) => {
    setError(null);
    try {
      await saveMiners([{ ...miner, poolSchedule: updated }]);
    } catch (err) {
      setError(extractErrorMessage(err));
      throw err;
    }
  };

  const handleAdd = async () => {
    if (!trimmedCron || cronIsInvalid || cronIsDuplicate) return;
    setIsAdding(true);
    try {
      await persist([...schedule, { cron: trimmedCron, target }]);
      setCron("");
    } catch {
      // error already surfaced via `error` below
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (index: number) => {
    setRemovingIndex(index);
    try {
      await persist(schedule.filter((_, i) => i !== index));
    } catch {
      // error already surfaced via `error` below
    } finally {
      setRemovingIndex(null);
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, py: 1 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <ScheduleIcon fontSize="small" sx={{ color: "text.secondary" }} />
        <Typography variant="subtitle2" fontWeight={700}>
          {t("settingsPage.configured.schedule.title")}
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary">
        {t("settingsPage.configured.schedule.description")}
      </Typography>

      {schedule.length === 0 ? (
        <Typography variant="caption" color="text.disabled">
          {t("settingsPage.configured.schedule.empty")}
        </Typography>
      ) : (
        <Stack spacing={1}>
          {schedule.map((entry, index) => (
            <Box
              key={`${entry.cron}-${entry.target}-${index}`}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                flexWrap: "wrap",
              }}
            >
              <Typography
                variant="body2"
                sx={{ fontFamily: "monospace" }}
                color="text.secondary"
              >
                {entry.cron}
              </Typography>
              <Chip
                size="small"
                variant="outlined"
                label={t(`settingsPage.configured.schedule.${entry.target}`)}
              />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ flexGrow: 1 }}
              >
                {describeCron(entry.cron, i18n.language) ?? entry.cron}
              </Typography>
              <IconButton
                size="small"
                disabled={removingIndex === index}
                onClick={() => void handleRemove(index)}
                aria-label={t("settingsPage.configured.schedule.removing")}
              >
                {removingIndex === index ? (
                  <CircularProgress size={16} />
                ) : (
                  <DeleteOutlineIcon fontSize="small" />
                )}
              </IconButton>
            </Box>
          ))}
        </Stack>
      )}

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        alignItems="flex-start"
      >
        <TextField
          size="small"
          label={t("settingsPage.configured.schedule.cronLabel")}
          placeholder={t("settingsPage.configured.schedule.cronPlaceholder")}
          helperText={
            cronIsInvalid
              ? t("settingsPage.configured.schedule.invalidCron")
              : cronIsDuplicate
                ? t("settingsPage.configured.schedule.duplicateCron")
                : t("settingsPage.configured.schedule.cronHelp")
          }
          error={cronIsInvalid || cronIsDuplicate}
          value={cron}
          onChange={(e) => setCron(e.target.value)}
          sx={{ fontFamily: "monospace", minWidth: 240 }}
          slotProps={{
            htmlInput: { sx: { fontFamily: "monospace" } },
            inputLabel: { shrink: true },
          }}
        />
        <TextField
          size="small"
          select
          label={t("settingsPage.configured.schedule.target")}
          value={target}
          onChange={(e) => setTarget(e.target.value as CronSchedule["target"])}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="primary">
            {t("settingsPage.configured.schedule.primary")}
          </MenuItem>
          <MenuItem value="fallback">
            {t("settingsPage.configured.schedule.fallback")}
          </MenuItem>
        </TextField>
        <Button
          variant="outlined"
          size="small"
          disabled={
            !trimmedCron || cronIsInvalid || cronIsDuplicate || isAdding
          }
          onClick={() => void handleAdd()}
          startIcon={
            isAdding ? (
              <CircularProgress size={14} color="inherit" />
            ) : (
              <AddIcon fontSize="small" />
            )
          }
          sx={{ flexShrink: 0, height: 40 }}
        >
          {isAdding
            ? t("settingsPage.configured.schedule.adding")
            : t("settingsPage.configured.schedule.add")}
        </Button>
      </Stack>

      {trimmedCron && !cronIsInvalid && (
        <Box sx={{ pl: 0.5 }}>
          <Typography variant="caption" color="text.secondary" component="div">
            {description}
          </Typography>
          {upcoming && upcoming.length > 0 && (
            <Typography variant="caption" color="text.disabled" component="div">
              {t("settingsPage.configured.schedule.nextRuns", {
                dates: upcoming
                  .map((d) => formatTimestamp(d.toISOString()))
                  .join(" · "),
              })}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
};
