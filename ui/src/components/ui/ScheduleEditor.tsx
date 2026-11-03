// src/components/ui/ScheduleEditor.tsx
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import {
  Alert,
  Box,
  CircularProgress,
  IconButton,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";

import { ActionButton } from "@/components/ui/ActionButton";
import { Row, RowList } from "@/components/ui/RowList";
import { SectionActions, SectionStack } from "@/components/ui/SectionLayout";
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
    <SectionStack>
      {schedule.length === 0 ? (
        <Typography variant="caption" color="text.disabled">
          {t("settingsPage.configured.schedule.empty")}
        </Typography>
      ) : (
        // A list rather than a table: it fits a side panel or a phone --
        // what it does, then when, in words and as typed.
        <RowList>
          {schedule.map((entry, index) => (
            <Row
              key={`${entry.cron}-${entry.action}-${index}`}
              sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
            >
              {entry.action === "restart" ? (
                <RestartAltIcon
                  fontSize="small"
                  sx={{ color: "text.secondary" }}
                />
              ) : (
                <SwapHorizIcon
                  fontSize="small"
                  sx={{ color: "text.secondary" }}
                />
              )}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600}>
                  {t(`settingsPage.configured.schedule.${entry.action}`)}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  component="div"
                >
                  {describeCron(entry.cron, i18n.language) ?? entry.cron}
                  {" · "}
                  <Box component="span" sx={{ fontFamily: "monospace" }}>
                    {entry.cron}
                  </Box>
                </Typography>
              </Box>
              <Writable readOnly={readOnly}>
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
              </Writable>
            </Row>
          ))}
        </RowList>
      )}

      <Writable readOnly={readOnly}>
        {/* One field per line, the button under them -- as in the other
            sections. */}
        <SectionStack>
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          <Box>
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
                    : undefined
              }
              error={cronIsInvalid || cronIsDuplicate}
              value={cron}
              onChange={(e) => setCron(e.target.value)}
              fullWidth
              slotProps={{
                htmlInput: { sx: { fontFamily: "monospace" } },
                inputLabel: { shrink: true },
              }}
            />
            <Typography
              variant="caption"
              color="text.secondary"
              component="div"
              sx={{ mt: 0.75, pl: 0.5 }}
            >
              {t("settingsPage.configured.schedule.cronHelp")}
            </Typography>
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
          </Box>
          <TextField
            size="small"
            select
            label={t("settingsPage.configured.schedule.action")}
            value={action}
            onChange={(e) =>
              setAction(e.target.value as CronSchedule["action"])
            }
            fullWidth
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
          <SectionActions>
            <ActionButton
              icon={<AddIcon fontSize="small" />}
              loading={isAdding}
              disabled={!trimmedCron || cronIsInvalid || cronIsDuplicate}
              onClick={() => void handleAdd()}
            >
              {isAdding
                ? t("settingsPage.configured.schedule.adding")
                : t("settingsPage.configured.schedule.add")}
            </ActionButton>
          </SectionActions>
        </SectionStack>
      </Writable>
    </SectionStack>
  );
};
