// src/pages/Home.tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import DashboardIcon from "@mui/icons-material/Dashboard";
import { Box, Typography, useMediaQuery, useTheme } from "@mui/material";

import { MinerDrawer } from "@/components/dashboard/drawer/MinerDrawer";
import {
  poolSegments,
  statusSegments,
} from "@/components/dashboard/fleet/breakdowns";
import { BreakdownStrip } from "@/components/dashboard/fleet/BreakdownStrip";
import { FleetSummary } from "@/components/dashboard/fleet/FleetSummary";
import { MinerList } from "@/components/dashboard/miners/MinerList";
import { MinerTiles } from "@/components/dashboard/miners/MinerTiles";
import {
  MINER_VIEWS,
  MinerToolbar,
} from "@/components/dashboard/toolbar/MinerToolbar";
import { AlertList } from "@/components/ui/AlertList";
import { BoardLockedPage } from "@/components/ui/BoardLockedPage";
import { OopsPage } from "@/components/ui/OopsPage";
import { PageHeader } from "@/components/ui/PageHeader";
import { useMode } from "@/contexts/ModeContext";
import { useSearch } from "@/contexts/SearchContext";
import { ApiError, useAppInfo, useMiners } from "@/hooks/useMiners";
import { useMinersHistory } from "@/hooks/useMinersHistory";
import { sortMiners, useMinerSort } from "@/hooks/useMinerSort";
import { useMinerStatus } from "@/hooks/useMinerStatus";
import { useStoredChoice } from "@/hooks/useStoredChoice";
import { type Miner } from "@/schemas/minerSchema";
import {
  matchesQuickFilters,
  NO_QUICK_FILTERS,
  type QuickFilters,
} from "@/utils/minerFilters";
import { matchesSearch } from "@/utils/minerSearch";
import { type MinerStatus } from "@/utils/minerStatus";

/** [value, number of miners] pairs, most common first. */
const countBy = (miners: Miner[], key: (m: Miner) => string | undefined) => {
  const counts = new Map<string, number>();
  miners.forEach((m) => {
    const value = key(m);
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  });
  return [...counts].sort((a, b) => b[1] - a[1]);
};

export const Home = () => {
  const { t } = useTranslation();
  const { data, devices, isLoading, error } = useMiners();
  const { data: history } = useMinersHistory();
  const { hashboardUrl } = useAppInfo();
  const { boardId, isRemoteBackend } = useMode();
  const { query } = useSearch();
  const [sort, setSort] = useMinerSort();
  const { statusOf, isStale } = useMinerStatus();
  const [view, setView] = useStoredChoice(
    "axeos.minerView",
    MINER_VIEWS,
    "list",
  );
  // The list's columns don't fit a phone -- tiles there, whatever the
  // remembered choice for wider screens.
  const isNarrow = useMediaQuery(useTheme().breakpoints.down("md"), {
    noSsr: true,
  });
  const [filters, setFilters] = useState<QuickFilters>(NO_QUICK_FILTERS);
  // Kept apart from the open flag so the panel still shows its miner while
  // it slides out.
  const [selectedIp, setSelectedIp] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (
    error instanceof ApiError &&
    error.status === 403 &&
    boardId &&
    isRemoteBackend
  ) {
    return <BoardLockedPage boardId={boardId} hashboardUrl={hashboardUrl} />;
  }

  if (error instanceof ApiError && error.status === 404) {
    return (
      <OopsPage
        titleKey="oops.notFound.title"
        messageKey="oops.notFound.message"
      />
    );
  }

  const miners = data ?? [];
  const setFilter = <K extends keyof QuickFilters>(
    key: K,
    value: QuickFilters[K],
  ) => setFilters((f) => ({ ...f, [key]: value }));

  const shown = sortMiners(
    miners.filter(
      (m) =>
        matchesQuickFilters(m, statusOf(m), filters) && matchesSearch(m, query),
    ),
    sort,
    statusOf,
  );
  const selected = miners.find((m) => m.ip === selectedIp);
  const openMiner = (ip: string) => {
    setSelectedIp(ip);
    setDrawerOpen(true);
  };
  const hashRateHistory = new Map(
    history?.miners.map((h) => [h.ip, h.hashRate]),
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
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

      {error && !data ? (
        <AlertList severity="error" items={[t("dashboard.error")]} />
      ) : isLoading ? null : miners.length === 0 ? (
        <AlertList severity="warning" items={[t("dashboard.noData")]} />
      ) : (
        <>
          <FleetSummary
            miners={miners}
            devices={devices}
            history={history}
            isStale={isStale}
            statusOf={statusOf}
            onOpen={openMiner}
          />

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "minmax(0,1fr)",
                md: "repeat(2, minmax(0,1fr))",
              },
              gap: 2,
            }}
          >
            <BreakdownStrip
              icon="status"
              title={t("dashboard.breakdown.status")}
              hint={t("dashboard.breakdown.statusHint", {
                count: miners.length,
              })}
              segments={statusSegments(miners, statusOf, t)}
              selected={filters.selectedStatus}
              onSelect={(s) =>
                setFilter("selectedStatus", s as MinerStatus | null)
              }
            />
            <BreakdownStrip
              icon="pools"
              title={t("dashboard.breakdown.pools")}
              hint={t("dashboard.breakdown.poolsHint")}
              segments={poolSegments(miners)}
              selected={filters.selectedPool}
              onSelect={(url) => setFilter("selectedPool", url)}
            />
          </Box>

          <MinerToolbar
            sort={sort}
            onSortChange={setSort}
            view={view}
            onViewChange={setView}
            models={countBy(miners, (m) => m.deviceModel)}
            versions={countBy(miners, (m) => m.version)}
            filters={filters}
            onFilterChange={setFilter}
            shown={shown.length}
            total={miners.length}
          />

          {shown.length === 0 ? (
            <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
              {t("dashboard.toolbar.noResults")}
            </Typography>
          ) : view === "list" && !isNarrow ? (
            <MinerList
              miners={shown}
              statusOf={statusOf}
              hashRateHistory={hashRateHistory}
              onOpen={openMiner}
            />
          ) : (
            <MinerTiles
              miners={shown}
              statusOf={statusOf}
              hashRateHistory={hashRateHistory}
              onOpen={openMiner}
            />
          )}
        </>
      )}

      <MinerDrawer
        open={drawerOpen}
        miner={selected}
        status={selected && statusOf(selected)}
        hashRateHistory={
          selectedIp ? hashRateHistory.get(selectedIp) : undefined
        }
        onClose={() => setDrawerOpen(false)}
      />
    </Box>
  );
};
