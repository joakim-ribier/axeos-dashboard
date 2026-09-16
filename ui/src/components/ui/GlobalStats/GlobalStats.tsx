// src/components/ui/GlobalStats/GlobalStats.tsx
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import AirIcon from "@mui/icons-material/Air";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import EuroIcon from "@mui/icons-material/Euro";
import HardwareIcon from "@mui/icons-material/Hardware";
import RemoveIcon from "@mui/icons-material/Remove";
import SpeedIcon from "@mui/icons-material/Speed";
import ThermostatIcon from "@mui/icons-material/Thermostat";
import {
  Box,
  Skeleton,
  Stack,
  SvgIconProps,
  Tooltip,
  Typography,
} from "@mui/material";

import { formatMetric } from "@/utils/format";

import { STORAGE_KEY } from "./constants";
import { getTrend } from "./helpers";
import { GlobalStatsProps } from "./types";

/* ── KPI card ────────────────────────────────────────────────── */
interface KpiCardProps {
  icon: React.ReactElement<SvgIconProps>;
  value: React.ReactNode;
  subValue?: React.ReactNode;
  label: string;
  trend?: "up" | "down" | "neutral";
  showTrend?: boolean;
  loading?: boolean;
}

const KpiCard: React.FC<KpiCardProps> = ({
  icon,
  value,
  subValue,
  label,
  trend,
  showTrend = false,
  loading = false,
}) => (
  <Box
    sx={{
      flex: 1,
      minWidth: 120,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 0.5,
      p: 2,
      borderRadius: 2,
      backgroundColor: "background.paper",
    }}
  >
    {icon}
    {loading ? (
      <Skeleton width={80} height={32} />
    ) : (
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography sx={{ fontSize: "1.6rem", fontWeight: 700, lineHeight: 1 }}>
          {value}
        </Typography>
        {showTrend && trend === "up" && (
          <ArrowUpwardIcon fontSize="small" color="success" />
        )}
        {showTrend && trend === "down" && (
          <ArrowDownwardIcon fontSize="small" color="error" />
        )}
        {showTrend && trend === "neutral" && (
          <RemoveIcon fontSize="small" color="action" />
        )}
      </Stack>
    )}
    {subValue && !loading && (
      <Typography variant="caption" color="text.secondary">
        {subValue}
      </Typography>
    )}
    <Typography variant="caption" color="text.secondary" fontWeight={500}>
      {label}
    </Typography>
  </Box>
);

/* ── GlobalStats ─────────────────────────────────────────────── */
interface Snapshot {
  lastUpdated: string;
  hashRate: number;
  prevHashRate?: number;
  shares: number;
  prevShares?: number;
}

export const GlobalStats: React.FC<GlobalStatsProps> = ({
  data,
  isLoading,
}) => {
  const { t } = useTranslation();

  const [prevHashRate, setPrevHashRate] = useState<number | undefined>(
    undefined,
  );
  const [prevShares, setPrevShares] = useState<number | undefined>(undefined);

  /* computed */
  const lastUpdated = React.useMemo(() => {
    if (!data?.length) return undefined;
    const ts = data.map((m) => m.timestamp).filter(Boolean) as string[];
    return ts.length ? ts.reduce((a, b) => (a > b ? a : b)) : undefined;
  }, [data]);

  const totalHashRate = React.useMemo(
    () => data?.reduce((s, m) => s + (m.hashRateTHs ?? 0), 0) ?? 0,
    [data],
  );

  const totalShares = React.useMemo(
    () => data?.reduce((s, m) => s + (m.sharesAccepted ?? 0), 0) ?? 0,
    [data],
  );

  // Sums each miner's persistent, reboot-surviving cumulative total (falls
  // back to its live sharesAccepted for a miner whose totals.json hasn't
  // been written/backfilled yet) -- shown as a secondary figure alongside
  // the current-session totalShares above, since unlike it this one never
  // drops when a miner in the fleet reboots.
  const totalCumulativeShares = React.useMemo(
    () =>
      data?.reduce(
        (s, m) => s + (m.totalSharesAccepted ?? m.sharesAccepted ?? 0),
        0,
      ) ?? 0,
    [data],
  );

  const hashRange = React.useMemo(() => {
    const rates = (data ?? [])
      .map((m) => m.hashRateTHs)
      .filter((v): v is number => v !== undefined);
    if (!rates.length) return undefined;
    return { min: Math.min(...rates), max: Math.max(...rates) };
  }, [data]);

  const powerRange = React.useMemo(() => {
    const powers = (data ?? [])
      .map((m) => m.power)
      .filter((v): v is number => v !== undefined);
    if (!powers.length) return undefined;
    return { min: Math.min(...powers), max: Math.max(...powers) };
  }, [data]);

  const tempRange = React.useMemo(() => {
    const temps = (data ?? [])
      .map((m) => m.temp)
      .filter((v): v is number => v !== undefined);
    if (!temps.length) return undefined;
    return { min: Math.min(...temps), max: Math.max(...temps) };
  }, [data]);

  const maxFan = React.useMemo(() => {
    const fans = (data ?? [])
      .map((m) => m.fanspeed)
      .filter((v): v is number => v !== undefined);
    return fans.length ? Math.max(...fans) : undefined;
  }, [data]);

  const totalPower = React.useMemo(
    () => data?.reduce((s, m) => s + (m.power ?? 0), 0) ?? 0,
    [data],
  );

  const minerCount = data?.length ?? 0;

  const electricityRate =
    data?.find((m) => (m.electricityRatePerKwh ?? 0) > 0)
      ?.electricityRatePerKwh ?? 0;
  const costPerHour =
    electricityRate > 0 ? (totalPower / 1000) * electricityRate : 0;

  // Each miner's persistent, reboot-surviving cumulative cost (see
  // MinerInfo.totalElectricityCost) -- summed across the fleet for the
  // "since the beginning" figure, decoupled from today's instant rate above
  // so it still reflects real spend even after a rate change.
  const totalCumulativeCost = React.useMemo(
    () => data?.reduce((s, m) => s + (m.totalElectricityCost ?? 0), 0) ?? 0,
    [data],
  );

  /* trend via localStorage */
  useEffect(() => {
    if (!lastUpdated) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            lastUpdated,
            hashRate: totalHashRate,
            shares: totalShares,
          } satisfies Snapshot),
        );
        return;
      }
      const stored = JSON.parse(raw) as Snapshot;

      // Old format missing shares field → reinitialize
      if (stored.shares === undefined) {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            lastUpdated,
            hashRate: totalHashRate,
            shares: totalShares,
          } satisfies Snapshot),
        );
        return;
      }

      if (stored.lastUpdated === lastUpdated) {
        setPrevHashRate(stored.prevHashRate);
        setPrevShares(stored.prevShares);
      } else {
        setPrevHashRate(stored.hashRate);
        setPrevShares(stored.shares);
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            lastUpdated,
            hashRate: totalHashRate,
            prevHashRate: stored.hashRate,
            shares: totalShares,
            prevShares: stored.shares,
          } satisfies Snapshot),
        );
      }
    } catch {
      /* ignore */
    }
  }, [lastUpdated, totalHashRate, totalShares]);

  const hashTrend = getTrend(totalHashRate, prevHashRate);
  const sharesTrend = getTrend(totalShares, prevShares);

  /* temp/fan display */
  const tempValue =
    tempRange !== undefined
      ? tempRange.min === tempRange.max
        ? `${tempRange.min.toFixed(0)}°C`
        : `${tempRange.min.toFixed(0)}–${tempRange.max.toFixed(0)}°C`
      : "—";

  const hashSubValue =
    hashRange !== undefined ? (
      <Tooltip title={t("dashboard.stats.kpi.minMax")} arrow>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          {hashRange.min === hashRange.max ? (
            <span>{`${hashRange.min.toFixed(2)} TH/s`}</span>
          ) : (
            <>
              <ArrowDownwardIcon sx={{ fontSize: 10 }} />
              <span>{hashRange.min.toFixed(2)}</span>
              <span>·</span>
              <ArrowUpwardIcon sx={{ fontSize: 10 }} />
              <span>{`${hashRange.max.toFixed(2)} TH/s`}</span>
            </>
          )}
        </Stack>
      </Tooltip>
    ) : undefined;

  const powerSubValue =
    powerRange !== undefined ? (
      <Tooltip title={t("dashboard.stats.kpi.minMax")} arrow>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          {powerRange.min === powerRange.max ? (
            <span>{`${powerRange.min.toFixed(0)}W`}</span>
          ) : (
            <>
              <ArrowDownwardIcon sx={{ fontSize: 10 }} />
              <span>{powerRange.min.toFixed(0)}</span>
              <span>·</span>
              <ArrowUpwardIcon sx={{ fontSize: 10 }} />
              <span>{`${powerRange.max.toFixed(0)}W`}</span>
            </>
          )}
        </Stack>
      </Tooltip>
    ) : undefined;

  const fanSubValue =
    maxFan !== undefined ? (
      <Tooltip title={t("dashboard.stats.kpi.maxFan")} arrow>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <AirIcon sx={{ fontSize: 12 }} />
          <ArrowUpwardIcon sx={{ fontSize: 10 }} />
          <span>{`${maxFan.toFixed(0)}%`}</span>
        </Stack>
      </Tooltip>
    ) : undefined;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        {/* Perf */}
        <KpiCard
          icon={<SpeedIcon sx={{ color: "success.main", fontSize: 28 }} />}
          value={`${totalHashRate.toFixed(2)} TH/s`}
          subValue={hashSubValue}
          label={t("dashboard.stats.kpi.hashrate")}
          trend={hashTrend}
          showTrend={prevHashRate !== undefined}
          loading={isLoading}
        />
        <KpiCard
          icon={
            <CheckCircleOutlineIcon
              sx={{ color: "success.main", fontSize: 28 }}
            />
          }
          value={totalShares.toLocaleString()}
          subValue={t("dashboard.stats.kpi.allTime", {
            value: formatMetric(totalCumulativeShares),
          })}
          label={t("dashboard.stats.kpi.shares")}
          trend={sharesTrend}
          showTrend={prevShares !== undefined}
          loading={isLoading}
        />
        {/* Santé */}
        <KpiCard
          icon={<ThermostatIcon sx={{ color: "warning.main", fontSize: 28 }} />}
          value={tempValue}
          subValue={fanSubValue}
          label={t("dashboard.stats.kpi.tempFan")}
          loading={isLoading}
        />
        {/* Finance */}
        <KpiCard
          icon={<HardwareIcon sx={{ color: "primary.main", fontSize: 28 }} />}
          value={`${minerCount} · ${totalPower.toFixed(0)}W`}
          subValue={powerSubValue}
          label={t("dashboard.stats.kpi.miners")}
          loading={isLoading}
        />
        {costPerHour > 0 && (
          <KpiCard
            icon={<EuroIcon sx={{ color: "error.main", fontSize: 28 }} />}
            value={`${costPerHour.toFixed(2)}€/h`}
            subValue={
              totalCumulativeCost > 0 ? (
                <span>
                  {t("dashboard.stats.kpi.allTime", {
                    value: `${totalCumulativeCost.toFixed(2)}€`,
                  })}
                </span>
              ) : undefined
            }
            label={t("dashboard.stats.kpi.electricityCost")}
            loading={isLoading}
          />
        )}
      </Box>
    </Box>
  );
};
