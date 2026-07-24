// src/pages/Home.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import DashboardIcon from "@mui/icons-material/Dashboard";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import SearchIcon from "@mui/icons-material/Search";
import SettingsIcon from "@mui/icons-material/Settings";
import {
  Box,
  Chip,
  Collapse,
  FormControlLabel,
  Grid,
  IconButton,
  InputBase,
  Popover,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { Theme } from "@mui/material/styles";

import { useMode } from "@/contexts/ModeContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useNotificationSettings } from "@/contexts/NotificationSettingsContext";
import { useSearch } from "@/contexts/SearchContext";
import {
  matchesQuickFilters,
  NO_QUICK_FILTERS,
  QuickFilters,
} from "@/utils/minerFilters";
import {
  createSettingsUpdatedNotification,
  detectNotifications,
  diffNotificationSettings,
  loadMinerSnapshot,
  NotificationSettings,
  saveMinerSnapshot,
} from "@/utils/minerNotifications";
import { matchesSearch } from "@/utils/minerSearch";

import { BoardLockedPage } from "../components/ui/BoardLockedPage";
import { GlobalStats } from "../components/ui/GlobalStats";
import { MinerCard } from "../components/ui/MinerCard/MinerCard";
import { OopsPage } from "../components/ui/OopsPage";
import { PageHeader } from "../components/ui/PageHeader";
import { ApiError, useAppInfo, useMiners } from "../hooks/useMiners";

const getPoolLabel = (url: string): string => {
  try {
    return url.replace(/^[^:]+:\/\//, "").split(":")[0];
  } catch {
    return url;
  }
};

/* ── Search ──────────────────────────────────────────────────── */
const SearchHelpTooltip = () => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  return (
    <>
      <IconButton
        size="small"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        aria-label="search syntax help"
      >
        <InfoOutlinedIcon fontSize="inherit" sx={{ color: "text.secondary" }} />
      </IconButton>

      <Popover
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { p: 1, maxWidth: 280 } } }}
      >
        <Typography
          variant="caption"
          component="div"
          sx={{ fontWeight: 700, mb: 0.5 }}
        >
          {t("search.helpTitle")}
        </Typography>
        <Typography variant="caption" component="div">
          {t("search.helpPlain")}
        </Typography>
        <Typography variant="caption" component="div">
          {t("search.helpCompare")}
        </Typography>
        <Typography variant="caption" component="div">
          {t("search.helpKeywords")}
        </Typography>
        <Typography variant="caption" component="div">
          {t("search.helpExclude")}
        </Typography>
        <Typography variant="caption" component="div">
          {t("search.helpCombine")}
        </Typography>
      </Popover>
    </>
  );
};

const SearchField = () => {
  const { query, setQuery } = useSearch();

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        bgcolor: "background.default",
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        px: 1.5,
        py: 1,
        width: "100%",
      }}
    >
      <SearchIcon fontSize="small" sx={{ color: "text.secondary" }} />
      <InputBase
        placeholder="Search…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        sx={{ color: "text.primary", fontSize: "0.875rem", width: "100%" }}
      />
      <SearchHelpTooltip />
    </Box>
  );
};

/* ── Notification settings panel ────────────────────────────── */
interface ThresholdFieldProps {
  label: string;
  value: number;
  onCommit: (value: number) => void;
}

/**
 * A number TextField needs its own local text state rather than being
 * driven directly by the committed numeric value — otherwise clearing the
 * field to retype a number briefly yields an empty string, `Number("")`
 * resolves to 0, and the input immediately snaps back to showing "0"
 * before the next keystroke lands, making it impossible to type a fresh
 * value. Local text is free to be empty or transiently invalid while the
 * user is typing; only a valid finite number gets committed upstream, and
 * blurring on an empty/invalid value reverts the display to the last
 * committed one instead of leaving it stuck.
 */
const ThresholdField: React.FC<ThresholdFieldProps> = ({
  label,
  value,
  onCommit,
}) => {
  const [text, setText] = useState(String(value));

  return (
    <TextField
      label={label}
      type="number"
      size="small"
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        const parsed = Number(raw);
        if (raw !== "" && Number.isFinite(parsed)) {
          onCommit(parsed);
        }
      }}
      onBlur={() => {
        if (text === "" || !Number.isFinite(Number(text))) {
          setText(String(value));
        }
      }}
      sx={{ maxWidth: 200 }}
    />
  );
};

const NotificationSettingsPanel = () => {
  const { t } = useTranslation();
  const { settings, updateSettings } = useNotificationSettings();

  const toggle =
    (key: keyof NotificationSettings) =>
    (_event: React.ChangeEvent<HTMLInputElement>, checked: boolean) =>
      updateSettings({ [key]: checked });

  const toggles: { key: keyof NotificationSettings; labelKey: string }[] = [
    { key: "notifyTemp", labelKey: "notificationSettings.notifyTemp" },
    { key: "notifyFan", labelKey: "notificationSettings.notifyFan" },
    { key: "notifyOffline", labelKey: "notificationSettings.notifyOffline" },
    {
      key: "notifyUpdateAvailable",
      labelKey: "notificationSettings.notifyUpdateAvailable",
    },
    { key: "notifyVersion", labelKey: "notificationSettings.notifyVersion" },
  ];

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
      }}
    >
      <Typography variant="caption" sx={{ fontWeight: 700 }}>
        {t("notificationSettings.title")}
      </Typography>

      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <ThresholdField
          label={t("notificationSettings.tempThreshold")}
          value={settings.tempThreshold}
          onCommit={(tempThreshold) => updateSettings({ tempThreshold })}
        />
        <ThresholdField
          label={t("notificationSettings.fanThreshold")}
          value={settings.fanThreshold}
          onCommit={(fanThreshold) => updateSettings({ fanThreshold })}
        />
      </Box>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
        {toggles.map(({ key, labelKey }) => (
          <FormControlLabel
            key={key}
            sx={{ ml: 0, mr: 3, gap: 1 }}
            control={
              <Switch
                size="small"
                checked={settings[key] as boolean}
                onChange={toggle(key)}
              />
            }
            label={
              <Typography variant="caption" color="text.secondary">
                {t(labelKey)}
              </Typography>
            }
          />
        ))}
      </Box>
    </Box>
  );
};

/* ── Home ────────────────────────────────────────────────────── */
export const Home = () => {
  const { t } = useTranslation();
  const { data, isLoading, error } = useMiners();
  const { hashboardUrl } = useAppInfo();
  const { boardId } = useMode();
  const { query } = useSearch();
  const { addNotifications } = useNotifications();
  const { settings } = useNotificationSettings();

  const [selectedPool, setSelectedPool] = useState<string | null>(null);
  const [selectedDeviceModel, setSelectedDeviceModel] = useState<string | null>(
    null,
  );
  const [alertTemp, setAlertTemp] = useState(false);
  const [alertFan, setAlertFan] = useState(false);
  const [alertOffline, setAlertOffline] = useState(false);
  // A single "which panel is open" state (rather than two independent
  // booleans) so opening one automatically closes the other -- no need to
  // manually re-click the previous icon to collapse it first.
  const [openPanel, setOpenPanel] = useState<"filters" | "settings" | null>(
    null,
  );
  const toggleFilters = () =>
    setOpenPanel((current) => (current === "filters" ? null : "filters"));
  const toggleSettings = () =>
    setOpenPanel((current) => (current === "settings" ? null : "settings"));

  // Seeded from localStorage rather than starting undefined every mount —
  // otherwise a plain page reload would look like "the very first fetch
  // ever" and re-notify for anything already in a bad state (see
  // detectNotifications' neutral-baseline behavior).
  const previousDataRef = useRef<typeof data>(loadMinerSnapshot(boardId));
  useEffect(() => {
    if (!data) return;
    const newNotifications = detectNotifications(
      previousDataRef.current,
      data,
      settings,
    );
    if (newNotifications.length > 0) addNotifications(newNotifications);
    previousDataRef.current = data;
    saveMinerSnapshot(boardId, data);
  }, [data, addNotifications, boardId, settings]);

  // Separate, debounced acknowledgment that the settings themselves changed.
  // Debounced (rather than firing on every settings reference change)
  // because the threshold fields update on every keystroke — without this,
  // typing "30" digit by digit would raise its own notification per digit.
  // The notification's detail lists every field that actually moved
  // between the settings before this edit session and the settled result
  // (e.g. "Temp threshold: 60°C → 30°C, Notify when offline: off").
  const previousSettingsRef = useRef(settings);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (previousSettingsRef.current !== settings) {
        const diff = diffNotificationSettings(
          previousSettingsRef.current,
          settings,
        );
        if (diff.length > 0) {
          const detail = diff
            .map(({ key, previousValue, nextValue }) => {
              const label = t(`notificationSettings.${key}`);
              if (typeof nextValue === "boolean") {
                const onOff = nextValue ? t("common.on") : t("common.off");
                return `${label}: ${onOff}`;
              }
              const unit = key === "tempThreshold" ? "°C" : "%";
              return `${label}: ${previousValue}${unit} → ${nextValue}${unit}`;
            })
            .join(", ");
          addNotifications([createSettingsUpdatedNotification(detail)]);
        }
        previousSettingsRef.current = settings;
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [settings, addNotifications, t]);

  const poolEntries = useMemo(() => {
    const map: Record<string, { count: number; label: string }> = {};
    data?.forEach((m) => {
      const isFallback = m.isUsingFallbackStratum === 1;
      const url = (isFallback ? m.fallbackStratumURL : m.stratumURL) ?? "";
      if (!url) return;
      if (!map[url]) map[url] = { count: 0, label: getPoolLabel(url) };
      map[url].count++;
    });
    return Object.entries(map);
  }, [data]);

  const deviceModelEntries = useMemo(() => {
    const map: Record<string, number> = {};
    data?.forEach((m) => {
      const model = m.deviceModel;
      if (!model) return;
      map[model] = (map[model] ?? 0) + 1;
    });
    return Object.entries(map);
  }, [data]);

  const alertCounts = useMemo(() => {
    let temp = 0;
    let fan = 0;
    let offline = 0;
    data?.forEach((m) => {
      if (Math.round(m.temp) > settings.tempThreshold) temp++;
      if (Math.round(m.fanspeed) > settings.fanThreshold) fan++;
      if (m.alive === false) offline++;
    });
    return { temp, fan, offline };
  }, [data, settings.tempThreshold, settings.fanThreshold]);

  const quickFilters: QuickFilters = useMemo(
    () => ({
      ...NO_QUICK_FILTERS,
      selectedPool,
      selectedDeviceModel,
      alertTemp,
      alertFan,
      alertOffline,
    }),
    [selectedPool, selectedDeviceModel, alertTemp, alertFan, alertOffline],
  );

  const filteredData = useMemo(() => {
    return data?.filter(
      (m) =>
        matchesQuickFilters(m, quickFilters, settings) &&
        matchesSearch(m, query),
    );
  }, [data, quickFilters, settings, query]);

  useEffect(() => {
    if (poolEntries.length === 1) setSelectedPool(poolEntries[0][0]);
    else if (poolEntries.length > 1) setSelectedPool(null);
  }, [poolEntries]);

  useEffect(() => {
    if (deviceModelEntries.length === 1) {
      setSelectedDeviceModel(deviceModelEntries[0][0]);
    } else if (deviceModelEntries.length > 1) {
      setSelectedDeviceModel(null);
    }
  }, [deviceModelEntries]);

  const gridContainerSx = (theme: Theme) => ({
    display: "grid",
    width: "100%",
    gridTemplateColumns: {
      xs: "repeat(1, 1fr)",
      md: "repeat(2, 1fr)",
      lg: "repeat(3, 1fr)",
    },
    columnGap: theme.spacing(3),
    rowGap: theme.spacing(3),
  });

  if (error instanceof ApiError && error.status === 403 && boardId) {
    return <BoardLockedPage boardId={boardId} hashboardUrl={hashboardUrl} />;
  }

  if (error instanceof ApiError && error.status === 404) {
    return (
      <OopsPage
        titleKey="oops.boardNotFound.title"
        messageKey="oops.boardNotFound.message"
      />
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {/* The two Collapse panels use their own inner "mt" for spacing
          instead of the header-group's `gap` -- a Collapse still occupies
          a gap slot on both sides even at 0 height, so relying on `gap`
          here would leave a stray double-gap whenever a panel is closed.
          A margin on the *inner* content only ever shows once the panel is
          actually open, since Collapse clips overflow while collapsed. */}
      <Box sx={{ display: "flex", flexDirection: "column" }}>
        <PageHeader
          title={t("dashboard.header.title")}
          description={t("dashboard.header.description")}
          icon={<DashboardIcon fontSize="large" />}
          gradientProps={{
            height: 3,
            radius: 2,
            colors: ["#00b4ff", "#0066cc"],
          }}
          actions={[
            <IconButton
              key="filters"
              size="small"
              onClick={toggleFilters}
              aria-label="filters"
            >
              <FilterAltIcon fontSize="small" />
            </IconButton>,
            <IconButton
              key="notification-settings"
              size="small"
              onClick={toggleSettings}
              aria-label="notification settings"
            >
              <SettingsIcon fontSize="small" />
            </IconButton>,
          ]}
          forceShowActions
        />

        <Collapse in={openPanel === "filters"}>
          <Box
            sx={{
              mt: 4,
              p: 2,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "background.paper",
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <SearchField />

            {poolEntries.length >= 1 && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                <Typography variant="caption" color="text.secondary">
                  {t("dashboard.filter.poolLabel")}
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                  {poolEntries.length > 1 && (
                    <Chip
                      size="small"
                      label={`${t("dashboard.filter.all")} (${data?.length ?? 0})`}
                      color={selectedPool === null ? "primary" : "default"}
                      variant={selectedPool === null ? "filled" : "outlined"}
                      onClick={() => setSelectedPool(null)}
                    />
                  )}
                  {poolEntries.map(([url, stats]) => (
                    <Tooltip key={url} title={url} arrow>
                      <Chip
                        size="small"
                        label={`${stats.label} (${stats.count})`}
                        color={selectedPool === url ? "primary" : "default"}
                        variant={selectedPool === url ? "filled" : "outlined"}
                        onClick={() =>
                          setSelectedPool(url === selectedPool ? null : url)
                        }
                      />
                    </Tooltip>
                  ))}
                </Box>
              </Box>
            )}

            {deviceModelEntries.length >= 1 && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                <Typography variant="caption" color="text.secondary">
                  {t("dashboard.filter.deviceLabel")}
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                  {deviceModelEntries.length > 1 && (
                    <Chip
                      size="small"
                      label={`${t("dashboard.filter.all")} (${data?.length ?? 0})`}
                      color={
                        selectedDeviceModel === null ? "primary" : "default"
                      }
                      variant={
                        selectedDeviceModel === null ? "filled" : "outlined"
                      }
                      onClick={() => setSelectedDeviceModel(null)}
                    />
                  )}
                  {deviceModelEntries.map(([model, count]) => (
                    <Chip
                      key={model}
                      size="small"
                      label={`${model} (${count})`}
                      color={
                        selectedDeviceModel === model ? "primary" : "default"
                      }
                      variant={
                        selectedDeviceModel === model ? "filled" : "outlined"
                      }
                      onClick={() =>
                        setSelectedDeviceModel(
                          model === selectedDeviceModel ? null : model,
                        )
                      }
                    />
                  ))}
                </Box>
              </Box>
            )}

            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
              <Typography variant="caption" color="text.secondary">
                {t("dashboard.filter.alertsLabel")}
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                <Chip
                  size="small"
                  label={`${t("dashboard.filter.highTemp", { value: settings.tempThreshold })} (${alertCounts.temp})`}
                  color={alertTemp ? "error" : "default"}
                  variant={alertTemp ? "filled" : "outlined"}
                  onClick={() => setAlertTemp((v) => !v)}
                />
                <Chip
                  size="small"
                  label={`${t("dashboard.filter.highFan", { value: settings.fanThreshold })} (${alertCounts.fan})`}
                  color={alertFan ? "error" : "default"}
                  variant={alertFan ? "filled" : "outlined"}
                  onClick={() => setAlertFan((v) => !v)}
                />
                <Chip
                  size="small"
                  label={`${t("dashboard.filter.offline")} (${alertCounts.offline})`}
                  color={alertOffline ? "error" : "default"}
                  variant={alertOffline ? "filled" : "outlined"}
                  onClick={() => setAlertOffline((v) => !v)}
                />
              </Box>
            </Box>
          </Box>
        </Collapse>

        <Collapse in={openPanel === "settings"}>
          <Box sx={{ mt: 4 }}>
            <NotificationSettingsPanel />
          </Box>
        </Collapse>
      </Box>

      <GlobalStats data={data} isLoading={isLoading} />

      {!isLoading && data && data.length > 0 && filteredData?.length === 0 ? (
        <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
          {t("dashboard.filter.noResults")}
        </Typography>
      ) : (
        <Grid container sx={gridContainerSx}>
          {(filteredData ?? []).map((miner, idx) => (
            <Box
              key={idx}
              sx={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
              }}
            >
              <MinerCard minerInfo={miner} loading={isLoading} error={error} />
            </Box>
          ))}
        </Grid>
      )}
    </Box>
  );
};
