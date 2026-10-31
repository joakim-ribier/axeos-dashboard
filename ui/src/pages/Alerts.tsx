// src/pages/Alerts.tsx
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import { Box, Skeleton, TablePagination, Typography } from "@mui/material";
import { format, parseISO } from "date-fns";

import { FilterBar } from "@/components/ui/FilterBar";
import { PageHeader } from "@/components/ui/PageHeader";
import { useActiveAlerts } from "@/hooks/useAlerts";
import { useAlertsHistory } from "@/hooks/useAlertsHistory";
import { useMiners } from "@/hooks/useMiners";
import { type AlertEvent } from "@/schemas/minerSchema";
import { displayName } from "@/utils/minerDisplay";
import {
  ALERT_TYPES,
  alertColor,
  alertSince,
  alertText,
  alertWhen,
} from "@/utils/minerNotifications";

const DEFAULT_PAGE_SIZE = 50;
const ROWS_PER_PAGE_OPTIONS = [25, 50, 100];

const todayISO = (): string => format(new Date(), "yyyy-MM-dd");

/* ── Row ─────────────────────────────────────────────────────── */
const AlertRow: React.FC<{
  event: AlertEvent;
  ongoing?: boolean;
  // In progress: the miner's latest reading, shown instead of the one that
  // raised it.
  current?: number;
}> = ({ event, ongoing = false, current }) => {
  const { t } = useTranslation();
  const dotColor = alertColor(event);
  return (
    <Box
      data-testid={ongoing ? "ongoing-alert-row" : "alert-row"}
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
          boxShadow: `0 0 6px ${dotColor}`,
        }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2">
          {alertText(
            t,
            current !== undefined ? { ...event, value: current } : event,
          )}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 0.25 }}
        >
          {t(`alertsPage.types.${event.type}`)}
          {event.ip ? ` · ${event.ip}` : ""} ·{" "}
          {ongoing
            ? alertSince(t, event, current !== undefined)
            : alertWhen(t, event)}
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
  const { data: miners } = useMiners();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [ip, setIp] = useState("");
  const [type, setType] = useState("");
  const [date, setDate] = useState(todayISO);

  useEffect(() => {
    setPage(1);
  }, [ip, type, date, pageSize]);

  const { data, isLoading, isPlaceholderData } = useAlertsHistory({
    page,
    pageSize,
    ip: ip || undefined,
    type: type || undefined,
    date,
  });

  const events = data?.events ?? [];

  // Whatever the day picked: what isn't solved yet stays on top.
  const { data: active = [] } = useActiveAlerts();
  const ongoing = active.filter(
    (e) => (!ip || e.ip === ip) && (!type || e.type === type),
  );
  const currentReading = (event: AlertEvent): number | undefined => {
    const miner = miners?.find((m) => m.ip === event.ip);
    if (event.type === "tempHigh") return miner?.temp;
    if (event.type === "fanHigh") return miner?.fanspeed;
    return undefined;
  };

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
              dayNav: true,
            },
          ]}
          summary={
            data &&
            data.total > 0 && (
              <Typography variant="caption" color="text.secondary">
                {t("alertsPage.shownCount", {
                  count: events.length,
                  total: data.total,
                })}
              </Typography>
            )
          }
        />

        {ongoing.length > 0 && (
          <>
            <Typography variant="subtitle2" component="h2">
              {t("alertsPage.ongoing", { count: ongoing.length })}
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {ongoing.map((event) => (
                <AlertRow
                  key={`${event.mac}-${event.type}`}
                  event={event}
                  ongoing
                  current={currentReading(event)}
                />
              ))}
            </Box>
            <Typography variant="subtitle2" component="h2" sx={{ mt: 2 }}>
              {t("alertsPage.history")}
            </Typography>
          </>
        )}

        {!isLoading && events.length === 0 ? (
          <Typography color="text.secondary" align="center" sx={{ py: 6 }}>
            {t("alertsPage.empty")}
          </Typography>
        ) : (
          <>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {isLoading && !data ? (
                <RowsSkeleton />
              ) : (
                events.map((event) => (
                  <AlertRow
                    key={`${event.mac}-${event.type}-${event.state}-${event.ts}`}
                    event={event}
                  />
                ))
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
