// src/components/ui/MinerCard/MinerCard.tsx
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RestartAltOutlined, VerifiedUserOutlined } from "@mui/icons-material";
import AirIcon from "@mui/icons-material/Air";
import BoltIcon from "@mui/icons-material/Bolt";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DiamondOutlinedIcon from "@mui/icons-material/DiamondOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PersonIcon from "@mui/icons-material/Person";
import SpeedIcon from "@mui/icons-material/Speed";
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
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useMode } from "@/contexts/ModeContext";
import { useMinerAction } from "@/hooks/useMinerActions";
import { useMinerStats } from "@/hooks/useMinerStats";
import { MinerInfo } from "@/types/miner";
import { formatDuration, formatMetric, formatTimestamp } from "@/utils/format";

import { MinerActionBar } from "./components/MinerActionBar";
import { MinerStatsChart } from "./MinerStatsChart";

const EXCLUSIVE_FIELDS: Set<keyof MinerInfo> = new Set([
  "hashRateTHs",
  "responseTime",
]);

const DEFAULT_CHART_FIELDS: (keyof MinerInfo)[] = ["temp", "fanspeed"];

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
  const { isRemote } = useMode();
  const { t } = useTranslation();

  const {
    timestamp = "",
    uptimeSeconds,
    ip = "—",
    hostname,
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
  const [showChart, setShowChart] = useState(false);
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

  const { restartMiner, switchPool, isExecuting } = useMinerAction();
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

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderRadius: 2,
        overflow: "hidden",
        backgroundColor: (theme) => theme.palette.background.paper,
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
          p: 2,
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        {/* 1. Header: hostname · model | timestamp */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          {/* Left: dot + name */}
          <Stack
            direction="row"
            spacing={0.75}
            alignItems="flex-start"
            sx={{ minWidth: 0, flex: 1 }}
          >
            {/* Health dot — wrapper matches first-line height so dot centers naturally */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                height: "1.2rem",
                flexShrink: 0,
              }}
            >
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
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
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
                  }}
                />
              </Tooltip>
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              {/* Row 1: hostname */}
              {hostname ? (
                <Typography
                  variant="subtitle1"
                  fontWeight={700}
                  sx={{ lineHeight: 1.2 }}
                  noWrap
                >
                  {hostname}
                </Typography>
              ) : ip !== "—" ? (
                <Link
                  href={`http://${ip}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  underline="none"
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.4,
                    fontWeight: 700,
                    fontSize: "1rem",
                    lineHeight: 1.2,
                    color: "primary.main",
                    borderRadius: 1,
                    px: 0.5,
                    mx: -0.5,
                    transition: "background 0.15s ease",
                    "&:hover": { backgroundColor: "rgba(0,180,255,0.1)" },
                  }}
                  noWrap
                >
                  {ip}
                  <OpenInNewIcon sx={{ fontSize: 12, opacity: 0.7 }} />
                </Link>
              ) : (
                <Typography
                  variant="subtitle1"
                  fontWeight={700}
                  sx={{ lineHeight: 1.2 }}
                  noWrap
                >
                  {ip}
                </Typography>
              )}
              {/* Row 2: timestamp */}
              {timestamp && (
                <Typography
                  variant="caption"
                  color="text.disabled"
                  sx={{ fontSize: "0.6rem" }}
                >
                  {formatTimestamp(timestamp)}
                </Typography>
              )}
            </Box>
          </Stack>
          {/* Right: model chip + IP */}
          <Stack
            alignItems="flex-end"
            spacing={0.4}
            sx={{ flexShrink: 0, ml: 1 }}
          >
            {deviceModel && (
              <Chip
                label={deviceModel}
                size="small"
                variant="outlined"
                sx={{ height: 16, fontSize: "0.6rem", borderRadius: 1 }}
              />
            )}
            {hostname && ip !== "—" && (
              <Link
                href={`http://${ip}`}
                target="_blank"
                rel="noopener noreferrer"
                underline="none"
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.3,
                  fontSize: "0.6rem",
                  color: "primary.main",
                  borderRadius: 1,
                  px: 0.4,
                  mx: -0.4,
                  transition: "background 0.15s ease",
                  "&:hover": { backgroundColor: "rgba(0,180,255,0.1)" },
                }}
              >
                {ip}
                <OpenInNewIcon sx={{ fontSize: 9, opacity: 0.7 }} />
              </Link>
            )}
          </Stack>
        </Box>

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
                    <DiamondOutlinedIcon sx={{ fontSize: "14px !important" }} />
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
                  height: 20,
                  fontSize: "0.65rem",
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
                  sx={{ fontSize: 16, color: "primary.main", flexShrink: 0 }}
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
                    sx={{ fontSize: 16, color: "text.disabled", flexShrink: 0 }}
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
                        "&:hover": { backgroundColor: "rgba(0,180,255,0.1)" },
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
                      isFallback ? t("miner.mainPool") : t("miner.fallbackPool")
                    }
                    size="small"
                    color={isFallback ? "success" : "warning"}
                    variant="outlined"
                    sx={{ height: 20, fontSize: "0.65rem", borderRadius: 1 }}
                  />
                </Stack>
              )}
            </Stack>
          </Collapse>
        </Box>

        {/* 5. Footer: uptime + version */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {uptimeSeconds !== undefined ? (
            <Chip
              icon={<RestartAltOutlined sx={{ fontSize: "14px !important" }} />}
              label={formatDuration(uptimeSeconds * 1000)}
              size="small"
              color={
                uptimeSeconds < 3600
                  ? "warning"
                  : uptimeSeconds >= 86400
                    ? "success"
                    : "default"
              }
              variant="outlined"
              sx={{ height: 22, fontSize: "0.7rem", borderRadius: 1 }}
            />
          ) : (
            <Typography variant="caption" color="text.disabled">
              —
            </Typography>
          )}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Chip
              icon={
                <VerifiedUserOutlined sx={{ fontSize: "14px !important" }} />
              }
              label={version ?? "—"}
              size="small"
              variant="outlined"
              color={updateAvailable ? "warning" : "default"}
              sx={{ height: 22, fontSize: "0.7rem", borderRadius: 1 }}
            />
            {updateAvailable && (
              <Tooltip
                title={
                  latestVersion
                    ? `v${latestVersion} ${t("miner.updateAvailable")}`
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
                  sx={{ height: 22, fontSize: "0.7rem", borderRadius: 1 }}
                />
              </Tooltip>
            )}
          </Box>
        </Box>

        {/* 6. Actions */}
        <MinerActionBar
          isFallback={isFallback}
          onSwitchPool={() => handleSwitchPoolClick(targetPool)}
          onRestart={handleRestartClick}
          isExecuting={isExecuting}
          showChart={showChart}
          onToggleChart={() => setShowChart((p) => !p)}
          readOnly={isRemote}
        />

        {/* 7. Chart */}
        <Collapse in={showChart} timeout="auto" unmountOnExit>
          <Box sx={{ mt: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {t("miner.statsTimeline")}
            </Typography>
            <MinerStatsChart
              data={statsData || []}
              isLoading={statsLoading}
              selectedFields={selectedChartFields}
              onFieldToggle={handleFieldToggle}
              maxHeight={180}
            />
          </Box>
        </Collapse>
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
    </Box>
  );
};
