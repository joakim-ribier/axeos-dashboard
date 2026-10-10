// src/pages/Audit.tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import CheckIcon from "@mui/icons-material/Check";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import ManageHistoryIcon from "@mui/icons-material/ManageHistory";
import {
  Box,
  Button,
  IconButton,
  Skeleton,
  TablePagination,
  Tooltip,
  Typography,
} from "@mui/material";
import { addDays, format, startOfDay } from "date-fns";
import { enUS, fr } from "date-fns/locale";

import { FilterBar } from "@/components/ui/FilterBar";
import { PageHeader } from "@/components/ui/PageHeader";
import { auditExportUrl, type AuditRange, useAudit } from "@/hooks/useAudit";
import { useMiners } from "@/hooks/useMiners";
import type { AuditEntry } from "@/schemas/auditSchema";
import type { Miner } from "@/schemas/minerSchema";
import { copyToClipboard } from "@/utils/clipboard";
import { downloadFile } from "@/utils/download";
import { formatTimestamp } from "@/utils/format";
import { displayName } from "@/utils/minerDisplay";
import { summarizeUserAgent } from "@/utils/userAgent";

const DEFAULT_PAGE_SIZE = 50;
const ROWS_PER_PAGE_OPTIONS = [25, 50, 100];
const POOL_SWITCH_TYPES = ["switch_primary", "switch_fallback"];
const AUDIT_TYPES = [
  "restart",
  ...POOL_SWITCH_TYPES,
  "save_miners",
  "save_settings",
  "export_audit",
  "download_backups",
  "discover",
];

const isFailure = (entry: AuditEntry) =>
  !!entry.error || (entry.status ?? 0) >= 400;

/* ── Row ─────────────────────────────────────────────────────── */
const AuditRow: React.FC<{ entry: AuditEntry; miners: Miner[] }> = ({
  entry,
  miners,
}) => {
  const { t } = useTranslation();
  const failed = isFailure(entry);
  const [copied, setCopied] = useState(false);

  // The raw entry, as stored -- full User-Agent, requestId and all.
  const copy = () =>
    copyToClipboard(JSON.stringify(entry, null, 2))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  const dotColor = failed ? "error.main" : "success.main";

  // An API call addresses a miner by IP or hostname, the scheduler by IP --
  // either way, show the name the rest of the dashboard uses.
  const miner = entry.target
    ? miners.find((m) => m.ip === entry.target || m.hostname === entry.target)
    : undefined;
  const target = miner
    ? displayName(miner) || miner.ip
    : entry.target ||
      (POOL_SWITCH_TYPES.includes(entry.type) ? t("auditPage.allMiners") : "");

  const who =
    entry.source === "api"
      ? [
          t("auditPage.sources.api"),
          entry.ip,
          entry.userAgent && summarizeUserAgent(entry.userAgent),
        ]
      : [
          t("auditPage.sources.system"),
          entry.service &&
            t(`auditPage.services.${entry.service}`, {
              defaultValue: entry.service,
            }),
          entry.cron,
        ];
  const caption = [
    formatTimestamp(entry.ts),
    ...who,
    failed &&
      (entry.status
        ? `${t("auditPage.failed")} (${entry.status})`
        : t("auditPage.failed")),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Box
      data-testid="audit-row"
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
        }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2">
          {t(`auditPage.types.${entry.type}`, {
            defaultValue: entry.type,
          })}
          {target ? ` · ${target}` : ""}
        </Typography>
        <Typography
          variant="caption"
          color={failed ? "error.main" : "text.secondary"}
          title={entry.userAgent}
          sx={{ display: "block", mt: 0.25 }}
        >
          {caption}
        </Typography>
        {[entry.query, entry.error].filter(Boolean).map((detail) => (
          <Typography
            key={detail}
            variant="caption"
            color="text.disabled"
            noWrap
            title={detail}
            sx={{ display: "block" }}
          >
            {detail}
          </Typography>
        ))}
      </Box>
      <Tooltip title={copied ? t("auditPage.copied") : t("auditPage.copy")}>
        <IconButton
          size="small"
          onClick={copy}
          aria-label={t("auditPage.copy")}
          sx={{ mt: -0.5, mr: -0.75 }}
        >
          {copied ? (
            <CheckIcon fontSize="small" sx={{ color: "success.main" }} />
          ) : (
            <ContentCopyIcon fontSize="small" />
          )}
        </IconButton>
      </Tooltip>
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

/* ── Audit page ──────────────────────────────────────────────── */
export const Audit = () => {
  const { t, i18n } = useTranslation();
  const { data: miners } = useMiners();
  const dateLocale = i18n.language.startsWith("fr") ? fr : enUS;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  // null is the default view: the last 24 hours. A picked day is the local
  // calendar day, sent as its UTC bounds -- the server stores in UTC.
  const [day, setDay] = useState<Date | null>(null);
  const [ip, setIp] = useState("");
  const [type, setType] = useState("");

  const dayStart = day ? startOfDay(day) : null;
  const range: AuditRange = {
    from: dayStart?.toISOString(),
    to: dayStart ? addDays(dayStart, 1).toISOString() : undefined,
    ip: ip || undefined,
    type: type || undefined,
  };
  const { data, isLoading, isPlaceholderData } = useAudit({
    page,
    pageSize,
    ...range,
  });
  const entries = data?.entries ?? [];

  const minerOptions = (miners ?? [])
    .map((m) => ({
      value: m.ip,
      label: displayName(m) ? `${displayName(m)} (${m.ip})` : m.ip,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  useEffect(() => {
    setPage(1);
  }, [day, ip, type, pageSize]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <PageHeader
        title={t("auditPage.header.title")}
        description={t("auditPage.header.description")}
        icon={<ManageHistoryIcon />}
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
              id: "miner",
              label: t("auditPage.filters.miner"),
              value: ip,
              onChange: setIp,
              allLabel: t("auditPage.filters.allMiners"),
              options: minerOptions,
            },
            {
              kind: "select",
              id: "type",
              label: t("auditPage.filters.type"),
              value: type,
              onChange: setType,
              allLabel: t("auditPage.filters.allTypes"),
              options: AUDIT_TYPES.map((a) => ({
                value: a,
                label: t(`auditPage.types.${a}`),
              })),
            },
            {
              kind: "date",
              id: "day",
              label: t("auditPage.filters.day"),
              value: day,
              onChange: setDay,
              defaultValue: null,
            },
          ]}
          summary={
            data && (
              <Typography variant="caption" color="text.secondary">
                {t("auditPage.count", { count: data.total })} ·{" "}
                {day
                  ? format(day, "PPPP", { locale: dateLocale })
                  : t("auditPage.filters.last24h").toLowerCase()}
              </Typography>
            )
          }
          actions={
            <Button
              size="small"
              onClick={() => void downloadFile(auditExportUrl(range))}
              disabled={!data?.total}
              startIcon={<DownloadIcon fontSize="small" />}
            >
              {t("auditPage.export")}
            </Button>
          }
        />

        {!isLoading && entries.length === 0 ? (
          <Typography color="text.secondary" align="center" sx={{ py: 6 }}>
            {t("auditPage.empty")}
          </Typography>
        ) : (
          <>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {isLoading && !data ? (
                <RowsSkeleton />
              ) : (
                entries.map((entry, i) => (
                  <AuditRow
                    key={`${entry.ts}-${i}`}
                    entry={entry}
                    miners={miners ?? []}
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
              labelRowsPerPage={t("auditPage.pagination.rowsPerPage")}
              labelDisplayedRows={({ from, to, count }) =>
                t("auditPage.summary", { from, to, total: count })
              }
            />
          </>
        )}
      </Box>
    </Box>
  );
};
