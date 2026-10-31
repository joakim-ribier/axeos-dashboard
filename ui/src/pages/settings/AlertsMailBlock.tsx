// src/pages/settings/AlertsMailBlock.tsx
import { useTranslation } from "react-i18next";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import SendIcon from "@mui/icons-material/Send";
import {
  Box,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from "@mui/material";

import { ActionButton } from "@/components/ui/ActionButton";
import { formatTimestamp } from "@/utils/format";

import { type AppSettingsFrameContext } from "./AppSettingsFrame";
import { SectionTitle } from "./SectionTitle";

/** A mail on every feeder poll that raises alerts (see alertmail) -- the
 * switch saves itself; the example goes through the test mail's route. */
export const AlertsMailBlock = ({
  data,
  isSaving,
  persist,
  serverBasePayload,
  sending,
  blocked,
  onSendExample,
}: AppSettingsFrameContext & {
  sending: boolean;
  // No mail can go out yet -- the test mail above says why.
  blocked: boolean;
  onSendExample: () => void;
}) => {
  const { t } = useTranslation();
  const enabled = data?.notifications.alerts.mail ?? false;
  const status = data?.readOnly.alertsMail;

  const handleToggle = (mail: boolean) => {
    const base = serverBasePayload();
    return persist({
      ...base,
      notifications: { ...base.notifications, alerts: { mail } },
    });
  };

  return (
    <Box>
      <SectionTitle
        icon={<NotificationsActiveIcon fontSize="small" />}
        title={t("settingsPage.appSettings.mail.alerts.title")}
        description={t("settingsPage.appSettings.mail.alerts.description")}
      />
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems={{ xs: "stretch", sm: "center" }}
        >
          <FormControlLabel
            control={
              <Switch
                checked={enabled}
                disabled={isSaving}
                onChange={(e) => void handleToggle(e.target.checked)}
              />
            }
            label={t("settingsPage.appSettings.mail.alerts.enabledLabel")}
            sx={{ flexGrow: 1, mr: 0 }}
          />
          <ActionButton
            icon={<SendIcon fontSize="small" />}
            loading={sending}
            disabled={blocked}
            onClick={onSendExample}
          >
            {sending
              ? t("settingsPage.appSettings.mail.test.sending")
              : t("settingsPage.appSettings.mail.alerts.sendExample")}
          </ActionButton>
        </Stack>
        {status?.lastError ? (
          <Typography variant="caption" color="warning.main">
            {t("settingsPage.appSettings.mail.alerts.lastFailed", {
              error: status.lastError,
            })}
          </Typography>
        ) : status?.lastSentAt ? (
          <Typography variant="caption" color="success.main">
            {t("settingsPage.appSettings.mail.alerts.lastSent", {
              date: formatTimestamp(status.lastSentAt),
            })}
          </Typography>
        ) : (
          enabled && (
            <Typography variant="caption" color="text.disabled">
              {t("settingsPage.appSettings.mail.alerts.neverSent")}
            </Typography>
          )
        )}
      </Stack>
    </Box>
  );
};
