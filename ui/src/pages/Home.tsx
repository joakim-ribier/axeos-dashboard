// src/pages/Home.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import DashboardIcon from "@mui/icons-material/Dashboard";
import SettingsIcon from "@mui/icons-material/Settings";
import {
  Box,
  Collapse,
  FormControlLabel,
  Grid,
  IconButton,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { Theme, useTheme } from "@mui/material/styles";

import { useMode } from "@/contexts/ModeContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useNotificationSettings } from "@/contexts/NotificationSettingsContext";
import { useSearch } from "@/contexts/SearchContext";
import {
  createSettingsUpdatedNotification,
  detectNotifications,
  diffNotificationSettings,
  loadMinerSnapshot,
  NotificationSettings,
  saveMinerSnapshot,
} from "@/utils/minerNotifications";
import { matchesSearch } from "@/utils/minerSearch";

import { GlobalStats } from "../components/ui/GlobalStats";
import { MinerCard } from "../components/ui/MinerCard/MinerCard";
import { OopsPage } from "../components/ui/OopsPage";
import { PageHeader } from "../components/ui/PageHeader";
import { ApiError, useMiners } from "../hooks/useMiners";

const getPoolLabel = (url: string): string => {
  try {
    return url.replace(/^[^:]+:\/\//, "").split(":")[0];
  } catch {
    return url;
  }
};

/* ── Pool filter card ────────────────────────────────────────── */
interface PoolCardProps {
  label: string;
  count: number;
  hashRate?: number;
  isActive: boolean;
  tooltip?: string;
  onClick: () => void;
}

const PoolCard = ({
  label,
  count,
  hashRate,
  isActive,
  tooltip,
  onClick,
}: PoolCardProps) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const primary = theme.palette.primary.main;

  const card = (
    <Box
      onClick={onClick}
      sx={{
        cursor: "pointer",
        px: 2,
        py: 1.5,
        borderRadius: 2,
        border: "1px solid",
        borderColor: isActive ? primary : "divider",
        backgroundColor: isActive ? `${primary}14` : "background.paper",
        boxShadow: isActive ? `0 0 16px ${primary}28` : "none",
        transition: "all 0.2s ease",
        minWidth: { xs: 120, sm: 140 },
        maxWidth: { xs: 160, sm: 200 },
        flexShrink: 0,
        overflow: "hidden",
        userSelect: "none",
        "&:hover": {
          borderColor: primary,
          backgroundColor: `${primary}0a`,
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          gap: 1,
          mb: 0.5,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            fontWeight: 700,
            color: isActive ? primary : "text.secondary",
            lineHeight: 1,
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </Typography>
        {isActive && (
          <Box
            sx={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: primary,
              boxShadow: `0 0 6px ${primary}`,
              flexShrink: 0,
              mt: 0.25,
            }}
          />
        )}
      </Box>
      <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.3 }}>
        {count}
        <Typography
          component="span"
          variant="caption"
          color="text.secondary"
          sx={{ ml: 0.5 }}
        >
          {t("dashboard.filter.miners")}
        </Typography>
      </Typography>
      {hashRate !== undefined && (
        <Typography variant="caption" color="text.secondary">
          {hashRate.toFixed(2)} TH/s
        </Typography>
      )}
    </Box>
  );

  return tooltip ? (
    <Tooltip title={tooltip} arrow>
      {card}
    </Tooltip>
  ) : (
    card
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
  const { boardId } = useMode();
  const { query } = useSearch();
  const { addNotifications } = useNotifications();
  const { settings } = useNotificationSettings();

  const [selectedPool, setSelectedPool] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
    const map: Record<
      string,
      { count: number; hashRate: number; label: string }
    > = {};
    data?.forEach((m) => {
      const isFallback = m.isUsingFallbackStratum === 1;
      const url = (isFallback ? m.fallbackStratumURL : m.stratumURL) ?? "";
      if (!url) return;
      if (!map[url])
        map[url] = { count: 0, hashRate: 0, label: getPoolLabel(url) };
      map[url].count++;
      map[url].hashRate += m.hashRateTHs ?? 0;
    });
    return Object.entries(map);
  }, [data]);

  const totalHashRate = useMemo(
    () => data?.reduce((s, m) => s + (m.hashRateTHs ?? 0), 0) ?? 0,
    [data],
  );

  const filteredData = useMemo(() => {
    return data?.filter((m) => {
      if (selectedPool) {
        const isFallback = m.isUsingFallbackStratum === 1;
        const url = isFallback ? m.fallbackStratumURL : m.stratumURL;
        if (url !== selectedPool) return false;
      }
      return matchesSearch(m, query);
    });
  }, [data, selectedPool, query]);

  useEffect(() => {
    if (poolEntries.length === 1) setSelectedPool(poolEntries[0][0]);
    else if (poolEntries.length > 1) setSelectedPool(null);
  }, [poolEntries]);

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
            key="notification-settings"
            size="small"
            onClick={() => setSettingsOpen((open) => !open)}
            aria-label="notification settings"
          >
            <SettingsIcon fontSize="small" />
          </IconButton>,
        ]}
        forceShowActions
      />

      <Collapse in={settingsOpen}>
        <NotificationSettingsPanel />
      </Collapse>

      <GlobalStats data={data} isLoading={isLoading} />

      {/* Pool filter cards */}
      {!isLoading && poolEntries.length >= 1 && (
        <Box
          sx={{
            display: "flex",
            gap: 1.5,
            overflowX: "auto",
            pb: 0.5,
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            "&::-webkit-scrollbar": { display: "none" },
          }}
        >
          {poolEntries.length > 1 && (
            <PoolCard
              label={t("dashboard.filter.all")}
              count={data?.length ?? 0}
              hashRate={totalHashRate}
              isActive={selectedPool === null}
              onClick={() => setSelectedPool(null)}
            />
          )}
          {poolEntries.map(([url, stats]) => (
            <PoolCard
              key={url}
              label={stats.label}
              count={stats.count}
              hashRate={stats.hashRate}
              isActive={selectedPool === url}
              tooltip={url}
              onClick={() => setSelectedPool(url === selectedPool ? null : url)}
            />
          ))}
        </Box>
      )}

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
