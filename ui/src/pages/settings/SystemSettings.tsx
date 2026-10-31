// src/pages/settings/SystemSettings.tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import MemoryIcon from "@mui/icons-material/Memory";
import SystemUpdateAltIcon from "@mui/icons-material/SystemUpdateAlt";
import {
  Box,
  Chip,
  IconButton,
  Stack,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";

import { ActionButton } from "@/components/ui/ActionButton";
import { DataTable } from "@/components/ui/DataTable";
import { SectionDivider } from "@/components/ui/SectionDivider";
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

  return (
    <Stack spacing={4}>
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

        <DataTable sx={{ mb: 2 }}>
          <TableHead>
            <TableRow>
              <TableCell>
                {t("settingsPage.appSettings.pools.hostLabel")}
              </TableCell>
              <TableCell>
                {t("settingsPage.appSettings.pools.urlLabel")}
              </TableCell>
              <Writable readOnly={readOnly}>
                <TableCell align="right" sx={{ width: 56 }} />
              </Writable>
            </TableRow>
          </TableHead>
          <TableBody>
            {data &&
              Object.keys(data.defaults.pools.dashboards).length === 0 &&
              poolDashboards.length === 0 && (
                <TableRow>
                  <TableCell colSpan={readOnly ? 2 : 3}>
                    <Typography variant="caption" color="text.disabled">
                      {t("settingsPage.appSettings.pools.empty")}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            {data &&
              Object.entries(data.defaults.pools.dashboards).map(
                ([host, url]) => (
                  <TableRow hover key={`builtin-${host}`}>
                    <TableCell sx={{ fontFamily: "monospace" }}>
                      {host}
                    </TableCell>
                    <TableCell
                      sx={{ fontFamily: "monospace", overflowWrap: "anywhere" }}
                    >
                      {url}
                    </TableCell>
                    <Writable readOnly={readOnly}>
                      <TableCell />
                    </Writable>
                  </TableRow>
                ),
              )}
            {poolDashboards.map((row) => (
              <TableRow hover key={`custom-${row.host}`}>
                <TableCell sx={{ fontFamily: "monospace" }}>
                  {row.host}
                </TableCell>
                <TableCell
                  sx={{ fontFamily: "monospace", overflowWrap: "anywhere" }}
                >
                  {row.url}
                </TableCell>
                <Writable readOnly={readOnly}>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      disabled={isSaving}
                      onClick={() => void handleRemovePoolDashboard(row.host)}
                      aria-label={t("settingsPage.appSettings.pools.remove")}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </Writable>
              </TableRow>
            ))}
          </TableBody>
        </DataTable>

        {/* Under the table, same shape as the other add forms: the row's
            fields carry no helper text (it'd make one taller than its
            neighbours), so the missing-{user} hint sits under the row. */}
        <Writable readOnly={readOnly}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            alignItems={{ xs: "stretch", sm: "center" }}
            sx={{ mt: 2 }}
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
        <DataTable>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 120 }}>
                {t("settingsPage.appSettings.firmware.modelLabel")}
              </TableCell>
              <TableCell>
                {t("settingsPage.appSettings.firmware.urlLabel")}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data &&
              Object.entries(data.defaults.firmware.repos).map(
                ([model, url]) => (
                  <TableRow hover key={model}>
                    <TableCell>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={model}
                        sx={{ height: 24, fontSize: "0.8rem", borderRadius: 1 }}
                      />
                    </TableCell>
                    <TableCell
                      sx={{ fontFamily: "monospace", overflowWrap: "anywhere" }}
                    >
                      {url}
                    </TableCell>
                  </TableRow>
                ),
              )}
          </TableBody>
        </DataTable>
      </Box>
    </Stack>
  );
};

export const SystemSettings = () => (
  <AppSettingsFrame>{(ctx) => <SystemSection {...ctx} />}</AppSettingsFrame>
);
