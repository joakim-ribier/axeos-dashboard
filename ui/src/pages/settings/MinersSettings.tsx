// src/pages/settings/MinersSettings.tsx
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
  FormControlLabel,
  IconButton,
  Paper,
  Skeleton,
  Snackbar,
  Stack,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import { ActionButton } from "@/components/ui/ActionButton";
import { AliasEditor } from "@/components/ui/AliasEditor";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import { PoolEditor } from "@/components/ui/PoolEditor";
import { ScheduleEditor } from "@/components/ui/ScheduleEditor";
import { SectionDivider } from "@/components/ui/SectionDivider";
import { Writable } from "@/components/ui/Writable";
import { useDiscovery } from "@/hooks/useDiscovery";
import { useMiners, useUiFeatures } from "@/hooks/useMiners";
import { useMinersConfig } from "@/hooks/useMinersConfig";
import { type MinerConfig, normalizeMac } from "@/schemas/minerConfigSchema";
import { type Miner } from "@/schemas/minerSchema";
import { displayName } from "@/utils/minerDisplay";
import { poolFieldLabel, poolMismatches } from "@/utils/poolDrift";

import { SectionTitle } from "./SectionTitle";

// Prefilled by the quick-fill button next to the CIDR field -- the default
// subnet on the vast majority of home routers, useful when this server's
// own network interfaces don't reflect the real LAN (e.g. a containerized
// deployment -- see LocalCIDR() server-side).
const COMMON_HOME_CIDR = "192.168.1.0/24";

/* ── Configured miners table ────────────────────────────────────── */
const ConfiguredMinersTable = ({
  miners,
  liveMinersByMac,
  togglingMac,
  onToggleEnabled,
  onDisableAllClick,
  saveMiners,
  readOnly,
}: {
  miners: MinerConfig[];
  liveMinersByMac: Map<string, Miner>;
  togglingMac: string | null;
  onToggleEnabled: (miner: MinerConfig) => void;
  onDisableAllClick: () => void;
  saveMiners: (miners: MinerConfig[]) => Promise<MinerConfig[]>;
  readOnly: boolean;
}) => {
  const { t } = useTranslation();
  const enabledCount = miners.filter((m) => m.enabled).length;
  const [expandedMac, setExpandedMac] = useState<string | null>(null);
  const isEmpty = miners.length === 0;

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 2,
          flexWrap: { xs: "wrap", sm: "nowrap" },
        }}
      >
        <SectionTitle
          icon={<DeveloperBoardIcon fontSize="small" />}
          title={t("settingsPage.configured.title")}
          description={
            isEmpty
              ? t("settingsPage.configured.emptyAlert")
              : t("settingsPage.configured.description", {
                  count: miners.length,
                })
          }
        />
        {!isEmpty && (
          <Writable readOnly={readOnly}>
            <ActionButton
              color="error"
              icon={<PauseIcon fontSize="small" />}
              disabled={enabledCount === 0}
              onClick={onDisableAllClick}
              sx={{ mb: 2 }}
            >
              {t("settingsPage.configured.disableAll")}
            </ActionButton>
          </Writable>
        )}
      </Box>
      {!isEmpty && (
        <DataTable>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 40 }} />
              <TableCell>{t("settingsPage.configured.hostname")}</TableCell>
              <TableCell>{t("settingsPage.configured.ip")}</TableCell>
              <TableCell>{t("settingsPage.configured.mac")}</TableCell>
              <TableCell>{t("settingsPage.configured.model")}</TableCell>
              <TableCell>{t("settingsPage.configured.status")}</TableCell>
              <Writable readOnly={readOnly}>
                <TableCell align="right">
                  {t("settingsPage.configured.actions")}
                </TableCell>
              </Writable>
            </TableRow>
          </TableHead>
          <TableBody>
            {miners.map((m) => {
              const isToggling = togglingMac === normalizeMac(m.mac);
              const key = normalizeMac(m.mac);
              const isExpanded = expandedMac === key;
              const poolDrift = poolMismatches(m, liveMinersByMac.get(key));
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
                        <Typography
                          component="span"
                          sx={{
                            color:
                              poolDrift.length > 0 ? "warning.main" : "inherit",
                            fontWeight: poolDrift.length > 0 ? 700 : 400,
                          }}
                        >
                          {displayName(m) || "—"}
                        </Typography>
                        {poolDrift.length > 0 && (
                          <Tooltip
                            title={t(
                              "settingsPage.configured.pool.driftBadgeTooltip",
                              {
                                fields: poolDrift
                                  .map((mm) => poolFieldLabel(t, mm.field))
                                  .join(", "),
                              },
                            )}
                          >
                            <Box
                              sx={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                flexShrink: 0,
                                bgcolor: "warning.main",
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
                    <TableCell>
                      <Stack direction="row" spacing={0.75}>
                        <Chip
                          size="small"
                          label={
                            m.enabled
                              ? t("settingsPage.configured.enabled")
                              : t("settingsPage.configured.disabled")
                          }
                          color={m.enabled ? "success" : "default"}
                          variant={m.enabled ? "filled" : "outlined"}
                          sx={{
                            height: 24,
                            fontSize: "0.8rem",
                            borderRadius: 1,
                          }}
                        />
                        {(m.schedule?.length ?? 0) > 0 && (
                          <Tooltip
                            title={t(
                              "settingsPage.configured.schedule.countTooltip",
                              { count: m.schedule?.length ?? 0 },
                            )}
                          >
                            <Chip
                              size="small"
                              variant="outlined"
                              label={t(
                                "settingsPage.configured.schedule.scheduledLabel",
                              )}
                              sx={{
                                height: 24,
                                fontSize: "0.8rem",
                                borderRadius: 1,
                              }}
                            />
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                    <Writable readOnly={readOnly}>
                      <TableCell align="right">
                        {/* An icon, its word in the tooltip: the table
                            fits its panel without scrolling sideways. */}
                        <Tooltip
                          title={
                            m.enabled
                              ? t("settingsPage.configured.disable")
                              : t("settingsPage.configured.enable")
                          }
                        >
                          <span>
                            <IconButton
                              size="small"
                              color={m.enabled ? "warning" : "success"}
                              disabled={isToggling}
                              aria-label={
                                m.enabled
                                  ? t("settingsPage.configured.disable")
                                  : t("settingsPage.configured.enable")
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleEnabled(m);
                              }}
                            >
                              {isToggling ? (
                                <CircularProgress size={18} color="inherit" />
                              ) : m.enabled ? (
                                <PauseIcon fontSize="small" />
                              ) : (
                                <PlayArrowIcon fontSize="small" />
                              )}
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </Writable>
                  </TableRow>
                  <TableRow>
                    <TableCell
                      colSpan={readOnly ? 6 : 7}
                      sx={{
                        py: 0,
                        borderBottom: isExpanded ? undefined : "none",
                      }}
                    >
                      <Collapse in={isExpanded} unmountOnExit>
                        <Box sx={{ px: 2 }}>
                          <AliasEditor
                            miner={m}
                            saveMiners={saveMiners}
                            readOnly={readOnly}
                          />
                          <SectionDivider sx={{ my: 1.5 }} />
                          <PoolEditor
                            miner={m}
                            liveMiner={liveMinersByMac.get(key)}
                            saveMiners={saveMiners}
                            readOnly={readOnly}
                          />
                          <SectionDivider sx={{ my: 1.5 }} />
                          <ScheduleEditor
                            miner={m}
                            saveMiners={saveMiners}
                            readOnly={readOnly}
                          />
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </Fragment>
              );
            })}
          </TableBody>
        </DataTable>
      )}
    </Box>
  );
};

/* ── Discovered device card ─────────────────────────────────────── */
const DiscoveredDeviceCard = ({
  device,
  existingAlias,
  selected,
  onToggleSelect,
}: {
  device: MinerConfig;
  /** The alias already configured for this MAC, if this device matches an
   * existing miners.yml entry (a re-scan/refresh, not a first discovery) --
   * see displayName(). undefined for a genuinely new device. */
  existingAlias?: string;
  selected: boolean;
  onToggleSelect: () => void;
}) => {
  const { t } = useTranslation();
  const name = displayName({ hostname: device.hostname, alias: existingAlias });

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
            {name || t("settingsPage.discovery.unknownHostname")}
          </Typography>
          {existingAlias && device.hostname && (
            <Typography variant="caption" color="text.secondary" noWrap>
              {device.hostname}
            </Typography>
          )}
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

/* ── Miners settings page ────────────────────────────────────────── */
export const MinersSettings = () => {
  const { t } = useTranslation();
  const { ui } = useUiFeatures();
  const readOnly = ui.page.settings === "readonly";
  const {
    data: configuredMiners,
    isLoading: configuredLoading,
    saveMiners,
    isSaving,
    saveError,
  } = useMinersConfig();
  // Live dashboard data, matched by mac against the managed config below --
  // lets PoolEditor flag when the saved pool config drifts from what the
  // device is actually reporting right now (see poolMismatches).
  const { data: liveMiners } = useMiners();
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
  const [customCidr, setCustomCidr] = useState("");
  const [isolatedNetwork, setIsolatedNetwork] = useState(false);
  const [selectedMacs, setSelectedMacs] = useState<Set<string>>(new Set());
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const [togglingMac, setTogglingMac] = useState<string | null>(null);
  const [disableAllOpen, setDisableAllOpen] = useState(false);
  const [isDisablingAll, setIsDisablingAll] = useState(false);

  const configuredByMac = new Map(
    (configuredMiners ?? []).map((m) => [normalizeMac(m.mac), m]),
  );
  const liveMinersByMac = new Map(
    (liveMiners ?? []).map((m) => [normalizeMac(m.macAddr), m]),
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
    void scanNetwork(customCidr.trim() || undefined);
  };

  const handleIsolatedNetworkToggle = (checked: boolean) => {
    setIsolatedNetwork(checked);
    setCustomCidr(checked ? COMMON_HOME_CIDR : "");
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
  // edit) -- but a fresh probe never knows about enabled/schedule/alias
  // (advanced, hand-edited-only fields), so all three are carried over from
  // the existing entry rather than clobbered with the probe's own defaults
  // (enabled: true, no schedule, no alias). alias in particular is the
  // whole point of the field: a discovery refresh must never silently wipe
  // out a custom display name.
  const devicesToSave = selectedDevices.map((d) => {
    const existing = configuredByMac.get(normalizeMac(d.mac));
    if (!existing) return d;
    return {
      ...d,
      enabled: existing.enabled,
      schedule: existing.schedule,
      alias: existing.alias,
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
    <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 }, borderRadius: 3 }}>
      <Stack spacing={4}>
        {configuredLoading ? (
          <Skeleton variant="rounded" height={140} sx={{ borderRadius: 3 }} />
        ) : (
          configuredMiners && (
            <ConfiguredMinersTable
              miners={configuredMiners}
              liveMinersByMac={liveMinersByMac}
              togglingMac={togglingMac}
              onToggleEnabled={(m) => void handleToggleEnabled(m)}
              onDisableAllClick={() => setDisableAllOpen(true)}
              saveMiners={saveMiners}
              readOnly={readOnly}
            />
          )
        )}

        <Writable readOnly={readOnly}>
          <SectionDivider />

          {/* Network scan */}
          <Box>
            <SectionTitle
              icon={<TravelExploreIcon fontSize="small" />}
              title={t("settingsPage.scan.title")}
              description={t("settingsPage.scan.description")}
            />
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              alignItems={{ xs: "stretch", sm: "center" }}
            >
              <ActionButton
                icon={<TravelExploreIcon fontSize="small" />}
                loading={isSearching}
                onClick={handleScan}
              >
                {isSearching
                  ? t("settingsPage.scan.searching")
                  : t("settingsPage.scan.action")}
              </ActionButton>
              <FormControlLabel
                sx={{ mr: 0 }}
                control={
                  <Checkbox
                    size="small"
                    checked={isolatedNetwork}
                    onChange={(e) =>
                      handleIsolatedNetworkToggle(e.target.checked)
                    }
                  />
                }
                label={
                  <Typography variant="body2" color="text.secondary">
                    {t("settingsPage.scan.isolatedLabel")}
                  </Typography>
                }
              />
            </Stack>
            {customCidr && (
              <TextField
                size="small"
                fullWidth
                label={t("settingsPage.scan.cidrLabel")}
                placeholder={t("settingsPage.scan.cidrPlaceholder")}
                helperText={t("settingsPage.scan.cidrHelp")}
                value={customCidr}
                onChange={(e) => setCustomCidr(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleScan();
                }}
                sx={{ mt: 2, maxWidth: { sm: 360 } }}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            )}
          </Box>

          <SectionDivider />

          {/* Single IP */}
          <Box>
            <SectionTitle
              icon={<RouterIcon fontSize="small" />}
              title={t("settingsPage.manual.title")}
              description={t("settingsPage.manual.description")}
            />
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              alignItems={{ xs: "stretch", sm: "center" }}
            >
              <TextField
                size="small"
                label={t("settingsPage.manual.ipLabel")}
                placeholder="192.168.1.42"
                value={manualIp}
                onChange={(e) => setManualIp(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleProbeIp();
                }}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ width: { sm: 360 } }}
              />
              <ActionButton
                icon={<SearchIcon fontSize="small" />}
                loading={isSearching}
                disabled={!manualIp.trim()}
                onClick={handleProbeIp}
              >
                {t("settingsPage.manual.action")}
              </ActionButton>
            </Stack>
          </Box>

          {hasSearched && !isSearching && (
            <>
              <SectionDivider />

              {/* What the scan / probe found */}
              <Box>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 2,
                    flexWrap: { xs: "wrap", sm: "nowrap" },
                  }}
                >
                  <SectionTitle
                    icon={<WifiFindIcon fontSize="small" />}
                    title={t("settingsPage.discovery.title")}
                    description={
                      error || results.length === 0
                        ? t("settingsPage.discovery.noneFound")
                        : t("settingsPage.discovery.resultsCount", {
                            count: results.length,
                          })
                    }
                  />
                  {!error && results.length > 0 && (
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
                      sx={{ flexShrink: 0, mb: 2 }}
                    >
                      {allSelected
                        ? t("settingsPage.discovery.deselectAll")
                        : t("settingsPage.discovery.selectAll")}
                    </Button>
                  )}
                </Box>

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
                  <NoResultsState
                    onRetry={() => void retryWithLongerTimeout()}
                  />
                ) : (
                  <Stack spacing={2}>
                    {selectedDevices.length > 0 && (
                      <Paper
                        variant="outlined"
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 2,
                          flexWrap: "wrap",
                          borderColor: "primary.main",
                        }}
                      >
                        <Typography variant="body2">
                          {t("settingsPage.discovery.selectedCount", {
                            count: selectedDevices.length,
                          })}
                        </Typography>
                        <ActionButton
                          icon={<SaveIcon fontSize="small" />}
                          loading={isSaving}
                          onClick={() => void handleSaveSelected()}
                        >
                          {isSaving
                            ? t("settingsPage.discovery.saving")
                            : t("settingsPage.discovery.saveSelected")}
                        </ActionButton>
                      </Paper>
                    )}

                    {saveError && <Alert severity="error">{saveError}</Alert>}

                    <Box
                      sx={{
                        display: "grid",
                        // As many columns as the section panel fits --
                        // its width, not the screen's, says how many.
                        gridTemplateColumns:
                          "repeat(auto-fill, minmax(min(100%, 380px), 1fr))",
                        gap: 2,
                      }}
                    >
                      {results.map((device) => {
                        const key = normalizeMac(device.mac);
                        return (
                          <DiscoveredDeviceCard
                            key={device.mac || device.ip}
                            device={device}
                            existingAlias={configuredByMac.get(key)?.alias}
                            selected={selectedMacs.has(key)}
                            onToggleSelect={() => toggleSelected(device.mac)}
                          />
                        );
                      })}
                    </Box>
                  </Stack>
                )}
              </Box>
            </>
          )}
        </Writable>
      </Stack>

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
    </Paper>
  );
};
