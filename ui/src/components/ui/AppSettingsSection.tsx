// src/components/ui/AppSettingsSection.tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import BoltIcon from "@mui/icons-material/Bolt";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import MemoryIcon from "@mui/icons-material/Memory";
import MonitorHeartIcon from "@mui/icons-material/MonitorHeart";
import SaveIcon from "@mui/icons-material/Save";
import SystemUpdateAltIcon from "@mui/icons-material/SystemUpdateAlt";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Paper,
  Skeleton,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";

import { Writable } from "@/components/ui/Writable";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useMiners } from "@/hooks/useMiners";
import { type AppSettingsInput } from "@/schemas/appSettingsSchema";
import { formatTimestamp, parseGoDuration } from "@/utils/format";

interface PoolDashboardRow {
  host: string;
  url: string;
}

/**
 * Editable subset of settings.yml (electricity rate, custom pool
 * dashboard links, remote push credentials) plus two read-only displays:
 * the built-in firmware repos (never editable from this UI, see
 * server/internal/config/defaults.go) and a handful of process-launch
 * settings. No global Save button: each section persists itself as soon
 * as the operator acts on it (electricity/remote have their own Save
 * button, a pool is saved the moment it's added or removed) -- POST
 * /api/config/settings still always replaces the managed file wholesale
 * (no partial-field updates server-side), so every save here builds the
 * full payload from whatever's currently in every section's local state,
 * not just the section that triggered it.
 */
/** Latest of a list of possibly-missing ISO timestamps, or undefined if none. */
const latestTimestamp = (values: (string | undefined)[]): string | undefined =>
  values.reduce<string | undefined>((latest, v) => {
    if (!v) return latest;
    if (!latest || new Date(v).getTime() > new Date(latest).getTime()) {
      return v;
    }
    return latest;
  }, undefined);

export const AppSettingsSection = ({
  readOnly = false,
}: {
  readOnly?: boolean;
}) => {
  const { t } = useTranslation();
  const { data, isLoading, saveSettings, isSaving, saveError } =
    useAppSettings();
  // Only used to derive an at-a-glance "is the feeder/health-check loop
  // actually running" indicator below, from data the dashboard already
  // fetches -- no dedicated backend endpoint for this exists (feeder is a
  // separate OS process with no last-run state of its own, and the
  // health-check watcher only tracks a per-miner timestamp, not a global
  // one). Enabled miners only (useMiners already filters to those), same
  // reasoning as everywhere else this data is read.
  const { data: miners } = useMiners();
  // Captured in an effect rather than read directly during render (Date.now()
  // is impure) -- refreshed whenever miners data changes, which is this
  // component's natural refresh cadence for the "last run" indicators below.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
  }, [miners]);

  const [electricityRate, setElectricityRate] = useState("");
  const [poolDashboards, setPoolDashboards] = useState<PoolDashboardRow[]>([]);
  const [newPoolHost, setNewPoolHost] = useState("");
  const [newPoolUrl, setNewPoolUrl] = useState("");
  const [pushURL, setPushURL] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  // Seeds the local draft from the fetched settings -- only when data
  // itself changes (a fresh load, or right after a save resolves), never
  // on every render, so it doesn't stomp on what the operator is mid-typing.
  useEffect(() => {
    if (!data) return;
    setElectricityRate(String(data.electricity.ratePerKwh));
    setPoolDashboards(
      Object.entries(data.pools.dashboards).map(([host, url]) => ({
        host,
        url,
      })),
    );
    setPushURL(data.remote.pushURL);
    setApiKey(data.remote.apiKey);
  }, [data]);

  // Base payload from the server's last confirmed state (`data`, not the
  // local form state) -- so a section's own save never carries along an
  // unconfirmed, possibly-invalid edit sitting in another section's input
  // (e.g. a malformed Remote URL the operator hasn't hit Save on yet no
  // longer blocks adding a pool: it's simply never sent). Each handler
  // below overrides only the one section it's actually persisting.
  const serverBasePayload = (): AppSettingsInput => ({
    electricity: data?.electricity ?? { ratePerKwh: 0 },
    pools: data?.pools ?? { dashboards: {} },
    remote: data?.remote ?? { pushURL: "", apiKey: "" },
    // Firmware repos are built-in and not editable from this UI (see the
    // read-only table below) -- never send an override.
    firmware: { repos: {} },
  });

  const persist = async (payload: AppSettingsInput) => {
    try {
      await saveSettings(payload);
      setSnackbarMessage(t("settingsPage.appSettings.saveSuccess"));
    } catch {
      // saveError from useAppSettings already surfaces the message.
    }
  };

  const handleSaveElectricity = () =>
    persist({
      ...serverBasePayload(),
      electricity: { ratePerKwh: Number(electricityRate) || 0 },
    });

  const handleSaveRemote = () =>
    persist({
      ...serverBasePayload(),
      remote: { pushURL: pushURL.trim(), apiKey: apiKey.trim() },
    });

  const handleAddPoolDashboard = () => {
    const host = newPoolHost.trim();
    const url = newPoolUrl.trim();
    if (!host || !url || !url.includes("{user}")) return;
    const nextDashboards = [
      ...poolDashboards.filter((p) => p.host !== host),
      { host, url },
    ];
    setPoolDashboards(nextDashboards);
    setNewPoolHost("");
    setNewPoolUrl("");
    return persist({
      ...serverBasePayload(),
      pools: {
        dashboards: Object.fromEntries(
          nextDashboards.map((p) => [p.host, p.url]),
        ),
      },
    });
  };

  const handleRemovePoolDashboard = (host: string) => {
    const nextDashboards = poolDashboards.filter((p) => p.host !== host);
    setPoolDashboards(nextDashboards);
    return persist({
      ...serverBasePayload(),
      pools: {
        dashboards: Object.fromEntries(
          nextDashboards.map((p) => [p.host, p.url]),
        ),
      },
    });
  };

  if (isLoading) {
    return <Skeleton variant="rounded" height={320} sx={{ borderRadius: 3 }} />;
  }

  const latestFeederAt = latestTimestamp(miners?.map((m) => m.timestamp) ?? []);
  const latestHealthCheckAt = latestTimestamp(
    miners?.map((m) => m.aliveCheckedAt) ?? [],
  );

  // "Stale" means no confirmed run within roughly twice the configured
  // interval (a generous margin -- polling isn't perfectly on-beat, and
  // this is meant to catch a loop that's actually stuck, not flag normal
  // jitter). No data at all (fresh install, nothing enabled yet) reads as
  // stale too, since there's nothing to confirm the loop is actually
  // running against.
  const isStale = (
    at: number,
    lastAt: string | undefined,
    intervalStr?: string,
  ) => {
    if (!lastAt) return true;
    const intervalMs = parseGoDuration(intervalStr);
    if (intervalMs <= 0) return false;
    return at - new Date(lastAt).getTime() > intervalMs * 2 + 5_000;
  };

  const renderLastRun = (lastAt: string | undefined, intervalStr?: string) => {
    if (now === null || !lastAt) {
      return (
        <Typography
          variant="body2"
          color="text.disabled"
          sx={{ fontFamily: "monospace" }}
        >
          {t("settingsPage.appSettings.readOnly.never")}
        </Typography>
      );
    }
    return (
      <Typography
        variant="body2"
        sx={{
          fontFamily: "monospace",
          color: isStale(now, lastAt, intervalStr)
            ? "warning.main"
            : "success.main",
        }}
      >
        {formatTimestamp(lastAt)}
      </Typography>
    );
  };

  return (
    <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 }, borderRadius: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={700}>
          {t("settingsPage.appSettings.title")}
        </Typography>
        {data?.lastUpdated && (
          <Typography
            variant="caption"
            color="text.disabled"
            sx={{ display: "block", mt: 0.5 }}
          >
            {t("settingsPage.configured.lastUpdated", {
              date: formatTimestamp(data.lastUpdated),
            })}
          </Typography>
        )}
      </Box>

      {saveError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {saveError}
        </Alert>
      )}

      <Stack spacing={4}>
        {/* Electricity */}
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
            <BoltIcon fontSize="small" sx={{ color: "text.secondary" }} />
            <Typography variant="subtitle2" fontWeight={700}>
              {t("settingsPage.appSettings.electricity.title")}
            </Typography>
          </Box>
          {readOnly ? (
            <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
              {t("settingsPage.appSettings.electricity.rateLabel")}:{" "}
              {electricityRate}
            </Typography>
          ) : (
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              alignItems={{ xs: "stretch", sm: "center" }}
            >
              <TextField
                size="small"
                type="number"
                label={t("settingsPage.appSettings.electricity.rateLabel")}
                value={electricityRate}
                onChange={(e) => setElectricityRate(e.target.value)}
                slotProps={{
                  htmlInput: { step: "0.0001", min: 0 },
                  inputLabel: { shrink: true },
                }}
                sx={{ minWidth: 220 }}
              />
              <Button
                variant="contained"
                size="small"
                disabled={isSaving}
                onClick={() => void handleSaveElectricity()}
                startIcon={
                  isSaving ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <SaveIcon fontSize="small" />
                  )
                }
                sx={{ flexShrink: 0 }}
              >
                {isSaving
                  ? t("settingsPage.appSettings.saving")
                  : t("settingsPage.appSettings.save")}
              </Button>
            </Stack>
          )}
        </Box>

        <Box
          sx={{
            height: "1px",
            background: (theme) =>
              `linear-gradient(to right, transparent, ${theme.palette.divider} 20%, ${theme.palette.divider} 80%, transparent)`,
          }}
        />

        {/* Pool dashboards */}
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
            <SystemUpdateAltIcon
              fontSize="small"
              sx={{ color: "text.secondary" }}
            />
            <Typography variant="subtitle2" fontWeight={700}>
              {t("settingsPage.appSettings.pools.title")}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {t("settingsPage.appSettings.pools.description")}
          </Typography>

          <Box sx={{ overflowX: "auto", mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>
                    {t("settingsPage.appSettings.pools.hostLabel")}
                  </TableCell>
                  <TableCell>
                    {t("settingsPage.appSettings.pools.urlLabel")}
                  </TableCell>
                  <Writable readOnly={readOnly}>
                    <TableCell align="right" sx={{ width: 56 }} />
                  </Writable>
                </TableRow>
              </TableHead>
              <TableBody>
                {data &&
                  Object.keys(data.defaults.pools.dashboards).length === 0 &&
                  poolDashboards.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={readOnly ? 2 : 3}>
                        <Typography variant="caption" color="text.disabled">
                          {t("settingsPage.appSettings.pools.empty")}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                {data &&
                  Object.entries(data.defaults.pools.dashboards).map(
                    ([host, url]) => (
                      <TableRow hover key={`builtin-${host}`}>
                        <TableCell sx={{ fontFamily: "monospace" }}>
                          {host}
                        </TableCell>
                        <TableCell
                          sx={{
                            fontFamily: "monospace",
                            overflowWrap: "anywhere",
                          }}
                        >
                          {url}
                        </TableCell>
                        <Writable readOnly={readOnly}>
                          <TableCell />
                        </Writable>
                      </TableRow>
                    ),
                  )}
                {poolDashboards.map((row) => (
                  <TableRow hover key={`custom-${row.host}`}>
                    <TableCell sx={{ fontFamily: "monospace" }}>
                      {row.host}
                    </TableCell>
                    <TableCell
                      sx={{ fontFamily: "monospace", overflowWrap: "anywhere" }}
                    >
                      {row.url}
                    </TableCell>
                    <Writable readOnly={readOnly}>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          disabled={isSaving}
                          onClick={() =>
                            void handleRemovePoolDashboard(row.host)
                          }
                          aria-label={t(
                            "settingsPage.appSettings.pools.remove",
                          )}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </Writable>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>

          <Writable readOnly={readOnly}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                size="small"
                label={t("settingsPage.appSettings.pools.hostLabel")}
                placeholder="stratum.braiins.com"
                value={newPoolHost}
                onChange={(e) => setNewPoolHost(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ minWidth: 220 }}
              />
              <TextField
                size="small"
                label={t("settingsPage.appSettings.pools.urlLabel")}
                placeholder="https://pool.example.com/overview/{user}"
                value={newPoolUrl}
                onChange={(e) => setNewPoolUrl(e.target.value)}
                error={
                  newPoolUrl.trim() !== "" && !newPoolUrl.includes("{user}")
                }
                helperText={
                  newPoolUrl.trim() !== "" && !newPoolUrl.includes("{user}")
                    ? t("settingsPage.appSettings.pools.missingUserPlaceholder")
                    : undefined
                }
                slotProps={{ inputLabel: { shrink: true } }}
                fullWidth
              />
              <Button
                variant="outlined"
                size="small"
                disabled={
                  isSaving ||
                  !newPoolHost.trim() ||
                  !newPoolUrl.trim() ||
                  !newPoolUrl.includes("{user}")
                }
                onClick={() => void handleAddPoolDashboard()}
                sx={{ flexShrink: 0 }}
              >
                {t("settingsPage.appSettings.pools.add")}
              </Button>
            </Stack>
          </Writable>
        </Box>

        <Writable readOnly={readOnly}>
          <Box
            sx={{
              height: "1px",
              background: (theme) =>
                `linear-gradient(to right, transparent, ${theme.palette.divider} 20%, ${theme.palette.divider} 80%, transparent)`,
            }}
          />

          {/* Remote -- never shown read-only: remote.pushURL/apiKey are
                never pushed to a remote board in the first place (see
                cmd/feeder.configSettingsPush), so there'd be nothing real to
                show here anyway. */}
          <Box>
            <Box
              sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}
            >
              <CloudUploadIcon
                fontSize="small"
                sx={{ color: "text.secondary" }}
              />
              <Typography variant="subtitle2" fontWeight={700}>
                {t("settingsPage.appSettings.remote.title")}
              </Typography>
            </Box>
            <Stack spacing={2}>
              <TextField
                size="small"
                label={t("settingsPage.appSettings.remote.pushUrlLabel")}
                placeholder="https://hashboard.live/api/push"
                value={pushURL}
                onChange={(e) => setPushURL(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                fullWidth
              />
              <TextField
                size="small"
                type={showApiKey ? "text" : "password"}
                label={t("settingsPage.appSettings.remote.apiKeyLabel")}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                slotProps={{
                  inputLabel: { shrink: true },
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          edge="end"
                          onClick={() => setShowApiKey((v) => !v)}
                          aria-label={t(
                            showApiKey
                              ? "settingsPage.appSettings.remote.hideApiKey"
                              : "settingsPage.appSettings.remote.showApiKey",
                          )}
                        >
                          {showApiKey ? (
                            <VisibilityOffIcon fontSize="small" />
                          ) : (
                            <VisibilityIcon fontSize="small" />
                          )}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
                fullWidth
              />
            </Stack>
            <Button
              variant="contained"
              size="small"
              disabled={isSaving}
              onClick={() => void handleSaveRemote()}
              startIcon={
                isSaving ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <SaveIcon fontSize="small" />
                )
              }
              sx={{ mt: 2 }}
            >
              {isSaving
                ? t("settingsPage.appSettings.saving")
                : t("settingsPage.appSettings.save")}
            </Button>
          </Box>
        </Writable>

        <Box
          sx={{
            height: "1px",
            background: (theme) =>
              `linear-gradient(to right, transparent, ${theme.palette.divider} 20%, ${theme.palette.divider} 80%, transparent)`,
          }}
        />

        {/* Firmware repos -- built-in, read-only: no override from this UI */}
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
            <MemoryIcon fontSize="small" sx={{ color: "text.secondary" }} />
            <Typography variant="subtitle2" fontWeight={700}>
              {t("settingsPage.appSettings.firmware.title")}
            </Typography>
          </Box>
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 120 }}>
                    {t("settingsPage.appSettings.firmware.modelLabel")}
                  </TableCell>
                  <TableCell>
                    {t("settingsPage.appSettings.firmware.urlLabel")}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data &&
                  Object.entries(data.defaults.firmware.repos).map(
                    ([model, url]) => (
                      <TableRow hover key={model}>
                        <TableCell>
                          <Chip
                            size="small"
                            variant="outlined"
                            label={model}
                            sx={{
                              height: 24,
                              fontSize: "0.8rem",
                              borderRadius: 1,
                            }}
                          />
                        </TableCell>
                        <TableCell
                          sx={{
                            fontFamily: "monospace",
                            overflowWrap: "anywhere",
                          }}
                        >
                          {url}
                        </TableCell>
                      </TableRow>
                    ),
                  )}
              </TableBody>
            </Table>
          </Box>
        </Box>

        <Box
          sx={{
            height: "1px",
            background: (theme) =>
              `linear-gradient(to right, transparent, ${theme.palette.divider} 20%, ${theme.palette.divider} 80%, transparent)`,
          }}
        />

        {/* Read-only, process-launch settings */}
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
            <MonitorHeartIcon
              fontSize="small"
              sx={{ color: "text.secondary" }}
            />
            <Typography variant="subtitle2" fontWeight={700}>
              {t("settingsPage.appSettings.readOnly.title")}
            </Typography>
          </Box>
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>
                    {t("settingsPage.appSettings.readOnly.settingLabel")}
                  </TableCell>
                  <TableCell>
                    {t("settingsPage.appSettings.readOnly.valueLabel")}
                  </TableCell>
                  <TableCell>
                    {t("settingsPage.appSettings.readOnly.lastRunLabel")}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow hover>
                  <TableCell>
                    {t("settingsPage.appSettings.readOnly.feederIntervalLabel")}
                  </TableCell>
                  <TableCell sx={{ fontFamily: "monospace" }}>
                    {data?.readOnly.feederInterval}
                  </TableCell>
                  <TableCell>
                    {renderLastRun(
                      latestFeederAt,
                      data?.readOnly.feederInterval,
                    )}
                  </TableCell>
                </TableRow>
                <TableRow hover>
                  <TableCell>
                    {t(
                      "settingsPage.appSettings.readOnly.healthCheckIntervalLabel",
                    )}
                  </TableCell>
                  <TableCell sx={{ fontFamily: "monospace" }}>
                    {data?.readOnly.healthCheckInterval}
                  </TableCell>
                  <TableCell>
                    {renderLastRun(
                      latestHealthCheckAt,
                      data?.readOnly.healthCheckInterval,
                    )}
                  </TableCell>
                </TableRow>
                <TableRow hover>
                  <TableCell>
                    {t(
                      "settingsPage.appSettings.readOnly.firmwareCacheTTLLabel",
                    )}
                  </TableCell>
                  <TableCell sx={{ fontFamily: "monospace" }}>
                    {data?.readOnly.firmwareCacheTTL}
                  </TableCell>
                  <TableCell>
                    {renderLastRun(
                      data?.readOnly.firmwareCacheCheckedAt,
                      data?.readOnly.firmwareCacheTTL,
                    )}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Box>
        </Box>
      </Stack>

      <Snackbar
        open={snackbarMessage !== null}
        autoHideDuration={5000}
        onClose={() => setSnackbarMessage(null)}
        message={snackbarMessage ?? ""}
      />
    </Paper>
  );
};
