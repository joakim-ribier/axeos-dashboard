// src/pages/Home.tsx
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import CloudIcon from "@mui/icons-material/Cloud";
import DashboardIcon from "@mui/icons-material/Dashboard";
import {
  Box,
  Chip,
  Grid,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { Theme, useTheme } from "@mui/material/styles";

import { GlobalStats } from "../components/ui/GlobalStats";
import { MinerCard } from "../components/ui/MinerCard/MinerCard";
import { OopsPage } from "../components/ui/OopsPage";
import { PageHeader } from "../components/ui/PageHeader";
import { useMode } from "@/contexts/ModeContext";
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

/* ── Home ────────────────────────────────────────────────────── */
export const Home = () => {
  const { t } = useTranslation();
  const { boardId } = useMode();
  const { data, isLoading, error } = useMiners();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [selectedPool, setSelectedPool] = useState<string | null>(null);

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
    if (!selectedPool) return data;
    return data?.filter((m) => {
      const isFallback = m.isUsingFallbackStratum === 1;
      const url = isFallback ? m.fallbackStratumURL : m.stratumURL;
      return url === selectedPool;
    });
  }, [data, selectedPool]);

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
        titleBadge={
          boardId ? (
            <Chip
              icon={<CloudIcon sx={{ fontSize: 13 }} />}
              label={
                isMobile
                  ? t("remote.badge")
                  : t("remote.badgeLong", { id: boardId.slice(0, 8) })
              }
              size="small"
              sx={{
                fontFamily: "monospace",
                fontSize: "0.7rem",
                fontWeight: 700,
                letterSpacing: "0.06em",
                borderRadius: 1,
                backgroundColor: "rgba(255,160,0,0.08)",
                color: "warning.main",
                border: "1px solid rgba(255,160,0,0.35)",
                boxShadow: "0 0 10px rgba(255,160,0,0.12)",
              }}
            />
          ) : undefined
        }
        gradientProps={{
          height: 3,
          radius: 2,
          colors: ["#00b4ff", "#0066cc"],
        }}
        actions={[]}
      />

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
    </Box>
  );
};
