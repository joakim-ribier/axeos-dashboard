// src/components/ui/PoolEditor.tsx
import { type ChangeEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import SaveIcon from "@mui/icons-material/Save";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import {
  Alert,
  Box,
  Button,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { ActionButton } from "@/components/ui/ActionButton";
import { AlertList } from "@/components/ui/AlertList";
import {
  SECTION_GAP,
  SectionActions,
  SectionStack,
} from "@/components/ui/SectionLayout";
import { Writable } from "@/components/ui/Writable";
import { type MinerConfig } from "@/schemas/minerConfigSchema";
import { type Miner } from "@/schemas/minerSchema";
import { extractErrorMessage } from "@/utils/apiError";
import { formatTimeOnly } from "@/utils/format";
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
    <SectionStack>
      {/* Only when there's a drift: an empty box would still take its gap. */}
      {mismatches.length > 0 && (
        <AlertList
          severity="warning"
          title={t("settingsPage.configured.pool.driftWarning", {
            value: formatTimeOnly(liveMiner?.timestamp),
          })}
          items={mismatches.map((m) =>
            t("settingsPage.configured.pool.driftItem", {
              field: fieldLabel(m.field),
              configured: m.configured,
              live: m.live,
            }),
          )}
        />
      )}

      <Stack spacing={SECTION_GAP} sx={{ width: "100%" }}>
        <Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mb: 0.75 }}
          >
            {t("settingsPage.configured.pool.primary")}
          </Typography>
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            sx={{ flexWrap: "wrap" }}
          >
            <TextField
              size="small"
              sx={{ flex: "1 1 180px" }}
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
              sx={{ flex: "0 0 110px" }}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              size="small"
              sx={{ flex: "1 1 180px" }}
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
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            sx={{ flexWrap: "wrap" }}
          >
            <TextField
              size="small"
              sx={{ flex: "1 1 180px" }}
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
              sx={{ flex: "0 0 110px" }}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              size="small"
              sx={{ flex: "1 1 180px" }}
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
        <SectionActions>
          <ActionButton
            icon={<SaveIcon fontSize="small" />}
            loading={isSaving}
            disabled={!canSave}
            onClick={() => void handleSave()}
          >
            {isSaving
              ? t("settingsPage.configured.pool.saving")
              : t("settingsPage.configured.pool.save")}
          </ActionButton>
          <Button
            variant="outlined"
            size="small"
            startIcon={<SwapVertIcon fontSize="small" />}
            onClick={handleSwap}
            sx={{ height: 40, flexShrink: 0 }}
          >
            {t("settingsPage.configured.pool.swap")}
          </Button>
          {isDirty && (
            <Button size="small" disabled={isSaving} onClick={handleReset}>
              {t("settingsPage.configured.pool.reset")}
            </Button>
          )}
        </SectionActions>
      </Writable>
    </SectionStack>
  );
};
