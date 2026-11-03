// src/pages/settings/SystemSettings.tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import MemoryIcon from "@mui/icons-material/Memory";
import SystemUpdateAltIcon from "@mui/icons-material/SystemUpdateAlt";
import {
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  Stack,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";

import { ActionButton } from "@/components/ui/ActionButton";
import { DataTable } from "@/components/ui/DataTable";
import { Row, RowList } from "@/components/ui/RowList";
import { SectionDivider } from "@/components/ui/SectionDivider";
import {
  PAGE_GAP,
  ROW_SPACING,
  SECTION_GAP,
} from "@/components/ui/SectionLayout";
import { UrlText } from "@/components/ui/UrlText";
import { Writable } from "@/components/ui/Writable";

import { AlertThresholdsBlock } from "./AlertThresholdsBlock";
import {
  AppSettingsFrame,
  type AppSettingsFrameContext,
} from "./AppSettingsFrame";
import { SectionTitle } from "./SectionTitle";

interface PoolDashboardRow {
  host: string;
  url: string;
}

interface UrlRow {
  key: string;
  label: React.ReactNode;
  url: string;
  /** A pool added by hand -- a built-in one can't be removed. */
  onRemove?: () => void;
}

/** URLs and what they're for: a table, or a row each on a phone -- every
 * URL on one line, whole on hover. */
const UrlList = ({
  rows,
  labelHeader,
  urlHeader,
  removeLabel,
  disabled,
  readOnly,
}: {
  rows: UrlRow[];
  labelHeader: string;
  urlHeader: string;
  removeLabel?: string;
  disabled?: boolean;
  readOnly: boolean;
}) => {
  const isPhone = useMediaQuery(useTheme().breakpoints.down("sm"), {
    noSsr: true,
  });
  const removable = !readOnly && rows.some((r) => r.onRemove);
  const remove = (row: UrlRow) =>
    row.onRemove && (
      <IconButton
        size="small"
        disabled={disabled}
        onClick={row.onRemove}
        aria-label={removeLabel}
      >
        <DeleteOutlineIcon fontSize="small" />
      </IconButton>
    );

  if (isPhone) {
    return (
      <RowList>
        {rows.map((row) => (
          <Row
            key={row.key}
            sx={{ display: "flex", alignItems: "center", gap: 1 }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ fontWeight: 600 }}>{row.label}</Box>
              <Box sx={{ color: "text.secondary" }}>
                <UrlText url={row.url} />
              </Box>
            </Box>
            {!readOnly && remove(row)}
          </Row>
        ))}
      </RowList>
    );
  }
  return (
    <DataTable>
      <TableHead>
        <TableRow>
          <TableCell sx={{ width: "1%", whiteSpace: "nowrap" }}>
            {labelHeader}
          </TableCell>
          <TableCell>{urlHeader}</TableCell>
          {removable && <TableCell align="right" sx={{ width: 56 }} />}
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow hover key={row.key}>
            <TableCell sx={{ whiteSpace: "nowrap" }}>{row.label}</TableCell>
            {/* maxWidth 0: the cell takes what's left and cuts the URL
                short, rather than widening the table. */}
            <TableCell sx={{ maxWidth: 0, width: "100%" }}>
              <UrlText url={row.url} />
            </TableCell>
            {removable && <TableCell align="right">{remove(row)}</TableCell>}
          </TableRow>
        ))}
      </TableBody>
    </DataTable>
  );
};

const SystemSection = ({
  data,
  readOnly,
  isSaving,
  persist,
  serverBasePayload,
  notify,
}: AppSettingsFrameContext) => {
  const { t } = useTranslation();
  const [poolDashboards, setPoolDashboards] = useState<PoolDashboardRow[]>([]);
  const [newPoolHost, setNewPoolHost] = useState("");
  const [newPoolUrl, setNewPoolUrl] = useState("");

  useEffect(() => {
    if (!data) return;
    setPoolDashboards(
      Object.entries(data.pools.dashboards).map(([host, url]) => ({
        host,
        url,
      })),
    );
  }, [data]);

  const persistPoolDashboards = (nextDashboards: PoolDashboardRow[]) => {
    setPoolDashboards(nextDashboards);
    return persist({
      ...serverBasePayload(),
      pools: {
        dashboards: Object.fromEntries(
          nextDashboards.map((p) => [p.host, p.url]),
        ),
      },
    });
  };

  const poolUrlMissingUser =
    newPoolUrl.trim() !== "" && !newPoolUrl.includes("{user}");
  const isNewPoolValid =
    newPoolHost.trim() !== "" &&
    newPoolUrl.trim() !== "" &&
    !poolUrlMissingUser;

  const handleAddPoolDashboard = () => {
    if (!isNewPoolValid) return;
    const host = newPoolHost.trim();
    const url = newPoolUrl.trim();
    setNewPoolHost("");
    setNewPoolUrl("");
    return persistPoolDashboards([
      ...poolDashboards.filter((p) => p.host !== host),
      { host, url },
    ]);
  };

  const onPoolKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") void handleAddPoolDashboard();
  };

  const handleRemovePoolDashboard = (host: string) =>
    persistPoolDashboards(poolDashboards.filter((p) => p.host !== host));

  // The ones added by hand always in view; the built-in ones -- a list that
  // grows with each release -- folded until asked for.
  const [showBuiltIn, setShowBuiltIn] = useState(false);
  const host = (name: string) => (
    <Box component="span" sx={{ fontFamily: "monospace" }}>
      {name}
    </Box>
  );
  const customRows: UrlRow[] = poolDashboards.map((row) => ({
    key: `custom-${row.host}`,
    label: host(row.host),
    url: row.url,
    onRemove: () => void handleRemovePoolDashboard(row.host),
  }));
  const builtInRows: UrlRow[] = Object.entries(
    data?.defaults.pools.dashboards ?? {},
  ).map(([name, url]) => ({ key: `builtin-${name}`, label: host(name), url }));

  return (
    <Stack spacing={PAGE_GAP}>
      <AlertThresholdsBlock
        data={data}
        readOnly={readOnly}
        isSaving={isSaving}
        persist={persist}
        serverBasePayload={serverBasePayload}
        notify={notify}
      />

      <SectionDivider />

      {/* Pool dashboards */}
      <Box>
        <SectionTitle
          icon={<SystemUpdateAltIcon fontSize="small" />}
          title={t("settingsPage.appSettings.pools.title")}
          description={t("settingsPage.appSettings.pools.description")}
        />

        {customRows.length > 0 && (
          <UrlList
            rows={customRows}
            labelHeader={t("settingsPage.appSettings.pools.hostLabel")}
            urlHeader={t("settingsPage.appSettings.pools.urlLabel")}
            removeLabel={t("settingsPage.appSettings.pools.remove")}
            disabled={isSaving}
            readOnly={readOnly}
          />
        )}
        {/* The same fold as the miners' Actions: an outlined button, its
            arrow turning, the list sliding open under it. */}
        {builtInRows.length > 0 && (
          <Box sx={{ mt: customRows.length > 0 ? SECTION_GAP : 0 }}>
            <Button
              variant="outlined"
              size="small"
              aria-expanded={showBuiltIn}
              onClick={() => setShowBuiltIn((shown) => !shown)}
              startIcon={<SystemUpdateAltIcon fontSize="small" />}
              endIcon={
                <KeyboardArrowDownIcon
                  sx={{
                    transition: "transform 0.2s",
                    transform: showBuiltIn ? "rotate(180deg)" : "none",
                  }}
                />
              }
              sx={{ height: 40 }}
            >
              {showBuiltIn
                ? t("settingsPage.appSettings.pools.hideBuiltIn")
                : t("settingsPage.appSettings.pools.showBuiltIn", {
                    count: builtInRows.length,
                  })}
            </Button>
            <Collapse in={showBuiltIn} unmountOnExit>
              <Box sx={{ pt: SECTION_GAP }}>
                <UrlList
                  rows={builtInRows}
                  labelHeader={t("settingsPage.appSettings.pools.hostLabel")}
                  urlHeader={t("settingsPage.appSettings.pools.urlLabel")}
                  readOnly={readOnly}
                />
              </Box>
            </Collapse>
          </Box>
        )}

        {/* Under the table, same shape as the other add forms: the row's
            fields carry no helper text (it'd make one taller than its
            neighbours), so the missing-{user} hint sits under the row. */}
        <Writable readOnly={readOnly}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={ROW_SPACING}
            alignItems={{ xs: "stretch", sm: "center" }}
            sx={{ mt: SECTION_GAP }}
          >
            <TextField
              size="small"
              label={t("settingsPage.appSettings.pools.hostLabel")}
              placeholder="stratum.braiins.com"
              value={newPoolHost}
              onChange={(e) => setNewPoolHost(e.target.value)}
              onKeyDown={onPoolKeyDown}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ width: { sm: 240 }, flexShrink: 0 }}
            />
            <TextField
              size="small"
              label={t("settingsPage.appSettings.pools.urlLabel")}
              placeholder="https://pool.example.com/overview/{user}"
              value={newPoolUrl}
              onChange={(e) => setNewPoolUrl(e.target.value)}
              onKeyDown={onPoolKeyDown}
              error={poolUrlMissingUser}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <ActionButton
              icon={<AddIcon fontSize="small" />}
              disabled={isSaving || !isNewPoolValid}
              onClick={() => void handleAddPoolDashboard()}
            >
              {t("settingsPage.appSettings.pools.add")}
            </ActionButton>
          </Stack>
          {poolUrlMissingUser && (
            <Typography
              variant="caption"
              color="error"
              sx={{ display: "block", mt: 1 }}
            >
              {t("settingsPage.appSettings.pools.missingUserPlaceholder")}
            </Typography>
          )}
        </Writable>
      </Box>

      <SectionDivider />

      {/* Firmware repos -- built-in, read-only: no override from this UI */}
      <Box>
        <SectionTitle
          icon={<MemoryIcon fontSize="small" />}
          title={t("settingsPage.appSettings.firmware.title")}
          description={t("settingsPage.appSettings.firmware.description")}
        />
        <UrlList
          rows={Object.entries(data?.defaults.firmware.repos ?? {}).map(
            ([model, url]) => ({
              key: model,
              label: (
                <Chip
                  size="small"
                  variant="outlined"
                  label={model}
                  sx={{ height: 24, fontSize: "0.8rem", borderRadius: 1 }}
                />
              ),
              url,
            }),
          )}
          labelHeader={t("settingsPage.appSettings.firmware.modelLabel")}
          urlHeader={t("settingsPage.appSettings.firmware.urlLabel")}
          readOnly
        />
      </Box>
    </Stack>
  );
};

export const SystemSettings = () => (
  <AppSettingsFrame>{(ctx) => <SystemSection {...ctx} />}</AppSettingsFrame>
);
