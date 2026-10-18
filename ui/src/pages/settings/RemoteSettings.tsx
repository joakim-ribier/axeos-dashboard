// src/pages/settings/RemoteSettings.tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DashboardIcon from "@mui/icons-material/Dashboard";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SaveIcon from "@mui/icons-material/Save";
import { Box, Chip, Link, Stack, TextField, Typography } from "@mui/material";

import { ActionButton } from "@/components/ui/ActionButton";
import { SecretField } from "@/components/ui/SecretField";
import { SectionDivider } from "@/components/ui/SectionDivider";
import { useRemoteBoard } from "@/hooks/useRemoteBoard";
import { formatTimestamp } from "@/utils/format";

import {
  AppSettingsFrame,
  type AppSettingsFrameContext,
} from "./AppSettingsFrame";
import { SectionTitle } from "./SectionTitle";

/** A label/value line of the board block. */
const InfoRow = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <Box
    sx={{
      display: "flex",
      flexDirection: { xs: "column", sm: "row" },
      gap: { xs: 0.25, sm: 2 },
      py: 1,
      "& + &": { borderTop: 1, borderColor: "divider" },
    }}
  >
    <Typography
      variant="body2"
      color="text.secondary"
      sx={{ width: { sm: 240 }, flexShrink: 0 }}
    >
      {label}
    </Typography>
    <Box sx={{ minWidth: 0, display: "flex", alignItems: "center", gap: 1 }}>
      {children}
    </Box>
  </Box>
);

const RemoteSection = ({
  data,
  isSaving,
  persist,
  serverBasePayload,
}: AppSettingsFrameContext) => {
  const { t } = useTranslation();
  const { data: board } = useRemoteBoard();
  const [pushURL, setPushURL] = useState("");
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    if (!data) return;
    setPushURL(data.remote.pushURL);
    setApiKey(data.remote.apiKey);
  }, [data]);

  // Checked before sending, as the server would refuse it: blank (push
  // off) or an http(s) address.
  const pushURLInvalid = (() => {
    const value = pushURL.trim();
    if (!value) return false;
    try {
      return !["http:", "https:"].includes(new URL(value).protocol);
    } catch {
      return true;
    }
  })();

  const handleSaveRemote = () => {
    if (pushURLInvalid) return;
    return persist({
      ...serverBasePayload(),
      remote: { pushURL: pushURL.trim(), apiKey: apiKey.trim() },
    });
  };

  return (
    <Stack spacing={4}>
      {/* The board on hashboard's side -- only once it answered. */}
      {board?.boardId && (
        <>
          <Box>
            <SectionTitle
              icon={<DashboardIcon fontSize="small" />}
              title={t("settingsPage.appSettings.remote.board.title")}
              description={t(
                "settingsPage.appSettings.remote.board.description",
              )}
            />
            <InfoRow label={t("settingsPage.appSettings.remote.board.id")}>
              {board.dashboardURL ? (
                <Link
                  variant="body2"
                  href={board.dashboardURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    fontFamily: "monospace",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.5,
                  }}
                >
                  {board.boardId}
                  <OpenInNewIcon sx={{ fontSize: 14 }} />
                </Link>
              ) : (
                <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                  {board.boardId}
                </Typography>
              )}
            </InfoRow>
            <InfoRow
              label={t("settingsPage.appSettings.remote.board.visibility")}
            >
              <Chip
                size="small"
                variant="outlined"
                label={t(
                  board.public
                    ? "settingsPage.appSettings.remote.board.public"
                    : "settingsPage.appSettings.remote.board.private",
                )}
                sx={{ height: 24, borderRadius: 1 }}
              />
            </InfoRow>
            <InfoRow
              label={t("settingsPage.appSettings.remote.board.lastSample")}
            >
              <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                {board.lastSampleAt
                  ? formatTimestamp(board.lastSampleAt)
                  : t("settingsPage.appSettings.remote.board.noSample")}
              </Typography>
            </InfoRow>
            {board.hashboardURL && (
              <InfoRow
                label={t("settingsPage.appSettings.remote.board.account")}
              >
                <Link
                  variant="body2"
                  href={`${board.hashboardURL}/me`}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.5,
                  }}
                >
                  {t("settingsPage.appSettings.remote.board.manage")}
                  <OpenInNewIcon sx={{ fontSize: 14 }} />
                </Link>
              </InfoRow>
            )}
          </Box>
          <SectionDivider />
        </>
      )}

      {/* Connection */}
      <Box>
        <SectionTitle
          icon={<CloudUploadIcon fontSize="small" />}
          title={t("settingsPage.appSettings.remote.connection.title")}
          description={t(
            "settingsPage.appSettings.remote.connection.description",
          )}
        />
        <Stack spacing={2}>
          <TextField
            size="small"
            label={t("settingsPage.appSettings.remote.pushUrlLabel")}
            placeholder="https://hashboard.live/api/push"
            value={pushURL}
            onChange={(e) => setPushURL(e.target.value)}
            error={pushURLInvalid}
            helperText={
              pushURLInvalid
                ? t("settingsPage.appSettings.remote.invalidPushUrl")
                : undefined
            }
            slotProps={{ inputLabel: { shrink: true } }}
            fullWidth
          />
          <SecretField
            size="small"
            label={t("settingsPage.appSettings.remote.apiKeyLabel")}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            fullWidth
          />
          <Box>
            <ActionButton
              icon={<SaveIcon fontSize="small" />}
              loading={isSaving}
              disabled={pushURLInvalid}
              onClick={() => void handleSaveRemote()}
            >
              {isSaving
                ? t("settingsPage.appSettings.saving")
                : t("settingsPage.appSettings.save")}
            </ActionButton>
          </Box>
        </Stack>
      </Box>
    </Stack>
  );
};

// Never shown read-only (see Settings): remote.pushURL/apiKey are never
// pushed to a remote board in the first place (see
// cmd/feeder.configSettingsPush), so there'd be nothing real to show.
export const RemoteSettings = () => (
  <AppSettingsFrame>{(ctx) => <RemoteSection {...ctx} />}</AppSettingsFrame>
);
