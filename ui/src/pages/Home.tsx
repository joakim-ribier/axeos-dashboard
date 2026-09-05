// src/pages/Home.tsx
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import AirIcon from "@mui/icons-material/Air";
import CheckIcon from "@mui/icons-material/Check";
import DashboardIcon from "@mui/icons-material/Dashboard";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import SearchIcon from "@mui/icons-material/Search";
import SortByAlphaIcon from "@mui/icons-material/SortByAlpha";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import SystemUpdateAltIcon from "@mui/icons-material/SystemUpdateAlt";
import ThermostatIcon from "@mui/icons-material/Thermostat";
import UpdateIcon from "@mui/icons-material/Update";
import {
  Box,
  Button,
  Chip,
  Collapse,
  Grid,
  IconButton,
  InputBase,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Popover,
  Tooltip,
  Typography,
} from "@mui/material";
import { Theme } from "@mui/material/styles";

import { useMode } from "@/contexts/ModeContext";
import { useSearch } from "@/contexts/SearchContext";
import {
  type MinerSortKey,
  sortMiners,
  useMinerSort,
} from "@/hooks/useMinerSort";
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

/* ── Sort ────────────────────────────────────────────────────── */
const SORT_OPTIONS: { key: MinerSortKey; icon: React.ReactNode }[] = [
  { key: "oldest", icon: <UpdateIcon fontSize="small" /> },
  { key: "sharesAccepted", icon: <DoneAllIcon fontSize="small" /> },
  { key: "fan", icon: <AirIcon fontSize="small" /> },
  { key: "temp", icon: <ThermostatIcon fontSize="small" /> },
  { key: "pool", icon: <SortByAlphaIcon fontSize="small" /> },
];

const SortMenuButton = ({
  sort,
  onChange,
}: {
  sort: MinerSortKey;
  onChange: (sort: MinerSortKey) => void;
}) => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        color="inherit"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        startIcon={<SwapVertIcon fontSize="small" />}
        sx={{
          borderColor: "divider",
          color: "text.secondary",
          flexShrink: 0,
          whiteSpace: "nowrap",
          "&:hover": { borderColor: "primary.main", color: "primary.main" },
        }}
      >
        {t(`dashboard.sort.${sort}`)}
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
      >
        {SORT_OPTIONS.map((option) => (
          <MenuItem
            key={option.key}
            selected={option.key === sort}
            onClick={() => {
              onChange(option.key);
              setAnchorEl(null);
            }}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>{option.icon}</ListItemIcon>
            <ListItemText>{t(`dashboard.sort.${option.key}`)}</ListItemText>
            {option.key === sort && (
              <CheckIcon
                fontSize="small"
                sx={{ color: "primary.main", ml: 2 }}
              />
            )}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

/* ── Pool select ─────────────────────────────────────────────── */
interface PoolOption {
  url: string;
  label: string;
  count: number;
  hashRate: number;
}

const PoolSelectButton = ({
  options,
  totalCount,
  totalHashRate,
  selected,
  onChange,
}: {
  options: PoolOption[];
  totalCount: number;
  totalHashRate: number;
  selected: string | null;
  onChange: (url: string | null) => void;
}) => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const currentLabel =
    selected === null
      ? t("dashboard.filter.all")
      : (options.find((o) => o.url === selected)?.label ?? selected);

  const summary = (count: number, hashRate: number) =>
    `${count} ${t("dashboard.filter.miners")} · ${hashRate.toFixed(2)} TH/s`;

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        color="inherit"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        startIcon={<SystemUpdateAltIcon fontSize="small" />}
        sx={{
          borderColor: "divider",
          color: "text.secondary",
          flexShrink: 0,
          whiteSpace: "nowrap",
          maxWidth: 220,
          overflow: "hidden",
          textOverflow: "ellipsis",
          "&:hover": { borderColor: "primary.main", color: "primary.main" },
        }}
      >
        {currentLabel}
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
      >
        <MenuItem
          selected={selected === null}
          onClick={() => {
            onChange(null);
            setAnchorEl(null);
          }}
        >
          <ListItemText
            primary={t("dashboard.filter.all")}
            secondary={summary(totalCount, totalHashRate)}
          />
          {selected === null && (
            <CheckIcon
              fontSize="small"
              sx={{ color: "primary.main", ml: 2, flexShrink: 0 }}
            />
          )}
        </MenuItem>
        {options.map((option) => (
          <MenuItem
            key={option.url}
            selected={option.url === selected}
            onClick={() => {
              onChange(option.url);
              setAnchorEl(null);
            }}
          >
            <ListItemText
              primary={option.label}
              secondary={summary(option.count, option.hashRate)}
            />
            {option.url === selected && (
              <CheckIcon
                fontSize="small"
                sx={{ color: "primary.main", ml: 2, flexShrink: 0 }}
              />
            )}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

/* ── Home ────────────────────────────────────────────────────── */
export const Home = () => {
  const { t } = useTranslation();
  const { data, isLoading, error } = useMiners();
  const { hashboardUrl } = useAppInfo();
  const { boardId } = useMode();
  const { query } = useSearch();
  const { sort, setSort } = useMinerSort();

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
    const filtered = data?.filter(
      (m) => matchesQuickFilters(m, quickFilters) && matchesSearch(m, query),
    );
    return filtered && sortMiners(filtered, sort);
  }, [data, quickFilters, query, sort]);

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
      <PageHeader
        title={t("dashboard.header.title")}
        description={t("dashboard.header.description")}
        icon={<DashboardIcon fontSize="large" />}
        gradientProps={{
          height: 3,
          radius: 2,
          colors: ["#00b4ff", "#0066cc"],
        }}
      />

      <GlobalStats data={data} isLoading={isLoading} />

      {!isLoading && (
        // The Collapse panel below uses its own inner "mt" for spacing
        // instead of this group's `gap` -- a Collapse still occupies a gap
        // slot on both sides even at 0 height, so relying on `gap` here
        // would leave a stray double-gap when the panel is closed. A margin
        // on the *inner* content only ever shows once the panel is actually
        // open, since Collapse clips overflow while collapsed.
        <Box sx={{ display: "flex", flexDirection: "column" }}>
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 1.5,
            }}
          >
            {poolEntries.length > 1 && (
              <PoolSelectButton
                options={poolEntries.map(([url, stats]) => ({
                  url,
                  ...stats,
                }))}
                totalCount={data?.length ?? 0}
                totalHashRate={totalHashRate}
                selected={selectedPool}
                onChange={setSelectedPool}
              />
            )}
            <SortMenuButton sort={sort} onChange={setSort} />
            <Tooltip title={t("dashboard.filter.toggle")}>
              <IconButton
                size="small"
                onClick={toggleFilters}
                aria-label="filters"
                sx={{
                  border: "1px solid",
                  borderColor: filtersOpen ? "primary.main" : "divider",
                  color: filtersOpen ? "primary.main" : "text.secondary",
                  borderRadius: 1,
                }}
              >
                <FilterAltIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          <Collapse in={filtersOpen}>
            <Box
              sx={{
                mt: 2,
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
                <Box
                  sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}
                >
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
