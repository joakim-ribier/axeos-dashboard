// src/pages/settings/AlertsMailBlock.tsx
import { useTranslation } from "react-i18next";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import {
  Box,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from "@mui/material";

import { ROW_SPACING, SECTION_GAP } from "@/components/ui/SectionLayout";
import { formatTimestamp } from "@/utils/format";

import { type AppSettingsFrameContext } from "./AppSettingsFrame";
import { MailBlockedNotice, MailTestButton } from "./MailTestButton";
import { SectionTitle } from "./SectionTitle";

/** A mail on every feeder poll that raises alerts (see alertmail) -- the
 * switch saves itself; the example goes through the test mail's route. */
export const AlertsMailBlock = ({
  data,
  isSaving,
  persist,
  serverBasePayload,
  notify,
}: AppSettingsFrameContext) => {
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
      <MailBlockedNotice mail={data?.notifications.mail} />
      <Stack spacing={SECTION_GAP}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={ROW_SPACING}
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
          <MailTestButton
            mail={data?.notifications.mail}
            kind="alert"
            label={t("settingsPage.appSettings.mail.alerts.sendExample")}
            sentMessage={t("settingsPage.appSettings.mail.alerts.exampleSent")}
            notify={notify}
          />
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
