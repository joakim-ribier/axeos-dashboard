// src/pages/Backups.tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import BackupIcon from "@mui/icons-material/Backup";
import DownloadIcon from "@mui/icons-material/Download";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  IconButton,
  Skeleton,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";

import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { backupsDownloadUrl, useBackups } from "@/hooks/useBackups";
import { downloadFile } from "@/utils/download";
import { formatTimestamp } from "@/utils/format";

const formatMonth = (month: string, locale: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

const formatSize = (bytes: number, locale: string) => {
  const mb = bytes >= 1024 * 1024;
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: mb ? "megabyte" : "kilobyte",
    maximumFractionDigits: 1,
  }).format(bytes / (mb ? 1024 * 1024 : 1024));
};

const HIDDEN_ON_MOBILE = { display: { xs: "none", sm: "table-cell" } };
const HIDDEN_BELOW_DESKTOP = { display: { xs: "none", md: "table-cell" } };
// MUI's default 16px cell padding leaves too little room on a phone for a
// month name plus its "in progress" badge.
const COMPACT_ON_MOBILE = {
  "& .MuiTableCell-root:not(.MuiTableCell-paddingCheckbox)": {
    px: { xs: 1, sm: 2 },
  },
};

export const Backups: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { data: backups, isLoading, error } = useBackups();
  const [selected, setSelected] = useState<string[]>([]);
  const [yearIndex, setYearIndex] = useState(0);
  // The server names daily files by UTC date, so "current" is the UTC month.
  const currentMonth = new Date().toISOString().slice(0, 7);

  // backups come sorted most recent first, so years do too.
  const years = [...new Set((backups ?? []).map((b) => b.month.slice(0, 4)))];
  const yearBackups = (backups ?? []).filter((b) =>
    b.month.startsWith(years[yearIndex]),
  );
  const yearMonths = yearBackups.map((b) => b.month);
  const allSelected =
    yearMonths.length > 0 && yearMonths.every((m) => selected.includes(m));
  const someSelected = yearMonths.some((m) => selected.includes(m));
  const selectedSize = (backups ?? [])
    .filter((b) => selected.includes(b.month))
    .reduce((sum, b) => sum + b.size, 0);
  const toggle = (month: string) =>
    setSelected((prev) =>
      prev.includes(month) ? prev.filter((m) => m !== month) : [...prev, month],
    );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <PageHeader
        title={t("backupsPage.header.title")}
        description={t("backupsPage.header.description")}
        icon={<BackupIcon />}
      />

      <Box
        sx={{
          mx: { xs: 0, md: 3 },
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {error ? (
          <Alert severity="error">{t("backupsPage.loadError")}</Alert>
        ) : isLoading ? (
          <Skeleton variant="rounded" height={120} />
        ) : !backups?.length ? (
          <Typography color="text.secondary" align="center" sx={{ py: 6 }}>
            {t("backupsPage.empty")}
          </Typography>
        ) : (
          <>
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 2,
              }}
            >
              {selected.length > 0 && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ whiteSpace: "nowrap" }}
                >
                  {t("backupsPage.selection", {
                    count: selected.length,
                    size: formatSize(selectedSize, i18n.language),
                  })}
                </Typography>
              )}
              <Button
                variant="outlined"
                size="small"
                startIcon={<DownloadIcon />}
                disabled={!selected.length}
                onClick={() => void downloadFile(backupsDownloadUrl(selected))}
              >
                {t("backupsPage.download")}
              </Button>
            </Box>
            <DataTable sx={COMPACT_ON_MOBILE}>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={allSelected}
                      indeterminate={someSelected && !allSelected}
                      onChange={() =>
                        setSelected((prev) =>
                          allSelected
                            ? prev.filter((m) => !yearMonths.includes(m))
                            : [...new Set([...prev, ...yearMonths])],
                        )
                      }
                      slotProps={{
                        input: { "aria-label": t("backupsPage.selectAll") },
                      }}
                    />
                  </TableCell>
                  <TableCell>{t("backupsPage.columns.month")}</TableCell>
                  <TableCell align="right">
                    {t("backupsPage.columns.size")}
                  </TableCell>
                  <TableCell align="right" sx={HIDDEN_ON_MOBILE}>
                    {t("backupsPage.columns.updatedAt")}
                  </TableCell>
                  <TableCell sx={HIDDEN_BELOW_DESKTOP}>
                    {t("backupsPage.columns.checksum")}
                  </TableCell>
                  <TableCell align="right" sx={{ width: 56 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {yearBackups.map((backup) => (
                  <TableRow key={backup.month}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={selected.includes(backup.month)}
                        onChange={() => toggle(backup.month)}
                        slotProps={{
                          input: {
                            "aria-label": formatMonth(
                              backup.month,
                              i18n.language,
                            ),
                          },
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Box
                        component="span"
                        sx={{
                          textTransform: "capitalize",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatMonth(backup.month, i18n.language)}
                      </Box>
                      {backup.month === currentMonth && (
                        <Chip
                          label={t("backupsPage.inProgress")}
                          size="small"
                          sx={{
                            display: { xs: "flex", sm: "inline-flex" },
                            width: "fit-content",
                            ml: { xs: 0, sm: 1 },
                            mt: { xs: 0.5, sm: 0 },
                            height: 20,
                            fontSize: "0.7rem",
                          }}
                        />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {formatSize(backup.size, i18n.language)}
                    </TableCell>
                    <TableCell align="right" sx={HIDDEN_ON_MOBILE}>
                      {
                        // UTC, like the daily files and the nightly update --
                        // local time would show an update made just after
                        // midnight UTC at a misleading hour.
                        formatTimestamp(backup.updatedAt, "UTC")
                      }
                    </TableCell>
                    <TableCell
                      sx={{
                        ...HIDDEN_BELOW_DESKTOP,
                        fontFamily: "monospace",
                        fontSize: "0.75rem",
                        color: "text.secondary",
                      }}
                    >
                      {backup.checksum ?? "—"}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title={t("backupsPage.download")} arrow>
                        <IconButton
                          size="small"
                          onClick={() =>
                            void downloadFile(
                              backupsDownloadUrl([backup.month]),
                            )
                          }
                          aria-label={t("backupsPage.download")}
                        >
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTable>
            <TablePagination
              component="div"
              count={years.length}
              page={yearIndex}
              onPageChange={(_, page) => setYearIndex(page)}
              rowsPerPage={1}
              rowsPerPageOptions={[]}
              labelDisplayedRows={() => years[yearIndex]}
              getItemAriaLabel={(type) =>
                type === "next"
                  ? t("backupsPage.previousYear")
                  : t("backupsPage.nextYear")
              }
            />
          </>
        )}
      </Box>
    </Box>
  );
};
