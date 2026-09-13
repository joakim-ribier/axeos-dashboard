// src/components/ui/MinerCard/MinerCard.tsx
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RestartAltOutlined, VerifiedUserOutlined } from "@mui/icons-material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AirIcon from "@mui/icons-material/Air";
import BoltIcon from "@mui/icons-material/Bolt";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DiamondOutlinedIcon from "@mui/icons-material/DiamondOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import HistoryIcon from "@mui/icons-material/History";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PersonIcon from "@mui/icons-material/Person";
import ShowChartOutlined from "@mui/icons-material/ShowChartOutlined";
import SpeedIcon from "@mui/icons-material/Speed";
import SyncIcon from "@mui/icons-material/Sync";
import SyncAltIcon from "@mui/icons-material/SyncAlt";
import ThermostatIcon from "@mui/icons-material/Thermostat";
import {
  Alert,
  Box,
  Chip,
  Collapse,
  IconButton,
  Link,
  Skeleton,
  Snackbar,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useMinerAction } from "@/hooks/useMinerActions";
import { useUiFeatures } from "@/hooks/useMiners";
import { useMinerStats } from "@/hooks/useMinerStats";
import { MinerInfo } from "@/types/miner";
import {
  formatDuration,
  formatMetric,
  formatTimeOnly,
  formatTimestamp,
  parseGoDuration,
} from "@/utils/format";
import { displayName } from "@/utils/minerDisplay";

import { MinerActionMenu } from "./components/MinerActionMenu";
import { MinerTabPanel } from "./components/MinerTabPanel";
import { MinerStatsChart } from "./MinerStatsChart";

const EXCLUSIVE_FIELDS: Set<keyof MinerInfo> = new Set([
  "hashRateTHs",
  "responseTime",
]);

const DEFAULT_CHART_FIELDS: (keyof MinerInfo)[] = ["temp", "fanspeed"];

const TERMINAL_MONO_STACK =
  "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace";
// Matches hashboard.live's own TerminalCard component, mirrored in this
// project's docs site (docs/_sass/custom/custom.scss's
// .terminal-card-body) -- same near-black background, so the card's
// "output" section reads as the same on-brand terminal across the
// dashboard, hashboard, and the docs.
const TERMINAL_BODY_BG = "#0d1117";

// Fallback feeder interval (used both for flagging an uptime as "just
// started" and a feed timestamp as "stale") when the real feeder.interval
// isn't available -- a remote-viewed board never gets one
// (remote-dashboard-api's own /api/config/settings never populates
// readOnly.feederInterval, see RemoteAppSettings), since a remote board
// doesn't run a feeder of its own to have an interval for. 5 minutes
// comfortably covers the default 2m local interval plus one full poll
// cycle.
const FALLBACK_FEEDER_INTERVAL_SECONDS = 5 * 60;

// "# pool", "# firmware", ... -- a terminal-comment-style label above a
// section of the black content block, taking the place of a divider line
// to structure the card without adding one more visual element.
const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
    <Box
      sx={{
        flexShrink: 0,
        fontFamily: TERMINAL_MONO_STACK,
        fontSize: "0.875rem",
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "text.disabled",
      }}
    >
      <Box component="span" sx={{ opacity: 0.6, mr: 0.5 }}>
        #
      </Box>
      {children}
    </Box>
    <Box
      sx={{ flex: 1, height: "1px", backgroundColor: "rgba(255,255,255,0.12)" }}
    />
  </Box>
);

const extractHostname = (url: string): string => {
  try {
    return url.replace(/^[^:]+:\/\//, "").split(":")[0];
  } catch {
    return url;
  }
};

interface Props {
  minerInfo?: MinerInfo;
  loading?: boolean;
  error?: unknown;
}

export const MinerCard = ({ minerInfo, loading, error }: Props) => {
  const { ui } = useUiFeatures();
  const { t } = useTranslation();
  // Shares its cache entry with the Settings page's own useAppSettings()
  // call (same query key) -- no extra request just for this.
  const { data: appSettings } = useAppSettings();
  const feederIntervalSeconds =
    parseGoDuration(appSettings?.readOnly.feederInterval) / 1000 ||
    FALLBACK_FEEDER_INTERVAL_SECONDS;

  const {
    timestamp = "",
    uptimeSeconds,
    ip = "—",
    hostname,
    alias,
    deviceModel,
    alive,
    aliveCheckedAt,
    error: configError,
    version,
    latestVersion,
    updateAvailable,
    releaseURL,
    sharesAccepted,
    sharesRejected,
    blockFound,
    totalUptimeSeconds,
    totalSharesAccepted,
    responseTime,
    temp,
    fanspeed,
    bestDiff,
    hashRateTHs,
    power,
    energyJPerTh,
    stratumURL,
    stratumUser,
    stratumDashboardURL,
    fallbackStratumURL,
    fallbackStratumUser,
    fallbackStratumDashboardURL,
    isUsingFallbackStratum = 0,
  } = minerInfo || {};

  const name = displayName({ hostname, alias });

  // Captured in an effect rather than read directly during render
  // (Date.now() is impure) -- refreshed whenever minerInfo changes, which
  // is this card's natural refresh cadence for the staleness check below.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
  }, [minerInfo]);

  // A stalled feeder still leaves the health dot green (it pings the
  // device directly, not the feeder) -- this is the signal that catches
  // that case: the last successful write is more than 2 poll cycles old.
  const feedAgeSeconds =
    timestamp && now !== null
      ? (now - new Date(timestamp).getTime()) / 1000
      : null;
  const isFeedStale =
    feedAgeSeconds !== null && feedAgeSeconds > 2 * feederIntervalSeconds;

  const isFallback = isUsingFallbackStratum === 1;
  const poolURL = isFallback ? fallbackStratumURL : stratumURL;
  const poolUser = isFallback ? fallbackStratumUser : stratumUser;
  const poolDashboardURL = isFallback
    ? fallbackStratumDashboardURL
    : stratumDashboardURL;
  const inactivePoolURL = isFallback ? stratumURL : fallbackStratumURL;
  const inactivePoolDashboardURL = isFallback
    ? stratumDashboardURL
    : fallbackStratumDashboardURL;
  const poolHostname = poolURL ? extractHostname(poolURL) : "—";

  const [showPoolDetails, setShowPoolDetails] = useState(false);
  // Only one of these panels can be open at a time -- opening one closes
  // the other, rather than letting both take up space simultaneously.
  const [activePanel, setActivePanel] = useState<"chart" | "totals" | null>(
    null,
  );
  const showChart = activePanel === "chart";
  const [configErrorCopied, setConfigErrorCopied] = useState(false);
  const hasLoadedOnce = useRef(false);
  const [selectedChartFields, setSelectedChartFields] =
    useState<(keyof MinerInfo)[]>(DEFAULT_CHART_FIELDS);

  const [dialogConfig, setDialogConfig] = useState<{
    open: boolean;
    actionType: "restart" | "switchPool" | null;
    payload?: "primary" | "fallback";
  }>({ open: false, actionType: null });

  const handleFieldToggle = (field: keyof MinerInfo) => {
    const isExclusive = EXCLUSIVE_FIELDS.has(field);
    setSelectedChartFields((prev) => {
      if (isExclusive) {
        return prev.includes(field) ? [] : [field];
      }
      const prevWithoutExclusive = prev.filter((f) => !EXCLUSIVE_FIELDS.has(f));
      return prevWithoutExclusive.includes(field)
        ? prevWithoutExclusive.filter((f) => f !== field)
        : [...prevWithoutExclusive, field];
    });
  };

  const handleRestartClick = () =>
    setDialogConfig({ open: true, actionType: "restart" });

  const handleSwitchPoolClick = (poolTarget: "primary" | "fallback") =>
    setDialogConfig({
      open: true,
      actionType: "switchPool",
      payload: poolTarget,
    });

  const handleConfirmAction = () => {
    if (!dialogConfig.actionType || !ip || ip === "—") return;
    if (dialogConfig.actionType === "restart") restartMiner(ip);
    if (dialogConfig.actionType === "switchPool" && dialogConfig.payload)
      switchPool(ip, dialogConfig.payload);
    setDialogConfig({ open: false, actionType: null });
  };

  const {
    restartMiner,
    switchPool,
    isExecuting,
    error: actionError,
    clearError: clearActionError,
  } = useMinerAction();
  const {
    data: statsData,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useMinerStats(ip, showChart);

  useEffect(() => {
    if (showChart && !hasLoadedOnce.current) {
      hasLoadedOnce.current = true;
      const timer = setTimeout(() => {
        refetchStats().catch(console.error);
      }, 100);
      return () => clearTimeout(timer);
    }
    if (!showChart) hasLoadedOnce.current = false;
  }, [showChart, refetchStats]);

  const targetPool = isFallback ? "primary" : "fallback";

  const getDialogConfig = () => {
    switch (dialogConfig.actionType) {
      case "restart":
        return {
          title: t("miner.actions.restart.title"),
          description: t("miner.actions.restart.description", { ip }),
          actionLabel: t("miner.actions.restart.label"),
          actionColor: "info" as const,
        };
      case "switchPool": {
        const poolName =
          dialogConfig.payload === "primary"
            ? t("miner.actions.switchPool.primary")
            : t("miner.actions.switchPool.fallback");
        return {
          title: t("miner.actions.switchPool.title"),
          description: t("miner.actions.switchPool.description", {
            ip,
            pool: poolName,
          }),
          actionLabel: t("miner.actions.switchPool.label"),
          actionColor: "info" as const,
        };
      }
      default:
        return {
          title: "",
          description: "",
          actionLabel: "",
          actionColor: "warning" as const,
        };
    }
  };

  const dialogSettings = getDialogConfig();

  if (error) {
    return <Alert severity="error">{t("dashboard.error")}</Alert>;
  }

  const healthDot = (
    <Tooltip
      title={
        configError
          ? `${t("miner.error.macMismatch")} · ${configError}`
          : alive === undefined
            ? t("miner.health.unknown")
            : alive
              ? `${t("miner.health.alive")}${aliveCheckedAt ? ` · ${formatTimestamp(aliveCheckedAt)}` : ""}`
              : `${t("miner.health.unreachable")}${aliveCheckedAt ? ` · ${formatTimestamp(aliveCheckedAt)}` : ""}`
      }
      arrow
    >
      {/* Same rounded-square swatch as AlertBullet (see AlertList.tsx) --
          the shape hashboard.live itself uses for its own up/down status
          indicator, reused here (colored, not just decorative) so every
          status marker in the app reads the same way. */}
      <Box
        sx={{
          width: 10,
          height: 10,
          borderRadius: "3px",
          flexShrink: 0,
          backgroundColor: configError
            ? "#ff9800"
            : alive === undefined
              ? "rgba(255,255,255,0.2)"
              : alive
                ? "#66bb6a"
                : "#f44336",
          boxShadow: configError
            ? "0 0 6px #ff9800"
            : alive === true
              ? "0 0 6px #66bb6a"
              : alive === false
                ? "0 0 6px #f44336"
                : "none",
          // Unreachable is the one state that actually needs attention --
          // blink to draw the eye, rather than blend in as just another
          // static status swatch.
          ...(alive === false && {
            "@keyframes minerCardHealthBlink": {
              "0%, 49%": { opacity: 1 },
              "50%, 100%": { opacity: 0.25 },
            },
            animation: "minerCardHealthBlink 1s steps(1) infinite",
            "@media (prefers-reduced-motion: reduce)": {
              animation: "none",
            },
          }),
        }}
      />
    </Tooltip>
  );

  // "> _ ip" prompt -- as if the IP were the command you typed, and the
  // rest of the card (hashrate, shares, pool, ...) is that command's
  // output (see the black terminal-body block below). Lives in the card's
  // regular header, in the app's own usual colors (the accent blue for
  // the "> " glyph, matching .terminal-card-icon in docs/_sass/custom/
  // custom.scss) -- the green/black terminal look is reserved for the
  // output block itself. The IP stays clickable, opening the device's own
  // web UI, same affordance the old ip-as-title case already had.
  const promptLine = (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        minWidth: 0,
        fontFamily: TERMINAL_MONO_STACK,
        lineHeight: 1.2,
      }}
    >
      <Box
        component="span"
        aria-hidden="true"
        sx={{ color: "primary.main", fontWeight: 700 }}
      >
        &gt;
      </Box>
      {/* Static cursor -- no blink, keeps the prompt simple rather than
          gimmicky. */}
      <Box component="span" aria-hidden="true" sx={{ color: "primary.main" }}>
        _
      </Box>
      {healthDot}
      {ip !== "—" ? (
        <Link
          href={`http://${ip}`}
          target="_blank"
          rel="noopener noreferrer"
          underline="none"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.4,
            minWidth: 0,
            fontWeight: 700,
            fontSize: "1rem",
            color: "text.primary",
            borderRadius: 1,
            px: 0.5,
            mx: -0.5,
            transition: "background 0.15s ease, color 0.15s ease",
            "&:hover": {
              backgroundColor: "rgba(0,180,255,0.1)",
              color: "primary.main",
            },
          }}
          noWrap
        >
          {ip}
          <OpenInNewIcon sx={{ fontSize: 12, opacity: 0.7 }} />
        </Link>
      ) : (
        <Typography component="span" sx={{ fontWeight: 700, fontSize: "1rem" }}>
          {ip}
        </Typography>
      )}
    </Box>
  );

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderRadius: 2,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.08)",
        backgroundColor: (theme) => theme.palette.background.paper,
      }}
    >
      {/* Actions menu -- a tab flush against the card's own top-right
          corner (sharing its radius) rather than an inline icon lost
          among the title row's other text. */}
      <MinerActionMenu
        isFallback={isFallback}
        onSwitchPool={() => handleSwitchPoolClick(targetPool)}
        onRestart={handleRestartClick}
        isExecuting={isExecuting}
        switchPoolVisibility={ui.action.minerPoolSwitch}
        restartVisibility={ui.action.minerRestart}
      />
      {/* Title -- "> _ ip" in the app's usual colors, on the card's
          regular background. Just the identity/command lives here; the
          rest (hashrate, shares, pool, ...) is that command's "output",
          styled as an actual terminal below. Last-feed time sits at the
          other end of this same line -- it's about the prompt/command
          itself (when it last ran), not the alias/model line below. */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 0.75,
          pl: 2,
          pr: 6,
          pt: 2,
          pb: name || deviceModel ? 0.5 : 2,
        }}
      >
        <Box sx={{ minWidth: 0 }}>{promptLine}</Box>
        {timestamp && (
          <Tooltip
            title={t("miner.lastUpdate", {
              value: formatTimeOnly(timestamp),
            })}
            arrow
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.4,
                flexShrink: 0,
              }}
            >
              <SyncIcon
                sx={{
                  fontSize: 14,
                  color: isFeedStale ? "error.main" : "text.disabled",
                }}
              />
              <Typography
                noWrap
                sx={{
                  fontFamily: TERMINAL_MONO_STACK,
                  fontWeight: 700,
                  fontSize: "0.78rem",
                  color: isFeedStale ? "error.main" : "text.primary",
                }}
              >
                {formatTimeOnly(timestamp)}
              </Typography>
            </Box>
          </Tooltip>
        )}
      </Box>

      {/* "# alias · model" -- a terminal-comment-style line right under
          the prompt, so the identity stays anchored near the title
          instead of floating disconnected at the bottom. */}
      {(name || deviceModel) && (
        <Box sx={{ px: 2, pb: 1.5 }}>
          <Typography
            noWrap
            sx={{
              fontFamily: TERMINAL_MONO_STACK,
              fontSize: "0.78rem",
              color: "text.disabled",
              minWidth: 0,
            }}
          >
            # {[name, deviceModel].filter(Boolean).join(" · ")}
          </Typography>
        </Box>
      )}

      {/* Terminal body -- the "output" of the "> _ ip" command above,
          styled like hashboard.live's own TerminalCard (see
          docs/_sass/custom/custom.scss's .terminal-card-body): same
          near-black background as the docs/hashboard terminal card. */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          backgroundColor: TERMINAL_BODY_BG,
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            gap: 1.5,
            p: 2,
          }}
        >
          {/* Config error -- shown prominently, not buried in a hover tooltip */}
          {configError && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                backgroundColor: "rgba(255,152,0,0.08)",
                border: "1px solid rgba(255,152,0,0.25)",
                borderRadius: 1.5,
                px: 1,
                py: 0.5,
              }}
            >
              <ErrorOutlineIcon
                sx={{ fontSize: 16, color: "warning.main", flexShrink: 0 }}
              />
              <Typography
                variant="caption"
                sx={{
                  color: "warning.main",
                  flex: 1,
                  wordBreak: "break-word",
                  fontSize: "0.7rem",
                  lineHeight: 1.3,
                }}
              >
                {t("miner.error.macMismatch")}: {configError}
              </Typography>
              <Tooltip
                title={
                  configErrorCopied
                    ? t("miner.error.copied")
                    : t("miner.error.copy")
                }
              >
                <IconButton
                  size="small"
                  onClick={() => {
                    navigator.clipboard.writeText(configError).then(() => {
                      setConfigErrorCopied(true);
                      setTimeout(() => setConfigErrorCopied(false), 1500);
                    });
                  }}
                  sx={{ p: 0.25, flexShrink: 0 }}
                >
                  {configErrorCopied ? (
                    <CheckCircleIcon
                      sx={{ fontSize: 13, color: "success.main" }}
                    />
                  ) : (
                    <ContentCopyIcon sx={{ fontSize: 13 }} />
                  )}
                </IconButton>
              </Tooltip>
            </Box>
          )}

          {/* 2. Hashrate */}
          {loading ? (
            <Skeleton variant="text" width={180} height={48} />
          ) : (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
              }}
            >
              <SpeedIcon
                sx={{
                  color: (theme) => theme.palette.success.main,
                  fontSize: 32,
                }}
              />
              <Box
                sx={{
                  fontWeight: "bold",
                  color: (theme) => theme.palette.text.primary,
                  fontSize: "1.6rem",
                }}
              >
                {hashRateTHs !== undefined
                  ? t("miner.hashrate", { value: hashRateTHs.toFixed(2) })
                  : "—"}
              </Box>
              {bestDiff !== undefined && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontWeight: 400 }}
                >
                  ({t("miner.bestSession")} {formatMetric(bestDiff)})
                </Typography>
              )}
              {!!blockFound && (
                <Tooltip title={t("miner.blockFound.tooltip")} arrow>
                  <Chip
                    icon={
                      <DiamondOutlinedIcon
                        sx={{ fontSize: "14px !important" }}
                      />
                    }
                    label={t("miner.blockFound.label", { count: blockFound })}
                    size="small"
                    color="success"
                    sx={{ height: 22, fontSize: "0.7rem", borderRadius: 1 }}
                  />
                </Tooltip>
              )}
            </Box>
          )}

          {/* 3. Compact stats: shares | temp · fan */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Stack direction="row" spacing={0.75} alignItems="center">
              <CheckCircleIcon sx={{ color: "success.main", fontSize: 16 }} />
              <Typography variant="body2" fontWeight={500}>
                {sharesAccepted?.toLocaleString() ?? "—"}
              </Typography>
              <ErrorOutlineIcon sx={{ color: "error.main", fontSize: 16 }} />
              <Typography variant="body2" color="error.main">
                {sharesRejected?.toLocaleString() ?? "—"}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <ThermostatIcon sx={{ color: "warning.main", fontSize: 16 }} />
              <Typography variant="body2">
                {temp !== undefined ? `${temp.toFixed(0)}°C` : "—"}
              </Typography>
              <AirIcon sx={{ color: "primary.main", fontSize: 16 }} />
              <Typography variant="body2">
                {fanspeed !== undefined ? `${fanspeed.toFixed(0)}%` : "—"}
              </Typography>
            </Stack>
          </Box>

          {/* 3b. Power + efficiency */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Stack direction="row" spacing={0.75} alignItems="center">
              <BoltIcon sx={{ color: "warning.light", fontSize: 16 }} />
              <Typography variant="body2">
                {power !== undefined ? `${power.toFixed(1)} W` : "—"}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Typography variant="body2" color="text.secondary">
                {energyJPerTh !== undefined
                  ? `${energyJPerTh.toFixed(0)} J/TH`
                  : "—"}
              </Typography>
            </Stack>
          </Box>

          {/* 4. Pool */}
          <SectionLabel>{t("miner.sections.pool")}</SectionLabel>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  minWidth: 0,
                  flex: 1,
                }}
              >
                <SyncAltIcon
                  sx={{
                    color: isFallback ? "warning.main" : "success.main",
                    fontSize: 20,
                    flexShrink: 0,
                  }}
                />
                {poolDashboardURL ? (
                  <Tooltip title={t("miner.openPool")} arrow>
                    <Typography
                      component="a"
                      href={poolDashboardURL}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="body2"
                      noWrap
                      sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 0.4,
                        color: "primary.main",
                        fontWeight: 600,
                        textDecoration: "none",
                        borderRadius: 1,
                        px: 0.75,
                        py: 0.25,
                        mx: -0.75,
                        transition: "background 0.15s ease",
                        "&:hover": { backgroundColor: "rgba(0,180,255,0.1)" },
                      }}
                    >
                      {poolHostname}
                      <OpenInNewIcon
                        sx={{ fontSize: 11, opacity: 0.7, flexShrink: 0 }}
                      />
                    </Typography>
                  </Tooltip>
                ) : (
                  <Tooltip title={poolURL ?? ""} arrow>
                    <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                      {poolHostname}
                    </Typography>
                  </Tooltip>
                )}
                {typeof responseTime === "number" && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ flexShrink: 0 }}
                  >
                    ({responseTime.toFixed(0)} ms)
                  </Typography>
                )}
                <Chip
                  label={
                    isFallback ? t("miner.fallbackPool") : t("miner.mainPool")
                  }
                  size="small"
                  color={isFallback ? "warning" : "success"}
                  variant="outlined"
                  sx={{
                    height: 24,
                    fontSize: "0.8rem",
                    flexShrink: 0,
                    borderRadius: 1,
                  }}
                />
              </Box>
              <Tooltip
                title={
                  showPoolDetails ? t("common.collapse") : t("common.expand")
                }
              >
                <IconButton
                  onClick={() => setShowPoolDetails((p) => !p)}
                  size="small"
                  aria-label={
                    showPoolDetails
                      ? "collapse pool details"
                      : "expand pool details"
                  }
                >
                  <ExpandMoreIcon
                    sx={{
                      transition: "transform 0.2s",
                      transform: showPoolDetails
                        ? "rotate(180deg)"
                        : "rotate(0deg)",
                    }}
                  />
                </IconButton>
              </Tooltip>
            </Box>
            <Collapse
              in={showPoolDetails}
              timeout="auto"
              unmountOnExit
              sx={{ px: 1.5, overflow: "hidden" }}
            >
              <Stack spacing={0.5} sx={{ pt: 0.5, overflow: "hidden" }}>
                <Stack
                  direction="row"
                  spacing={0.5}
                  alignItems="center"
                  sx={{ minWidth: 0 }}
                >
                  <PersonIcon
                    sx={{
                      fontSize: 16,
                      color: "primary.main",
                      flexShrink: 0,
                    }}
                  />
                  <Typography
                    variant="body2"
                    fontWeight={500}
                    sx={{ wordBreak: "break-all" }}
                  >
                    {poolUser ?? "—"}
                  </Typography>
                </Stack>
                {inactivePoolURL && (
                  <Stack
                    direction="row"
                    spacing={0.5}
                    alignItems="center"
                    sx={{ minWidth: 0 }}
                  >
                    <SyncAltIcon
                      sx={{
                        fontSize: 16,
                        color: "text.disabled",
                        flexShrink: 0,
                      }}
                    />
                    <Typography
                      variant="body2"
                      color={
                        inactivePoolDashboardURL
                          ? "primary.main"
                          : "text.disabled"
                      }
                      noWrap
                      sx={{
                        flex: 1,
                        minWidth: 0,
                        fontWeight: inactivePoolDashboardURL ? 600 : 400,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 0.4,
                        ...(inactivePoolDashboardURL && {
                          textDecoration: "none",
                          borderRadius: 1,
                          px: 0.75,
                          py: 0.25,
                          mx: -0.75,
                          transition: "background 0.15s ease",
                          "&:hover": {
                            backgroundColor: "rgba(0,180,255,0.1)",
                          },
                          cursor: "pointer",
                        }),
                      }}
                      component={inactivePoolDashboardURL ? "a" : "span"}
                      href={inactivePoolDashboardURL ?? undefined}
                      target={inactivePoolDashboardURL ? "_blank" : undefined}
                      rel={
                        inactivePoolDashboardURL
                          ? "noopener noreferrer"
                          : undefined
                      }
                    >
                      {extractHostname(inactivePoolURL)}
                      {inactivePoolDashboardURL && (
                        <OpenInNewIcon
                          sx={{ fontSize: 11, opacity: 0.7, flexShrink: 0 }}
                        />
                      )}
                    </Typography>
                    <Chip
                      label={
                        isFallback
                          ? t("miner.mainPool")
                          : t("miner.fallbackPool")
                      }
                      size="small"
                      color={isFallback ? "success" : "warning"}
                      variant="outlined"
                      sx={{ height: 24, fontSize: "0.8rem", borderRadius: 1 }}
                    />
                  </Stack>
                )}
              </Stack>
            </Collapse>
          </Box>

          {/* 7. Chart / Cumulative totals tabs -- content grows directly out
             of whichever tab is selected (see MinerTabPanel). */}
          <SectionLabel>{t("miner.sections.stats")}</SectionLabel>
          <MinerTabPanel
            active={activePanel}
            onSelect={(key) =>
              setActivePanel((p) =>
                p === key ? null : (key as "chart" | "totals"),
              )
            }
            tabs={[
              {
                key: "chart",
                icon: <ShowChartOutlined sx={{ fontSize: 16 }} />,
                label: t("miner.statsTimeline"),
                content: (
                  <MinerStatsChart
                    data={statsData || []}
                    isLoading={statsLoading}
                    selectedFields={selectedChartFields}
                    onFieldToggle={handleFieldToggle}
                    maxHeight={180}
                  />
                ),
              },
              ...(totalUptimeSeconds !== undefined ||
              totalSharesAccepted !== undefined
                ? [
                    {
                      key: "totals",
                      icon: <HistoryIcon sx={{ fontSize: 16 }} />,
                      label: t("miner.totalsLabel"),
                      content: (
                        <Stack direction="row" sx={{ width: "100%" }}>
                          {totalUptimeSeconds !== undefined && (
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                              sx={{ flex: 1 }}
                            >
                              <RestartAltOutlined
                                sx={{ color: "text.secondary", fontSize: 22 }}
                              />
                              <Box>
                                <Typography variant="body1" fontWeight={600}>
                                  {formatDuration(totalUptimeSeconds * 1000)}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {t("miner.totalUptimeLabel")}
                                </Typography>
                              </Box>
                            </Stack>
                          )}
                          {totalSharesAccepted !== undefined && (
                            <Tooltip
                              title={totalSharesAccepted.toLocaleString()}
                              arrow
                            >
                              <Stack
                                direction="row"
                                spacing={1}
                                alignItems="center"
                                sx={{ flex: 1 }}
                              >
                                <CheckCircleIcon
                                  sx={{ color: "success.main", fontSize: 22 }}
                                />
                                <Box>
                                  <Typography variant="body1" fontWeight={600}>
                                    {formatMetric(totalSharesAccepted)}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    {t("miner.totalSharesLabel")}
                                  </Typography>
                                </Box>
                              </Stack>
                            </Tooltip>
                          )}
                        </Stack>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </Box>

        {/* Uptime/firmware -- a status strip glued to the terminal's own
            bottom edge, like a real terminal's status bar. */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 1,
            px: 2,
            py: 1,
            borderTop: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {uptimeSeconds !== undefined ? (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                color:
                  uptimeSeconds < feederIntervalSeconds
                    ? "error.main"
                    : "text.secondary",
              }}
            >
              <AccessTimeIcon sx={{ fontSize: 16 }} />
              <Typography variant="body2" sx={{ color: "inherit" }}>
                {formatDuration(uptimeSeconds * 1000)}
              </Typography>
            </Box>
          ) : (
            <Typography variant="body2" color="text.disabled">
              —
            </Typography>
          )}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                color: "text.secondary",
              }}
            >
              <VerifiedUserOutlined sx={{ fontSize: 16 }} />
              <Typography variant="body2" sx={{ color: "inherit" }}>
                {version ?? "—"}
              </Typography>
            </Box>
            {updateAvailable && (
              <Tooltip
                title={
                  latestVersion
                    ? `${latestVersion} ${t("miner.updateAvailable")}`
                    : t("miner.updateAvailable")
                }
                arrow
              >
                <Chip
                  label={
                    latestVersion
                      ? `↑ ${latestVersion}`
                      : t("miner.updateAvailable")
                  }
                  size="small"
                  color="warning"
                  clickable={!!releaseURL}
                  {...(releaseURL
                    ? {
                        component: "a",
                        href: releaseURL,
                        target: "_blank",
                        rel: "noopener noreferrer",
                      }
                    : {})}
                  sx={{ height: 24, fontSize: "0.8rem", borderRadius: 1 }}
                />
              </Tooltip>
            )}
          </Box>
        </Box>
      </Box>

      <ConfirmDialog
        open={dialogConfig.open}
        onClose={() => setDialogConfig({ open: false, actionType: null })}
        onConfirm={handleConfirmAction}
        title={dialogSettings.title}
        description={dialogSettings.description}
        actionLabel={dialogSettings.actionLabel}
        actionColor={dialogSettings.actionColor}
      />

      <Snackbar
        open={actionError !== null}
        autoHideDuration={5000}
        onClose={clearActionError}
        message={actionError ?? ""}
      />
    </Box>
  );
};
