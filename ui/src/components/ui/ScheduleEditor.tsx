// src/components/ui/ScheduleEditor.tsx
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
  Paper,
  Stack,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";

import { DataTable } from "@/components/ui/DataTable";
import { Writable } from "@/components/ui/Writable";
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

interface ScheduleEditorProps {
  miner: MinerConfig;
  saveMiners: (miners: MinerConfig[]) => Promise<MinerConfig[]>;
  readOnly?: boolean;
}

/** Per-miner scheduler editor: shows the currently saved schedule entries
 * (each a cron expression plus the action it runs -- switch to a pool, or
 * restart) and a small form to add another one. Every add/remove persists
 * immediately via saveMiners (POST /api/config/miners upserts by MAC),
 * same pattern as the enable/disable toggle in ConfiguredMinersTable. */
export const ScheduleEditor = ({
  miner,
  saveMiners,
  readOnly = false,
}: ScheduleEditorProps) => {
  const { t, i18n } = useTranslation();
  const schedule = miner.schedule ?? [];

  const [cron, setCron] = useState("");
  const [action, setAction] = useState<CronSchedule["action"]>("restart");
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
      await saveMiners([{ ...miner, schedule: updated }]);
    } catch (err) {
      setError(extractErrorMessage(err));
      throw err;
    }
  };

  const handleAdd = async () => {
    if (!trimmedCron || cronIsInvalid || cronIsDuplicate) return;
    setIsAdding(true);
    try {
      await persist([...schedule, { cron: trimmedCron, action }]);
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
      <Writable readOnly={readOnly}>
        <Typography variant="body2" color="text.secondary">
          {t("settingsPage.configured.schedule.description")}
        </Typography>
      </Writable>

      {schedule.length === 0 ? (
        <Typography variant="caption" color="text.disabled">
          {t("settingsPage.configured.schedule.empty")}
        </Typography>
      ) : (
        <DataTable>
          <TableHead>
            <TableRow>
              <TableCell>
                {t("settingsPage.configured.schedule.action")}
              </TableCell>
              <TableCell>
                {t("settingsPage.configured.schedule.readableLabel")}
              </TableCell>
              <TableCell>
                {t("settingsPage.configured.schedule.cronLabel")}
              </TableCell>
              <Writable readOnly={readOnly}>
                <TableCell align="right" sx={{ width: 40 }} />
              </Writable>
            </TableRow>
          </TableHead>
          <TableBody>
            {schedule.map((entry, index) => (
              <TableRow hover key={`${entry.cron}-${entry.action}-${index}`}>
                <TableCell>
                  <Chip
                    size="small"
                    variant="outlined"
                    label={t(
                      `settingsPage.configured.schedule.${entry.action}`,
                    )}
                    sx={{
                      height: 24,
                      fontSize: "0.8rem",
                      borderRadius: 1,
                    }}
                  />
                </TableCell>
                <TableCell>
                  {describeCron(entry.cron, i18n.language) ?? entry.cron}
                </TableCell>
                <TableCell sx={{ fontFamily: "monospace" }}>
                  {entry.cron}
                </TableCell>
                <Writable readOnly={readOnly}>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      disabled={removingIndex === index}
                      onClick={() => void handleRemove(index)}
                      aria-label={t(
                        "settingsPage.configured.schedule.removing",
                      )}
                    >
                      {removingIndex === index ? (
                        <CircularProgress size={16} />
                      ) : (
                        <DeleteOutlineIcon fontSize="small" />
                      )}
                    </IconButton>
                  </TableCell>
                </Writable>
              </TableRow>
            ))}
          </TableBody>
        </DataTable>
      )}

      <Writable readOnly={readOnly}>
        <Paper
          variant="outlined"
          sx={{ px: 0, py: 1.5, borderRadius: 2, border: "none" }}
        >
          {error && (
            <Alert
              severity="error"
              onClose={() => setError(null)}
              sx={{ mb: 1.5 }}
            >
              {error}
            </Alert>
          )}
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <TextField
              size="small"
              label={t("settingsPage.configured.schedule.cronLabel")}
              placeholder={t(
                "settingsPage.configured.schedule.cronPlaceholder",
              )}
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
              sx={{
                fontFamily: "monospace",
                minWidth: { xs: 120, sm: 240 },
                flexGrow: 1,
              }}
              slotProps={{
                htmlInput: { sx: { fontFamily: "monospace" } },
                inputLabel: { shrink: true },
              }}
            />
            <TextField
              size="small"
              select
              label={t("settingsPage.configured.schedule.action")}
              value={action}
              onChange={(e) =>
                setAction(e.target.value as CronSchedule["action"])
              }
              sx={{ minWidth: { xs: 96, sm: 170 } }}
            >
              <MenuItem value="switch_primary">
                {t("settingsPage.configured.schedule.switch_primary")}
              </MenuItem>
              <MenuItem value="switch_fallback">
                {t("settingsPage.configured.schedule.switch_fallback")}
              </MenuItem>
              <MenuItem value="restart">
                {t("settingsPage.configured.schedule.restart")}
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
              <Typography
                variant="caption"
                color="text.secondary"
                component="div"
              >
                {description}
              </Typography>
              {upcoming && upcoming.length > 0 && (
                <Typography
                  variant="caption"
                  color="text.disabled"
                  component="div"
                >
                  {t("settingsPage.configured.schedule.nextRuns", {
                    dates: upcoming
                      .map((d) => formatTimestamp(d.toISOString()))
                      .join(" · "),
                  })}
                </Typography>
              )}
            </Box>
          )}
        </Paper>
      </Writable>
    </Box>
  );
};
