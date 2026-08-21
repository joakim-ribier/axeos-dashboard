// src/pages/Alerts.tsx
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import FilterAltOffIcon from "@mui/icons-material/FilterAltOff";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  type SelectChangeEvent,
  Skeleton,
  TablePagination,
  Typography,
} from "@mui/material";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { format, isValid, parseISO } from "date-fns";
import { enUS, fr } from "date-fns/locale";

import { BoardLockedPage } from "@/components/ui/BoardLockedPage";
import { OopsPage } from "@/components/ui/OopsPage";
import { PageHeader } from "@/components/ui/PageHeader";
import { useMode } from "@/contexts/ModeContext";
import { useAlertsHistory } from "@/hooks/useAlertsHistory";
import { ApiError, useAppInfo, useMiners } from "@/hooks/useMiners";
import { formatTimestamp } from "@/utils/format";
import {
  ALERT_TYPE_COLOR,
  ALERT_TYPES,
  episodesToAlertHistoryRows,
} from "@/utils/minerNotifications";

const DEFAULT_PAGE_SIZE = 50;
const ROWS_PER_PAGE_OPTIONS = [25, 50, 100];
const ALL_VALUE = "__all__";

// Defaulting the date filter to today isn't just a UX nicety -- reading a
// single day's JSONL is what lets the backend skip scanning every day a
// miner has ever recorded (see allAlertsForMiner), so this is also what
// makes the page's first load fast. Clearing the filter (reset) still shows
// full history, just slower, same as explicitly picking an older date would
// have been anyway.
const todayISO = (): string => format(new Date(), "yyyy-MM-dd");

/* ── Filters ─────────────────────────────────────────────────── */
interface FiltersBarProps {
  ip: string;
  onIpChange: (ip: string) => void;
  type: string;
  onTypeChange: (type: string) => void;
  date: string;
  onDateChange: (date: string) => void;
  minerOptions: { ip: string; label: string }[];
  onReset: () => void;
}

// Shared width for every filter control. The height/alignment mismatch
// wasn't a font-size issue (Select and DatePicker already match at the
// same MUI "small" size) -- it was that the Selects had no floating label
// at all (just displayEmpty), while the DatePicker had one, and MUI
// renders a taller box for a labeled field. Giving all three an explicit
// label (below) is what actually fixes it, by giving them the same
// internal structure instead of fighting the height with an override.
const FILTER_MIN_WIDTH = 180;
// Full width on mobile (one control per row, easy to tap), fixed min width
// once there's room for them to sit side by side.
const SELECT_SX = { minWidth: { xs: "100%", sm: FILTER_MIN_WIDTH } };
const DATE_FIELD_SX = { minWidth: { xs: "100%", sm: FILTER_MIN_WIDTH } };

const FiltersBar: React.FC<FiltersBarProps> = ({
  ip,
  onIpChange,
  type,
  onTypeChange,
  date,
  onDateChange,
  minerOptions,
  onReset,
}) => {
  const { t, i18n } = useTranslation();
  // date is never "" (the API requires it -- see onReset in the parent),
  // so a filter only counts as "active" when it differs from the no-filter
  // default: today.
  const hasActiveFilter = ip !== "" || type !== "" || date !== todayISO();
  const dateLocale = i18n.language.startsWith("fr") ? fr : enUS;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        flexWrap: { sm: "wrap" },
        alignItems: { xs: "stretch", sm: "center" },
        gap: 1.5,
        width: { xs: "100%", sm: "auto" },
      }}
    >
      <FormControl size="small" sx={SELECT_SX}>
        <InputLabel id="alerts-ip-filter-label">
          {t("alertsPage.filters.ipLabel")}
        </InputLabel>
        <Select
          labelId="alerts-ip-filter-label"
          label={t("alertsPage.filters.ipLabel")}
          value={ip === "" ? ALL_VALUE : ip}
          onChange={(e: SelectChangeEvent) =>
            onIpChange(e.target.value === ALL_VALUE ? "" : e.target.value)
          }
        >
          <MenuItem value={ALL_VALUE}>
            {t("alertsPage.filters.allIps")}
          </MenuItem>
          {minerOptions.map((m) => (
            <MenuItem key={m.ip} value={m.ip}>
              {m.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" sx={SELECT_SX}>
        <InputLabel id="alerts-type-filter-label">
          {t("alertsPage.filters.typeLabel")}
        </InputLabel>
        <Select
          labelId="alerts-type-filter-label"
          label={t("alertsPage.filters.typeLabel")}
          value={type === "" ? ALL_VALUE : type}
          onChange={(e: SelectChangeEvent) =>
            onTypeChange(e.target.value === ALL_VALUE ? "" : e.target.value)
          }
        >
          <MenuItem value={ALL_VALUE}>
            {t("alertsPage.filters.allTypes")}
          </MenuItem>
          {ALERT_TYPES.map((alertType) => (
            <MenuItem key={alertType} value={alertType}>
              {t(`alertsPage.types.${alertType}`)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <LocalizationProvider
        dateAdapter={AdapterDateFns}
        adapterLocale={dateLocale}
      >
        <DatePicker
          label={t("alertsPage.filters.date")}
          value={date ? parseISO(date) : null}
          onChange={(newValue) =>
            // date is required (the API 400s without one) -- never let the
            // field go empty, whether from a bad/incomplete typed value or
            // (previously) the clear button; fall back to today instead of
            // "". "Reset filters" below is the one intended way back to the
            // no-filter default.
            onDateChange(
              newValue && isValid(newValue)
                ? format(newValue, "yyyy-MM-dd")
                : todayISO(),
            )
          }
          // MUI defaults closeOnSelect to true on desktop (popper) but false
          // on mobile (dialog, expects an explicit OK) -- forcing it true
          // makes both close immediately on pick, matching the desktop feel.
          closeOnSelect
          // No `field: { clearable: true }` -- a clear (X) button that can't
          // actually clear the field (see above) is a dead-end affordance,
          // not a fix.
          slotProps={{
            textField: { size: "small", sx: DATE_FIELD_SX },
          }}
        />
      </LocalizationProvider>

      <Button
        size="small"
        disabled={!hasActiveFilter}
        onClick={onReset}
        startIcon={<FilterAltOffIcon fontSize="small" />}
        sx={{ alignSelf: { xs: "flex-end", sm: "center" }, flexShrink: 0 }}
      >
        {t("alertsPage.filters.reset")}
      </Button>
    </Box>
  );
};

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
  const { boardId } = useMode();
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
          ip: m.ip,
          label: m.hostname ? `${m.hostname} (${m.ip})` : m.ip,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [miners],
  );

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
        title={t("alertsPage.header.title")}
        description={t("alertsPage.header.description")}
        icon={<NotificationsActiveIcon fontSize="large" />}
        gradientProps={{
          height: 3,
          radius: 2,
          colors: ["#00b4ff", "#0066cc"],
        }}
      />

      <Box
        sx={{
          mx: { xs: 2, md: 3 },
          display: "flex",
          flexDirection: "column",
          gap: 2,
          opacity: isPlaceholderData ? 0.6 : 1,
          transition: "opacity 0.15s ease",
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            flexWrap: { sm: "wrap" },
            alignItems: { xs: "stretch", sm: "center" },
            justifyContent: "space-between",
            gap: 1.5,
          }}
        >
          <FiltersBar
            ip={ip}
            onIpChange={setIp}
            type={type}
            onTypeChange={setType}
            date={date}
            onDateChange={setDate}
            minerOptions={minerOptions}
            onReset={() => {
              setIp("");
              setType("");
              // Not "" -- the API requires a date on every request (see
              // server/internal/handler/alerts.go), so "reset" means back
              // to today, not "no date" (which would 400).
              setDate(todayISO());
            }}
          />

          {data && data.total > 0 && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ textAlign: { xs: "right", sm: "left" } }}
            >
              {t("alertsPage.shownCount", {
                count: rows.length,
                total: data.total,
              })}
            </Typography>
          )}
        </Box>

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
