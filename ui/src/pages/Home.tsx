// src/pages/Home.tsx
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import DashboardIcon from "@mui/icons-material/Dashboard";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import SearchIcon from "@mui/icons-material/Search";
import {
  Box,
  Chip,
  Collapse,
  Grid,
  IconButton,
  InputBase,
  Popover,
  Tooltip,
  Typography,
} from "@mui/material";
import { Theme, useTheme } from "@mui/material/styles";

import { useMode } from "@/contexts/ModeContext";
import { useSearch } from "@/contexts/SearchContext";
import {
  matchesQuickFilters,
  NO_QUICK_FILTERS,
  QuickFilters,
} from "@/utils/minerFilters";
import { matchesSearch } from "@/utils/minerSearch";

// Matches the server's hardcoded defaults (model.DefaultTempThreshold/
// DefaultFanThreshold) -- display-only here, filtering itself reads each
// miner's own `alerts` field (computed server-side), not these constants.
const TEMP_THRESHOLD = 62;
const FAN_THRESHOLD = 75;

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

/* ── Home ────────────────────────────────────────────────────── */
export const Home = () => {
  const { t } = useTranslation();
  const { data, isLoading, error } = useMiners();
  const { hashboardUrl } = useAppInfo();
  const { boardId } = useMode();
  const { query } = useSearch();

  const [selectedPool, setSelectedPool] = useState<string | null>(null);
  const [selectedDeviceModel, setSelectedDeviceModel] = useState<string | null>(
    null,
  );
  const [alertTemp, setAlertTemp] = useState(false);
  const [alertFan, setAlertFan] = useState(false);
  const [alertOffline, setAlertOffline] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const toggleFilters = () => setFiltersOpen((current) => !current);

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
      if (m.alerts?.some((a) => a.type === "tempHigh")) temp++;
      if (m.alerts?.some((a) => a.type === "fanHigh")) fan++;
      if (m.alive === false) offline++;
    });
    return { temp, fan, offline };
  }, [data]);

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
      (m) => matchesQuickFilters(m, quickFilters) && matchesSearch(m, query),
    );
  }, [data, quickFilters, query]);

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
      {/* The Collapse panel uses its own inner "mt" for spacing instead of
          the header-group's `gap` -- a Collapse still occupies a gap slot
          on both sides even at 0 height, so relying on `gap` here would
          leave a stray double-gap when the panel is closed. A margin on
          the *inner* content only ever shows once the panel is actually
          open, since Collapse clips overflow while collapsed. */}
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
          ]}
          forceShowActions
        />

        <Collapse in={filtersOpen}>
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
                  label={`${t("dashboard.filter.highTemp", { value: TEMP_THRESHOLD })} (${alertCounts.temp})`}
                  color={alertTemp ? "error" : "default"}
                  variant={alertTemp ? "filled" : "outlined"}
                  onClick={() => setAlertTemp((v) => !v)}
                />
                <Chip
                  size="small"
                  label={`${t("dashboard.filter.highFan", { value: FAN_THRESHOLD })} (${alertCounts.fan})`}
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
      </Box>

      <GlobalStats data={data} isLoading={isLoading} />

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
