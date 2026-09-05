// src/components/ui/PoolEditor.tsx
import { type ChangeEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import BoltIcon from "@mui/icons-material/Bolt";
import SaveIcon from "@mui/icons-material/Save";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import { AlertList } from "@/components/ui/AlertList";
import { Writable } from "@/components/ui/Writable";
import { type MinerConfig } from "@/schemas/minerConfigSchema";
import { type Miner } from "@/schemas/minerSchema";
import { extractErrorMessage } from "@/utils/apiError";
import { poolFieldLabel, poolMismatches } from "@/utils/poolDrift";

interface PoolEditorProps {
  miner: MinerConfig;
  saveMiners: (miners: MinerConfig[]) => Promise<MinerConfig[]>;
  readOnly?: boolean;
  /** The same miner's live dashboard data (GET /api/miners), used only to
   * flag drift between the saved config and what the device itself is
   * currently reporting -- see poolMismatches. Undefined when the miner
   * has no live data yet (never polled), in which case no warning shows. */
  liveMiner?: Miner;
}

interface PoolFormState {
  url: string;
  port: string;
  user: string;
  fallbackUrl: string;
  fallbackPort: string;
  fallbackUser: string;
}

const toFormState = (miner: MinerConfig): PoolFormState => ({
  url: miner.url,
  port: miner.port ? String(miner.port) : "",
  user: miner.user,
  fallbackUrl: miner.fallbackUrl,
  fallbackPort: miner.fallbackPort ? String(miner.fallbackPort) : "",
  fallbackUser: miner.fallbackUser,
});

const isValidPort = (port: string): boolean => {
  const n = Number(port);
  return Number.isInteger(n) && n >= 1 && n <= 65535;
};

/** Per-miner pool config editor: the URL/port/user this miner's primary and
 * fallback pool are configured with in the managed miners file -- what the
 * scheduler (switch_primary/switch_fallback jobs, see internal/scheduler)
 * and the manual pool-switch buttons on the dashboard actually send to the
 * device the next time either runs. Editing here never talks to the device
 * itself, same distinction as the schedule editor right below it: this is
 * config, not a live action. Saves the whole miner entry via saveMiners
 * (POST /api/config/miners upserts by MAC), same pattern as ScheduleEditor.
 */
export const PoolEditor = ({
  miner,
  saveMiners,
  readOnly = false,
  liveMiner,
}: PoolEditorProps) => {
  const { t } = useTranslation();
  const saved = toFormState(miner);

  const mismatches = poolMismatches(miner, liveMiner);
  const fieldLabel = (field: (typeof mismatches)[number]["field"]) =>
    poolFieldLabel(t, field);

  const [form, setForm] = useState<PoolFormState>(saved);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty = (Object.keys(saved) as (keyof PoolFormState)[]).some(
    (key) => form[key] !== saved[key],
  );

  const urlIsInvalid = form.url.trim().length === 0;
  const portIsInvalid = !isValidPort(form.port);
  const fallbackHasValue =
    form.fallbackUrl.trim().length > 0 || form.fallbackPort.trim().length > 0;
  const fallbackPortIsInvalid =
    fallbackHasValue && !isValidPort(form.fallbackPort);
  const fallbackUrlIsInvalid =
    form.fallbackPort.trim().length > 0 && form.fallbackUrl.trim().length === 0;

  const canSave =
    isDirty &&
    !urlIsInvalid &&
    !portIsInvalid &&
    !fallbackPortIsInvalid &&
    !fallbackUrlIsInvalid;

  const handleChange =
    (key: keyof PoolFormState) => (e: ChangeEvent<HTMLInputElement>) => {
      setForm((current) => ({ ...current, [key]: e.target.value }));
    };

  const handleReset = () => setForm(saved);

  const handleSwap = () => {
    setForm((current) => ({
      url: current.fallbackUrl,
      port: current.fallbackPort,
      user: current.fallbackUser,
      fallbackUrl: current.url,
      fallbackPort: current.port,
      fallbackUser: current.user,
    }));
  };

  const handleSave = async () => {
    if (!canSave) return;
    setIsSaving(true);
    setError(null);
    try {
      await saveMiners([
        {
          ...miner,
          url: form.url.trim(),
          port: Number(form.port),
          user: form.user.trim(),
          fallbackUrl: form.fallbackUrl.trim(),
          fallbackPort: form.fallbackUrl.trim() ? Number(form.fallbackPort) : 0,
          fallbackUser: form.fallbackUser.trim(),
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
        <BoltIcon fontSize="small" sx={{ color: "text.secondary" }} />
        <Typography variant="subtitle2" fontWeight={700}>
          {t("settingsPage.configured.pool.title")}
        </Typography>
      </Box>

      <Box sx={{ width: "100%" }}>
        <AlertList
          severity="warning"
          title={t("settingsPage.configured.pool.driftWarning")}
          items={mismatches.map((m) =>
            t("settingsPage.configured.pool.driftItem", {
              field: fieldLabel(m.field),
              configured: m.configured,
              live: m.live,
            }),
          )}
        />
      </Box>

      <Stack spacing={2} sx={{ width: "100%" }}>
        <Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mb: 0.75 }}
          >
            {t("settingsPage.configured.pool.primary")}
          </Typography>
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              fullWidth
              label={t("settingsPage.configured.pool.urlLabel")}
              placeholder={t("settingsPage.configured.pool.urlPlaceholder")}
              value={form.url}
              onChange={handleChange("url")}
              error={urlIsInvalid}
              helperText={
                urlIsInvalid
                  ? t("settingsPage.configured.pool.urlRequired")
                  : undefined
              }
              disabled={readOnly}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              size="small"
              label={t("settingsPage.configured.pool.portLabel")}
              value={form.port}
              onChange={handleChange("port")}
              error={portIsInvalid}
              helperText={
                portIsInvalid
                  ? t("settingsPage.configured.pool.invalidPort")
                  : undefined
              }
              disabled={readOnly}
              sx={{ minWidth: { xs: 90, sm: 130 } }}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              size="small"
              fullWidth
              label={t("settingsPage.configured.pool.userLabel")}
              placeholder={t("settingsPage.configured.pool.userPlaceholder")}
              value={form.user}
              onChange={handleChange("user")}
              disabled={readOnly}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Stack>
        </Box>

        <Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mb: 0.75 }}
          >
            {t("settingsPage.configured.pool.fallback")}
          </Typography>
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              fullWidth
              label={t("settingsPage.configured.pool.urlLabel")}
              placeholder={t("settingsPage.configured.pool.urlPlaceholder")}
              value={form.fallbackUrl}
              onChange={handleChange("fallbackUrl")}
              error={fallbackUrlIsInvalid}
              disabled={readOnly}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              size="small"
              label={t("settingsPage.configured.pool.portLabel")}
              value={form.fallbackPort}
              onChange={handleChange("fallbackPort")}
              error={fallbackPortIsInvalid}
              helperText={
                fallbackPortIsInvalid
                  ? t("settingsPage.configured.pool.invalidPort")
                  : undefined
              }
              disabled={readOnly}
              sx={{ minWidth: { xs: 90, sm: 130 } }}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              size="small"
              fullWidth
              label={t("settingsPage.configured.pool.userLabel")}
              placeholder={t("settingsPage.configured.pool.userPlaceholder")}
              value={form.fallbackUser}
              onChange={handleChange("fallbackUser")}
              disabled={readOnly}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Stack>
        </Box>
      </Stack>

      <Writable readOnly={readOnly}>
        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Tooltip title={t("settingsPage.configured.pool.swapTooltip")}>
            <IconButton
              size="small"
              onClick={handleSwap}
              aria-label={t("settingsPage.configured.pool.swap")}
            >
              <SwapVertIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            size="small"
            disabled={!canSave || isSaving}
            onClick={() => void handleSave()}
            startIcon={
              isSaving ? (
                <CircularProgress size={14} color="inherit" />
              ) : (
                <SaveIcon fontSize="small" />
              )
            }
          >
            {isSaving
              ? t("settingsPage.configured.pool.saving")
              : t("settingsPage.configured.pool.save")}
          </Button>
          {isDirty && (
            <Button size="small" disabled={isSaving} onClick={handleReset}>
              {t("settingsPage.configured.pool.reset")}
            </Button>
          )}
        </Stack>
      </Writable>
    </Box>
  );
};
