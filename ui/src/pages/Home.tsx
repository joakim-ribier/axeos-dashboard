// src/pages/Home.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import DashboardIcon from "@mui/icons-material/Dashboard";
import { Box, Grid, Tooltip, Typography } from "@mui/material";
import { Theme, useTheme } from "@mui/material/styles";

import { useMode } from "@/contexts/ModeContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useSearch } from "@/contexts/SearchContext";
import {
  detectNotifications,
  loadMinerSnapshot,
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

/* ── Home ────────────────────────────────────────────────────── */
export const Home = () => {
  const { t } = useTranslation();
  const { data, isLoading, error } = useMiners();
  const { boardId } = useMode();
  const { query } = useSearch();
  const { addNotifications } = useNotifications();

  const [selectedPool, setSelectedPool] = useState<string | null>(null);

  // Seeded from localStorage rather than starting undefined every mount —
  // otherwise a plain page reload would look like "the very first fetch
  // ever" and re-notify for anything already in a bad state (see
  // detectNotifications' neutral-baseline behavior).
  const previousDataRef = useRef<typeof data>(loadMinerSnapshot(boardId));
  useEffect(() => {
    if (!data) return;
    const newNotifications = detectNotifications(previousDataRef.current, data);
    if (newNotifications.length > 0) addNotifications(newNotifications);
    previousDataRef.current = data;
    saveMinerSnapshot(boardId, data);
  }, [data, addNotifications, boardId]);

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
