// src/pages/settings/MailTestButton.tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import SendIcon from "@mui/icons-material/Send";
import { Box } from "@mui/material";
import axios from "axios";

import { ActionButton } from "@/components/ui/ActionButton";
import { AlertList } from "@/components/ui/AlertList";
import { SECTION_GAP } from "@/components/ui/SectionLayout";
import { useServicesStatus } from "@/hooks/useServicesStatus";
import { type AppSettings } from "@/schemas/appSettingsSchema";
import { extractErrorMessage } from "@/utils/apiError";

type MailSettings = AppSettings["notifications"]["mail"] | undefined;

const useMailBlocker = (mail: MailSettings) => {
  const { data: status } = useServicesStatus();
  if (!(mail?.smtp.host && mail.smtp.port && mail.smtp.from))
    return "needsSmtp";
  if (mail.to.length === 0) return "needsRecipient";
  return status?.services.mailer.state === "offline" ? "mailerDown" : null;
};

/** Greyed out while no mail could go out -- MailBlockedNotice says why. */
export const MailTestButton = ({
  mail,
  kind,
  label,
  sentMessage,
  notify,
}: {
  mail: MailSettings;
  kind?: "alert" | "audit" | "remote";
  label: string;
  sentMessage: string;
  notify: (message: string, error?: string) => void;
}) => {
  const { t, i18n } = useTranslation();
  const blocker = useMailBlocker(mail);
  const [sending, setSending] = useState(false);

  const send = async () => {
    setSending(true);
    try {
      await axios.post("/api/config/mail/test", {
        lang: i18n.language.startsWith("fr") ? "fr" : "en",
        kind,
      });
      notify(sentMessage);
    } catch (err: unknown) {
      const error = extractErrorMessage(err);
      notify(t("settingsPage.appSettings.mail.test.failed", { error }), error);
    } finally {
      setSending(false);
    }
  };

  return (
    <ActionButton
      icon={<SendIcon fontSize="small" />}
      loading={sending}
      disabled={blocker !== null}
      onClick={() => void send()}
    >
      {sending ? t("settingsPage.appSettings.mail.test.sending") : label}
    </ActionButton>
  );
};

export const MailBlockedNotice = ({ mail }: { mail: MailSettings }) => {
  const { t } = useTranslation();
  const blocker = useMailBlocker(mail);
  if (!blocker) return null;
  return (
    <Box sx={{ mb: SECTION_GAP }}>
      <AlertList
        severity="warning"
        items={[t(`settingsPage.appSettings.mail.test.${blocker}`)]}
      />
    </Box>
  );
};
