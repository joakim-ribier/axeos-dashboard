// src/pages/settings/MinersSettings.tsx
import { useState } from "react";
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
import SettingsIcon from "@mui/icons-material/Settings";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import TuneIcon from "@mui/icons-material/Tune";
import VisibilityIcon from "@mui/icons-material/Visibility";
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
  useMediaQuery,
  useTheme,
} from "@mui/material";

import { MinerDrawer } from "@/components/dashboard/drawer/MinerDrawer";
import { ActionButton } from "@/components/ui/ActionButton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import { Row, RowList } from "@/components/ui/RowList";
import { SectionDivider } from "@/components/ui/SectionDivider";
import {
  PAGE_GAP,
  ROW_SPACING,
  SECTION_GAP,
} from "@/components/ui/SectionLayout";
import { SidePanel } from "@/components/ui/SidePanel";
import { Writable } from "@/components/ui/Writable";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useDiscovery } from "@/hooks/useDiscovery";
import { useMiners, useUiFeatures } from "@/hooks/useMiners";
import { useMinersConfig } from "@/hooks/useMinersConfig";
import { useMinersHistory } from "@/hooks/useMinersHistory";
import { useMinerStatus } from "@/hooks/useMinerStatus";
import {
  commonAlertMargins,
  commonAlertThresholds,
} from "@/schemas/appSettingsSchema";
import { type MinerConfig, normalizeMac } from "@/schemas/minerConfigSchema";
import { type Miner } from "@/schemas/minerSchema";
import { displayName } from "@/utils/minerDisplay";
import { poolFieldLabel, poolMismatches } from "@/utils/poolDrift";

import { MinerConfigPanel } from "./MinerConfigPanel";
import { MinersToolbar } from "./MinersToolbar";
import { SectionTitle } from "./SectionTitle";

// Prefilled by the quick-fill button next to the CIDR field -- the default
// subnet on the vast majority of home routers, useful when this server's
// own network interfaces don't reflect the real LAN (e.g. a containerized
// deployment -- see LocalCIDR() server-side).
const COMMON_HOME_CIDR = "192.168.1.0/24";

/* ── Configured miners table ────────────────────────────────────── */
/** One of a miner's thresholds -- its own or every miner's, the tooltip
 * says which. */
const ThresholdValue = ({
  own,
  common,
  unit,
}: {
  own: number | undefined;
  common: number;
  unit: string;
}) => {
  const { t } = useTranslation();
  return (
    <Tooltip
      title={
        own
          ? t("settingsPage.configured.thresholdOwn")
          : t("settingsPage.configured.thresholdCommon")
      }
    >
      <span>
        {own || common} {unit}
      </span>
    </Tooltip>
  );
};

const ConfiguredMinersTable = ({
  miners,
  liveMinersByMac,
  togglingMac,
  onToggleEnabled,
  saveMiners,
  readOnly,
  onSaved,
}: {
  miners: MinerConfig[];
  liveMinersByMac: Map<string, Miner>;
  togglingMac: string | null;
  onToggleEnabled: (miner: MinerConfig) => void;
  saveMiners: (miners: MinerConfig[]) => Promise<MinerConfig[]>;
  readOnly: boolean;
  onSaved: (message: string) => void;
}) => {
  const { t } = useTranslation();
  const { ui } = useUiFeatures();
  const [actionsOpen, setActionsOpen] = useState(false);
  // Every action on the whole fleet is gated: none left, no Actions button.
  const hasActions = !readOnly || ui.action.minerPoolSwitch !== "hidden";
  const { data: appSettings } = useAppSettings();
  // A save from a miner's row says so, like every other save.
  const saveMiner = async (updated: MinerConfig[]) => {
    const saved = await saveMiners(updated);
    onSaved(t("settingsPage.configured.saveSuccess"));
    return saved;
  };
  // What a miner with no thresholds of its own follows.
  const alertDefaults = appSettings
    ? commonAlertThresholds(appSettings)
    : { tempHigh: 62, fanHigh: 75 };
  // What every miner's alerts end under.
  const alertMargins = appSettings
    ? commonAlertMargins(appSettings)
    : { tempMargin: 2, fanMargin: 5 };
  const enabledCount = miners.filter((m) => m.enabled).length;
  // The miner whose configuration is open -- kept apart from the open flag
  // so the panel still shows it while it slides out.
  const [configMac, setConfigMac] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down("md"), {
    noSsr: true,
  });
  const isEmpty = miners.length === 0;
  const { statusOf } = useMinerStatus();
  const { data: history } = useMinersHistory();
  // Kept apart from the open flag so the panel still shows its miner while
  // it slides out -- same as Home.
  const [viewedMac, setViewedMac] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const viewed = viewedMac ? liveMinersByMac.get(viewedMac) : undefined;

  // Each miner's pieces, laid out as a table row, or a card on a narrow
  // screen -- a click on either opens its configuration.
  const items = miners.map((m) => {
    const key = normalizeMac(m.mac);
    const isToggling = togglingMac === key;
    const poolDrift = poolMismatches(m, liveMinersByMac.get(key));
    const open = () => {
      setConfigMac(key);
      setConfigOpen(true);
    };
    const title = (
      <Box
        sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}
      >
        <Typography
          component="span"
          variant="body2"
          noWrap
          sx={{
            color: poolDrift.length > 0 ? "warning.main" : "inherit",
            fontWeight: poolDrift.length > 0 ? 700 : 600,
          }}
        >
          {displayName(m) || "—"}
        </Typography>
        {poolDrift.length > 0 && (
          <Tooltip
            title={t("settingsPage.configured.pool.driftBadgeTooltip", {
              fields: poolDrift
                .map((mm) => poolFieldLabel(t, mm.field))
                .join(", "),
            })}
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
    );
    // The hostname, under the name when an alias hides it.
    const hostname = m.alias && m.alias !== m.hostname && (
      <Typography
        variant="caption"
        color="text.secondary"
        noWrap
        component="div"
      >
        {m.hostname}
      </Typography>
    );
    const name = (
      <Box sx={{ minWidth: 0 }}>
        {title}
        {hostname}
      </Box>
    );
    const model = (
      <Chip
        size="small"
        variant="outlined"
        label={m.model}
        sx={{ height: 24, fontSize: "0.8rem", borderRadius: 1 }}
      />
    );
    const thresholds = (
      <Box
        component="span"
        sx={{ whiteSpace: "nowrap", color: "text.secondary" }}
      >
        <ThresholdValue
          own={m.alerts?.tempHigh}
          common={alertDefaults.tempHigh}
          unit="°C"
        />
        {" · "}
        <ThresholdValue
          own={m.alerts?.fanHigh}
          common={alertDefaults.fanHigh}
          unit="%"
        />
      </Box>
    );
    // Only what's worth a look: a disabled miner, scheduled tasks -- an
    // enabled one is the usual case and says nothing.
    const tasks = m.schedule?.length ?? 0;
    const chips = (
      <Stack direction="row" spacing={0.75} alignItems="center">
        {!m.enabled && (
          <Chip
            size="small"
            variant="outlined"
            label={t("settingsPage.configured.disabled")}
            sx={{ height: 24, fontSize: "0.8rem", borderRadius: 1 }}
          />
        )}
        {tasks > 0 && (
          <Tooltip
            title={t("settingsPage.configured.schedule.countTooltip", {
              count: tasks,
            })}
          >
            <ScheduleIcon
              fontSize="small"
              aria-label={t("settingsPage.configured.schedule.countTooltip", {
                count: tasks,
              })}
              sx={{ color: "text.secondary" }}
            />
          </Tooltip>
        )}
      </Stack>
    );
    const actions = (
      <Box sx={{ whiteSpace: "nowrap" }}>
        {/* Icons, their word in the tooltip: the list fits its panel
            without scrolling sideways. Configure says what a click on the
            row does too. */}
        <Tooltip title={t("settingsPage.configured.configure")}>
          <IconButton
            size="small"
            aria-label={t("settingsPage.configured.configure")}
            onClick={(e) => {
              e.stopPropagation();
              open();
            }}
          >
            <SettingsIcon fontSize="small" sx={{ color: "text.secondary" }} />
          </IconButton>
        </Tooltip>
        <Tooltip title={t("settingsPage.configured.view")}>
          <span>
            <IconButton
              size="small"
              disabled={!liveMinersByMac.has(key)}
              aria-label={t("settingsPage.configured.view")}
              onClick={(e) => {
                e.stopPropagation();
                setViewedMac(key);
                setDrawerOpen(true);
              }}
            >
              <VisibilityIcon fontSize="small" color="primary" />
            </IconButton>
          </span>
        </Tooltip>
        <Writable readOnly={readOnly}>
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
                  <PauseIcon fontSize="small" sx={{ color: "error.main" }} />
                ) : (
                  <PlayArrowIcon
                    fontSize="small"
                    sx={{ color: "success.main" }}
                  />
                )}
              </IconButton>
            </span>
          </Tooltip>
        </Writable>
      </Box>
    );
    return {
      m,
      key,
      open,
      title,
      hostname,
      name,
      model,
      thresholds,
      chips,
      actions,
    };
  });

  const table = (
    <DataTable>
      <TableHead>
        <TableRow>
          <TableCell>{t("settingsPage.configured.hostname")}</TableCell>
          <TableCell>{t("settingsPage.configured.ip")}</TableCell>
          <TableCell align="center">
            {t("settingsPage.configured.model")}
          </TableCell>
          <TableCell>{t("settingsPage.configured.thresholds")}</TableCell>
          <TableCell>{t("settingsPage.configured.status")}</TableCell>
          <TableCell align="right">
            {t("settingsPage.configured.actions")}
          </TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map((i) => (
          <TableRow
            key={i.key}
            hover
            onClick={i.open}
            sx={{ cursor: "pointer" }}
          >
            <TableCell>{i.name}</TableCell>
            <TableCell sx={{ fontFamily: "monospace" }}>{i.m.ip}</TableCell>
            <TableCell align="center">{i.model}</TableCell>
            <TableCell>{i.thresholds}</TableCell>
            <TableCell>{i.chips}</TableCell>
            <TableCell align="right">{i.actions}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </DataTable>
  );

  // A phone's row: its name and status on top, then short lines that never
  // break in the middle -- its actions on the right.
  const cards = (
    <RowList>
      {items.map((i) => (
        <Row
          key={i.key}
          onClick={i.open}
          sx={{ display: "flex", alignItems: "center", gap: 1 }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {i.title}
              {i.chips}
            </Box>
            {i.hostname}
            {/* The same size as the desktop table's cells. */}
            <Typography variant="body2" color="text.secondary" component="div">
              <Box component="span" sx={{ fontFamily: "monospace" }}>
                {i.m.ip}
              </Box>
              {` · ${i.m.model}`}
            </Typography>
            <Typography variant="body2" component="div">
              {i.thresholds}
            </Typography>
          </Box>
          {i.actions}
        </Row>
      ))}
    </RowList>
  );
  const configured = configMac
    ? miners.find((m) => normalizeMac(m.mac) === configMac)
    : undefined;

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
              : t("settingsPage.toc.miners.summary", {
                  count: miners.length,
                  enabled: enabledCount,
                })
          }
        />
        {!isEmpty && hasActions && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<TuneIcon fontSize="small" />}
            endIcon={
              <KeyboardArrowDownIcon
                sx={{
                  transition: "transform 0.2s",
                  transform: actionsOpen ? "rotate(180deg)" : "none",
                }}
              />
            }
            aria-expanded={actionsOpen}
            onClick={() => setActionsOpen((open) => !open)}
            sx={{ height: 40, flexShrink: 0, mb: SECTION_GAP }}
          >
            {t("settingsPage.toolbar.title")}
          </Button>
        )}
      </Box>
      {!isEmpty && hasActions && (
        <Collapse in={actionsOpen} unmountOnExit>
          <MinersToolbar
            miners={miners}
            liveMinersByMac={liveMinersByMac}
            saveMiners={saveMiners}
            readOnly={readOnly}
            onSaved={onSaved}
          />
        </Collapse>
      )}
      {!isEmpty && (compact ? cards : table)}
      <SidePanel
        width={820}
        open={configOpen && configured !== undefined}
        onClose={() => setConfigOpen(false)}
      >
        {configured && (
          <MinerConfigPanel
            key={configMac}
            miner={configured}
            liveMiner={liveMinersByMac.get(normalizeMac(configured.mac))}
            common={{ ...alertDefaults, ...alertMargins }}
            saveMiners={saveMiner}
            readOnly={readOnly}
            onClose={() => setConfigOpen(false)}
          />
        )}
      </SidePanel>
      <MinerDrawer
        open={drawerOpen}
        miner={viewed}
        status={viewed && statusOf(viewed)}
        hashRateHistory={
          viewed
            ? history?.miners.find((h) => h.ip === viewed.ip)?.hashRate
            : undefined
        }
        onClose={() => setDrawerOpen(false)}
      />
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
  // Disabling a miner stops its polling: asked first.
  const [toDisable, setToDisable] = useState<MinerConfig | null>(null);

  const configuredByMac = new Map(
    (configuredMiners ?? []).map((m) => [normalizeMac(m.mac), m]),
  );
  const liveMinersByMac = new Map(
    (liveMiners ?? []).map((m) => [normalizeMac(m.macAddr), m]),
  );

  const handleToggleEnabled = async (miner: MinerConfig) => {
    const key = normalizeMac(miner.mac);
    setTogglingMac(key);
    try {
      await saveMiners([{ ...miner, enabled: !miner.enabled }]);
      setSnackbarMessage(t("settingsPage.configured.saveSuccess"));
    } catch {
      // saveError from useMinersConfig already surfaces the message.
    } finally {
      setTogglingMac(null);
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
  // edit) -- but a fresh probe never knows about enabled/schedule/alias/
  // alert thresholds (fields set from this page), so they're carried over
  // from the existing entry rather than clobbered with the probe's own
  // defaults (enabled: true, no schedule, no alias, no thresholds). alias in particular is the
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
      alerts: existing.alerts,
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
      <Stack spacing={PAGE_GAP}>
        {configuredLoading ? (
          <Skeleton variant="rounded" height={140} sx={{ borderRadius: 3 }} />
        ) : (
          configuredMiners && (
            <ConfiguredMinersTable
              miners={configuredMiners}
              liveMinersByMac={liveMinersByMac}
              togglingMac={togglingMac}
              onToggleEnabled={(m) =>
                m.enabled ? setToDisable(m) : void handleToggleEnabled(m)
              }
              saveMiners={saveMiners}
              readOnly={readOnly}
              onSaved={setSnackbarMessage}
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
              spacing={ROW_SPACING}
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
                sx={{ mt: SECTION_GAP, maxWidth: { sm: 360 } }}
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
              spacing={ROW_SPACING}
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
                      sx={{ flexShrink: 0, mb: SECTION_GAP }}
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
                  <Stack spacing={SECTION_GAP}>
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
        open={toDisable !== null}
        onClose={() => setToDisable(null)}
        onConfirm={() => {
          if (toDisable) void handleToggleEnabled(toDisable);
          setToDisable(null);
        }}
        title={t("settingsPage.configured.disableTitle", {
          name: toDisable ? displayName(toDisable) || toDisable.ip : "",
        })}
        description={t("settingsPage.configured.disableDescription", {
          name: toDisable ? displayName(toDisable) || toDisable.ip : "",
        })}
        actionLabel={t("settingsPage.configured.disable")}
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
