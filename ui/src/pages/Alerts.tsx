// src/pages/Alerts.tsx
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import { Box, Skeleton, TablePagination, Typography } from "@mui/material";
import { format, parseISO } from "date-fns";

import { BoardLockedPage } from "@/components/ui/BoardLockedPage";
import { FilterBar } from "@/components/ui/FilterBar";
import { OopsPage } from "@/components/ui/OopsPage";
import { PageHeader } from "@/components/ui/PageHeader";
import { useMode } from "@/contexts/ModeContext";
import { useAlertsHistory } from "@/hooks/useAlertsHistory";
import { ApiError, useAppInfo, useMiners } from "@/hooks/useMiners";
import { formatTimestamp } from "@/utils/format";
import { displayName } from "@/utils/minerDisplay";
import {
  ALERT_TYPE_COLOR,
  ALERT_TYPES,
  episodesToAlertHistoryRows,
} from "@/utils/minerNotifications";

const DEFAULT_PAGE_SIZE = 50;
const ROWS_PER_PAGE_OPTIONS = [25, 50, 100];

// Defaulting the date filter to today isn't just a UX nicety -- reading a
// single day's JSONL is what lets the backend skip scanning every day a
// miner has ever recorded (see allAlertsForMiner), so this is also what
// makes the page's first load fast. Clearing the filter (reset) still shows
// full history, just slower, same as explicitly picking an older date would
// have been anyway.
const todayISO = (): string => format(new Date(), "yyyy-MM-dd");

/* ── Row ─────────────────────────────────────────────────────── */
type AlertRowData = ReturnType<typeof episodesToAlertHistoryRows>[number];

const AlertRow: React.FC<{ row: AlertRowData }> = ({ row }) => {
  const { t } = useTranslation();
  const dotColor = ALERT_TYPE_COLOR[row.type];
  // A one-off blip (occurrences === 1) reads as a single timestamp, same as
  // before episodes existed. Only a real span gets the range + count, so
  // the common case doesn't grow a redundant "1 occurrences".
  const whenAndCount =
    row.occurrences > 1
      ? `${formatTimestamp(row.firstSeen)} → ${formatTimestamp(row.lastSeen)} · ${t(
          "alertsPage.occurrences",
          { count: row.occurrences },
        )}`
      : formatTimestamp(row.firstSeen);

  return (
    <Box
      data-testid="alert-row"
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: 1.25,
        px: 1.5,
        py: 1.25,
        borderRadius: 2,
        backgroundColor: "background.paper",
      }}
    >
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          flexShrink: 0,
          mt: "6px",
          backgroundColor: dotColor,
          boxShadow: dotColor ? `0 0 6px ${dotColor}` : "none",
        }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2">
          {t(`notifications.${row.type}`, {
            miner: row.minerLabel,
            value: row.detail,
          })}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 0.25 }}
        >
          {t(`alertsPage.types.${row.type}`)}
          {row.minerIp ? ` · ${row.minerIp}` : ""} · {whenAndCount}
        </Typography>
      </Box>
    </Box>
  );
};

const RowsSkeleton: React.FC = () => (
  <>
    {Array.from({ length: 6 }).map((_, i) => (
      <Box
        key={i}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          px: 1.5,
          py: 1.25,
          borderRadius: 2,
          backgroundColor: "background.paper",
        }}
      >
        <Skeleton variant="circular" width={8} height={8} />
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" width="35%" />
        </Box>
      </Box>
    ))}
  </>
);

/* ── Alerts page ─────────────────────────────────────────────── */
export const Alerts = () => {
  const { t } = useTranslation();
  const { boardId, isRemoteBackend } = useMode();
  const { hashboardUrl } = useAppInfo();
  const { data: miners } = useMiners();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [ip, setIp] = useState("");
  const [type, setType] = useState("");
  const [date, setDate] = useState(todayISO);

  useEffect(() => {
    setPage(1);
  }, [ip, type, date, pageSize]);

  const { data, isLoading, isPlaceholderData, error } = useAlertsHistory({
    page,
    pageSize,
    ip: ip || undefined,
    type: type || undefined,
    date,
  });

  const rows = useMemo(
    () => episodesToAlertHistoryRows(data?.episodes ?? []),
    [data],
  );

  const minerOptions = useMemo(
    () =>
      (miners ?? [])
        .map((m) => ({
          value: m.ip,
          label: displayName(m) ? `${displayName(m)} (${m.ip})` : m.ip,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [miners],
  );

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

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <PageHeader
        title={t("alertsPage.header.title")}
        description={t("alertsPage.header.description")}
        icon={<NotificationsActiveIcon />}
      />

      <Box
        sx={{
          mx: { xs: 0, md: 3 },
          display: "flex",
          flexDirection: "column",
          gap: 2,
          opacity: isPlaceholderData ? 0.6 : 1,
          transition: "opacity 0.15s ease",
        }}
      >
        <FilterBar
          filters={[
            {
              kind: "select",
              id: "ip",
              label: t("alertsPage.filters.ipLabel"),
              value: ip,
              onChange: setIp,
              allLabel: t("alertsPage.filters.allIps"),
              options: minerOptions,
            },
            {
              kind: "select",
              id: "type",
              label: t("alertsPage.filters.typeLabel"),
              value: type,
              onChange: setType,
              allLabel: t("alertsPage.filters.allTypes"),
              options: ALERT_TYPES.map((alertType) => ({
                value: alertType,
                label: t(`alertsPage.types.${alertType}`),
              })),
            },
            {
              kind: "date",
              id: "date",
              label: t("alertsPage.filters.date"),
              value: parseISO(date),
              // The API requires a date (it 400s without one) -- clearing
              // the filter means back to today, never "no date".
              onChange: (value) =>
                setDate(value ? format(value, "yyyy-MM-dd") : todayISO()),
              defaultValue: parseISO(todayISO()),
            },
          ]}
          summary={
            data &&
            data.total > 0 && (
              <Typography variant="caption" color="text.secondary">
                {t("alertsPage.shownCount", {
                  count: rows.length,
                  total: data.total,
                })}
              </Typography>
            )
          }
        />

        {!isLoading && rows.length === 0 ? (
          <Typography color="text.secondary" align="center" sx={{ py: 6 }}>
            {t("alertsPage.empty")}
          </Typography>
        ) : (
          <>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {isLoading && !data ? (
                <RowsSkeleton />
              ) : (
                rows.map((row) => <AlertRow key={row.id} row={row} />)
              )}
            </Box>
            <TablePagination
              component="div"
              count={data?.total ?? 0}
              page={page - 1}
              onPageChange={(_, newPage) => setPage(newPage + 1)}
              rowsPerPage={pageSize}
              onRowsPerPageChange={(e) =>
                setPageSize(parseInt(e.target.value, 10))
              }
              rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
              labelRowsPerPage={t("alertsPage.pagination.rowsPerPage")}
              labelDisplayedRows={({ from, to, count }) =>
                t("alertsPage.summary", { from, to, total: count })
              }
            />
          </>
        )}
      </Box>
    </Box>
  );
};
