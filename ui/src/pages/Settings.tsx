// src/pages/Settings.tsx
import { Fragment, useState } from "react";
import { useTranslation } from "react-i18next";
import BoltIcon from "@mui/icons-material/Bolt";
import DeselectIcon from "@mui/icons-material/Deselect";
import DeveloperBoardIcon from "@mui/icons-material/DeveloperBoard";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RouterIcon from "@mui/icons-material/Router";
import SaveIcon from "@mui/icons-material/Save";
import ScheduleIcon from "@mui/icons-material/Schedule";
import SearchIcon from "@mui/icons-material/Search";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import SelectAllIcon from "@mui/icons-material/SelectAll";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import WifiFindIcon from "@mui/icons-material/WifiFind";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
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
  Tooltip,
  Typography,
} from "@mui/material";

import { AppSettingsSection } from "@/components/ui/AppSettingsSection";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { PoolScheduleEditor } from "@/components/ui/PoolScheduleEditor";
import { useDiscovery } from "@/hooks/useDiscovery";
import { useMinersConfig } from "@/hooks/useMinersConfig";
import { type MinerConfig, normalizeMac } from "@/schemas/minerConfigSchema";
import { formatTimestamp } from "@/utils/format";

/* ── Configured miners table ────────────────────────────────────── */
const ConfiguredMinersTable = ({
  miners,
  lastUpdated,
  togglingMac,
  onToggleEnabled,
  onDisableAllClick,
  saveMiners,
}: {
  miners: MinerConfig[];
  lastUpdated: string | undefined;
  togglingMac: string | null;
  onToggleEnabled: (miner: MinerConfig) => void;
  onDisableAllClick: () => void;
  saveMiners: (miners: MinerConfig[]) => Promise<MinerConfig[]>;
}) => {
  const { t } = useTranslation();
  const enabledCount = miners.filter((m) => m.enabled).length;
  const [expandedMac, setExpandedMac] = useState<string | null>(null);

  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
      <Box
        sx={{
          px: 3,
          pt: 2.5,
          pb: 1.5,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>
            {t("settingsPage.configured.title")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("settingsPage.configured.description", {
              count: miners.length,
            })}
          </Typography>
          {lastUpdated && (
            <Typography
              variant="caption"
              color="text.disabled"
              sx={{ display: "block", mt: 0.5 }}
            >
              {t("settingsPage.configured.lastUpdated", {
                date: formatTimestamp(lastUpdated),
              })}
            </Typography>
          )}
        </Box>
        <Button
          size="small"
          color="error"
          variant="outlined"
          disabled={enabledCount === 0}
          onClick={onDisableAllClick}
          startIcon={<PauseIcon fontSize="small" />}
          sx={{ flexShrink: 0 }}
        >
          {t("settingsPage.configured.disableAll")}
        </Button>
      </Box>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 40 }} />
              <TableCell>{t("settingsPage.configured.hostname")}</TableCell>
              <TableCell>{t("settingsPage.configured.ip")}</TableCell>
              <TableCell>{t("settingsPage.configured.mac")}</TableCell>
              <TableCell>{t("settingsPage.configured.model")}</TableCell>
              <TableCell align="right">
                {t("settingsPage.configured.status")}
              </TableCell>
              <TableCell align="right">
                {t("settingsPage.configured.actions")}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {miners.map((m) => {
              const isToggling = togglingMac === normalizeMac(m.mac);
              const key = normalizeMac(m.mac);
              const isExpanded = expandedMac === key;
              const toggleExpanded = () =>
                setExpandedMac((current) => (current === key ? null : key));
              return (
                <Fragment key={m.mac}>
                  <TableRow
                    hover
                    onClick={toggleExpanded}
                    sx={{ cursor: "pointer" }}
                  >
                    <TableCell>
                      <IconButton size="small">
                        <KeyboardArrowDownIcon
                          fontSize="small"
                          sx={{
                            transition: "transform 0.15s ease",
                            transform: isExpanded ? "rotate(180deg)" : "none",
                          }}
                        />
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 0.75,
                        }}
                      >
                        {m.hostname || "—"}
                        {(m.poolSchedule?.length ?? 0) > 0 && (
                          <Tooltip
                            title={t(
                              "settingsPage.configured.schedule.countTooltip",
                              {
                                count: m.poolSchedule?.length ?? 0,
                              },
                            )}
                          >
                            <Chip
                              size="small"
                              variant="outlined"
                              icon={<ScheduleIcon fontSize="small" />}
                              label={m.poolSchedule?.length}
                              sx={{
                                height: 20,
                                "& .MuiChip-icon": { fontSize: 14 },
                              }}
                            />
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ fontFamily: "monospace" }}>
                      {m.ip}
                    </TableCell>
                    <TableCell sx={{ fontFamily: "monospace" }}>
                      {m.mac}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={m.model}
                        sx={{ height: 24, fontSize: "0.8rem", borderRadius: 1 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        size="small"
                        label={
                          m.enabled
                            ? t("settingsPage.configured.enabled")
                            : t("settingsPage.configured.disabled")
                        }
                        color={m.enabled ? "success" : "default"}
                        variant={m.enabled ? "filled" : "outlined"}
                        sx={{ height: 24, fontSize: "0.8rem", borderRadius: 1 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        color={m.enabled ? "warning" : "success"}
                        disabled={isToggling}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleEnabled(m);
                        }}
                        startIcon={
                          isToggling ? (
                            <CircularProgress size={14} color="inherit" />
                          ) : m.enabled ? (
                            <PauseIcon fontSize="small" />
                          ) : (
                            <PlayArrowIcon fontSize="small" />
                          )
                        }
                      >
                        {m.enabled
                          ? t("settingsPage.configured.disable")
                          : t("settingsPage.configured.enable")}
                      </Button>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      sx={{
                        py: 0,
                        borderBottom: isExpanded ? undefined : "none",
                      }}
                    >
                      <Collapse in={isExpanded} unmountOnExit>
                        <Box sx={{ px: 2 }}>
                          <PoolScheduleEditor
                            miner={m}
                            saveMiners={saveMiners}
                          />
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </Box>
    </Paper>
  );
};

/* ── Discovered device card ─────────────────────────────────────── */
const DiscoveredDeviceCard = ({
  device,
  selected,
  onToggleSelect,
}: {
  device: MinerConfig;
  selected: boolean;
  onToggleSelect: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <Paper
      variant="outlined"
      onClick={onToggleSelect}
      sx={{
        p: 2.5,
        borderRadius: 3,
        display: "flex",
        flexDirection: "column",
        gap: 1.25,
        cursor: "pointer",
        userSelect: "none",
        borderColor: selected ? "primary.main" : "divider",
        backgroundColor: selected ? "action.selected" : "background.paper",
        transition: "background-color 0.15s ease",
        "&:hover": { backgroundColor: "action.hover" },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", minWidth: 0 }}>
        <Checkbox
          size="small"
          checked={selected}
          tabIndex={-1}
          sx={{ mt: -0.75, ml: -1, pointerEvents: "none" }}
          inputProps={{ "aria-label": "select device" }}
        />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={700} noWrap>
            {device.hostname || t("settingsPage.discovery.unknownHostname")}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 0.25 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontFamily: "monospace" }}
            >
              {device.ip}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontFamily: "monospace" }}
            >
              {device.mac}
            </Typography>
          </Stack>
        </Box>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        <DeveloperBoardIcon fontSize="small" sx={{ color: "text.secondary" }} />
        <Chip size="small" variant="outlined" label={device.model} />
      </Box>

      {device.url ? (
        <Stack spacing={0.5}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <BoltIcon fontSize="small" sx={{ color: "text.secondary" }} />
            <Typography variant="caption" color="text.secondary" noWrap>
              {t("settingsPage.discovery.pool", {
                url: device.url,
                port: device.port,
              })}
            </Typography>
          </Box>
          {device.fallbackUrl && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                pl: 2.75,
              }}
            >
              <Typography variant="caption" color="text.secondary" noWrap>
                {t("settingsPage.discovery.fallbackPool", {
                  url: device.fallbackUrl,
                  port: device.fallbackPort,
                })}
              </Typography>
            </Box>
          )}
        </Stack>
      ) : (
        <Typography variant="caption" color="text.disabled">
          {t("settingsPage.discovery.noPool")}
        </Typography>
      )}
    </Paper>
  );
};

/* ── Empty / error result states ────────────────────────────────── */
const NoResultsState = ({ onRetry }: { onRetry: () => void }) => {
  const { t } = useTranslation();
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1.5,
        py: 5,
        textAlign: "center",
      }}
    >
      <SearchOffIcon sx={{ fontSize: 40, color: "text.disabled" }} />
      <Typography color="text.secondary">
        {t("settingsPage.discovery.noneFound")}
      </Typography>
      <Button
        size="small"
        variant="outlined"
        onClick={onRetry}
        startIcon={<SearchIcon fontSize="small" />}
      >
        {t("settingsPage.discovery.retryLonger")}
      </Button>
    </Box>
  );
};

/* ── Settings page ───────────────────────────────────────────────── */
export const Settings = () => {
  const { t } = useTranslation();
  const {
    data: configuredMiners,
    lastUpdated,
    isLoading: configuredLoading,
    saveMiners,
    isSaving,
    saveError,
  } = useMinersConfig();
  const {
    results,
    isSearching,
    error,
    hasSearched,
    scanNetwork,
    probeIp,
    retryWithLongerTimeout,
  } = useDiscovery();

  const [manualIp, setManualIp] = useState("");
  const [selectedMacs, setSelectedMacs] = useState<Set<string>>(new Set());
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const [togglingMac, setTogglingMac] = useState<string | null>(null);
  const [disableAllOpen, setDisableAllOpen] = useState(false);
  const [isDisablingAll, setIsDisablingAll] = useState(false);

  const configuredByMac = new Map(
    (configuredMiners ?? []).map((m) => [normalizeMac(m.mac), m]),
  );
  const enabledMiners = (configuredMiners ?? []).filter((m) => m.enabled);

  const handleToggleEnabled = async (miner: MinerConfig) => {
    const key = normalizeMac(miner.mac);
    setTogglingMac(key);
    try {
      await saveMiners([{ ...miner, enabled: !miner.enabled }]);
    } catch {
      // saveError from useMinersConfig already surfaces the message.
    } finally {
      setTogglingMac(null);
    }
  };

  const handleDisableAll = async () => {
    if (isDisablingAll) return;
    setIsDisablingAll(true);
    try {
      await saveMiners(enabledMiners.map((m) => ({ ...m, enabled: false })));
      setSnackbarMessage(
        t("settingsPage.configured.disableAllSuccess", {
          count: enabledMiners.length,
        }),
      );
      setDisableAllOpen(false);
    } catch {
      // saveError from useMinersConfig already surfaces the message.
    } finally {
      setIsDisablingAll(false);
    }
  };

  const handleProbeIp = () => {
    const ip = manualIp.trim();
    if (ip) {
      setSelectedMacs(new Set());
      void probeIp(ip);
    }
  };

  const handleScan = () => {
    setSelectedMacs(new Set());
    void scanNetwork();
  };

  const toggleSelected = (mac: string) => {
    const key = normalizeMac(mac);
    setSelectedMacs((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Every result is selectable, whether or not it's already configured --
  // selecting an already-configured one is how the operator refreshes that
  // entry from what the device reports right now (ip, hostname, pool...),
  // e.g. after a pool change made outside the dashboard, or an IP change.
  const selectableMacs = results.map((d) => normalizeMac(d.mac));
  const allSelected =
    selectableMacs.length > 0 &&
    selectableMacs.every((mac) => selectedMacs.has(mac));

  const toggleSelectAll = () => {
    setSelectedMacs(allSelected ? new Set() : new Set(selectableMacs));
  };

  const selectedDevices = results.filter((d) =>
    selectedMacs.has(normalizeMac(d.mac)),
  );

  // Re-selecting an already-configured device is how the operator forces a
  // refresh of its ip/hostname/model/pool from what the device reports
  // right now (e.g. after an IP change, or to recover from a bad manual
  // edit) -- but a fresh probe never knows about enabled/poolSchedule
  // (advanced, hand-edited-only field), so both are carried over from the
  // existing entry rather than clobbered with the probe's own defaults
  // (enabled: true, no schedule).
  const devicesToSave = selectedDevices.map((d) => {
    const existing = configuredByMac.get(normalizeMac(d.mac));
    if (!existing) return d;
    return {
      ...d,
      enabled: existing.enabled,
      poolSchedule: existing.poolSchedule,
    };
  });

  const handleSaveSelected = async () => {
    try {
      await saveMiners(devicesToSave);
      setSnackbarMessage(
        t("settingsPage.discovery.saveSuccess", {
          count: selectedDevices.length,
        }),
      );
      setSelectedMacs(new Set());
    } catch {
      // saveError from useMinersConfig already surfaces the message.
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <PageHeader
        title={t("settingsPage.header.title")}
        description={t("settingsPage.header.description")}
        icon={<WifiFindIcon fontSize="large" />}
        gradientProps={{ height: 3, radius: 2, colors: ["#00b4ff", "#0066cc"] }}
      />

      {configuredLoading ? (
        <Skeleton variant="rounded" height={140} sx={{ borderRadius: 3 }} />
      ) : (
        configuredMiners &&
        configuredMiners.length > 0 && (
          <ConfiguredMinersTable
            miners={configuredMiners}
            lastUpdated={lastUpdated}
            togglingMac={togglingMac}
            onToggleEnabled={(m) => void handleToggleEnabled(m)}
            onDisableAllClick={() => setDisableAllOpen(true)}
            saveMiners={saveMiners}
          />
        )
      )}

      <AppSettingsSection />

      <Paper
        variant="outlined"
        sx={{
          p: 3,
          borderRadius: 3,
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "stretch", sm: "center" },
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>
            {t("settingsPage.scan.title")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("settingsPage.scan.description")}
          </Typography>
        </Box>
        <Button
          variant="contained"
          disabled={isSearching}
          onClick={handleScan}
          startIcon={
            isSearching ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <TravelExploreIcon />
            )
          }
          sx={{ flexShrink: 0 }}
        >
          {isSearching
            ? t("settingsPage.scan.searching")
            : t("settingsPage.scan.action")}
        </Button>
      </Paper>

      <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
        <Typography variant="subtitle1" fontWeight={700}>
          {t("settingsPage.manual.title")}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t("settingsPage.manual.description")}
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <TextField
            size="small"
            fullWidth
            placeholder="192.168.1.42"
            value={manualIp}
            onChange={(e) => setManualIp(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleProbeIp();
            }}
            slotProps={{
              input: {
                startAdornment: (
                  <RouterIcon
                    fontSize="small"
                    sx={{ color: "text.secondary", mr: 1 }}
                  />
                ),
              },
            }}
          />
          <Button
            variant="outlined"
            disabled={isSearching || !manualIp.trim()}
            onClick={handleProbeIp}
            startIcon={
              isSearching ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <SearchIcon />
              )
            }
            sx={{ flexShrink: 0 }}
          >
            {t("settingsPage.manual.action")}
          </Button>
        </Stack>
      </Paper>

      {hasSearched && !isSearching && (
        <Box>
          {error ? (
            <Alert
              severity="warning"
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => void retryWithLongerTimeout()}
                >
                  {t("settingsPage.discovery.retryLonger")}
                </Button>
              }
            >
              {error}
            </Alert>
          ) : results.length === 0 ? (
            <NoResultsState onRetry={() => void retryWithLongerTimeout()} />
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {selectableMacs.length > 0 && (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 1,
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    {t("settingsPage.discovery.resultsCount", {
                      count: results.length,
                    })}
                  </Typography>
                  <Button
                    size="small"
                    onClick={toggleSelectAll}
                    startIcon={
                      allSelected ? (
                        <DeselectIcon fontSize="small" />
                      ) : (
                        <SelectAllIcon fontSize="small" />
                      )
                    }
                  >
                    {allSelected
                      ? t("settingsPage.discovery.deselectAll")
                      : t("settingsPage.discovery.selectAll")}
                  </Button>
                </Box>
              )}

              {selectedDevices.length > 0 && (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 2,
                    borderColor: "primary.main",
                  }}
                >
                  <Typography variant="body2">
                    {t("settingsPage.discovery.selectedCount", {
                      count: selectedDevices.length,
                    })}
                  </Typography>
                  <Button
                    variant="contained"
                    size="small"
                    disabled={isSaving}
                    onClick={() => void handleSaveSelected()}
                    startIcon={
                      isSaving ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : (
                        <SaveIcon fontSize="small" />
                      )
                    }
                  >
                    {isSaving
                      ? t("settingsPage.discovery.saving")
                      : t("settingsPage.discovery.saveSelected")}
                  </Button>
                </Paper>
              )}

              {saveError && <Alert severity="error">{saveError}</Alert>}

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "repeat(1, 1fr)",
                    md: "repeat(2, 1fr)",
                    lg: "repeat(3, 1fr)",
                  },
                  gap: 2,
                }}
              >
                {results.map((device) => {
                  const key = normalizeMac(device.mac);
                  return (
                    <DiscoveredDeviceCard
                      key={device.mac || device.ip}
                      device={device}
                      selected={selectedMacs.has(key)}
                      onToggleSelect={() => toggleSelected(device.mac)}
                    />
                  );
                })}
              </Box>
            </Box>
          )}
        </Box>
      )}

      <ConfirmDialog
        open={disableAllOpen}
        onClose={() => setDisableAllOpen(false)}
        onConfirm={() => void handleDisableAll()}
        title={t("settingsPage.configured.disableAllTitle")}
        description={t("settingsPage.configured.disableAllDescription", {
          count: enabledMiners.length,
        })}
        actionLabel={
          isDisablingAll
            ? t("settingsPage.discovery.saving")
            : t("settingsPage.configured.disableAllConfirm")
        }
        actionColor="error"
      />

      <Snackbar
        open={snackbarMessage !== null}
        autoHideDuration={5000}
        onClose={() => setSnackbarMessage(null)}
        message={snackbarMessage ?? ""}
      />
    </Box>
  );
};
