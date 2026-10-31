// src/pages/settings/NotificationsSettings.tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DnsIcon from "@mui/icons-material/Dns";
import GroupIcon from "@mui/icons-material/Group";
import SaveIcon from "@mui/icons-material/Save";
import SendIcon from "@mui/icons-material/Send";
import {
  Box,
  IconButton,
  MenuItem,
  Stack,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import axios from "axios";

import { ActionButton } from "@/components/ui/ActionButton";
import { DataTable } from "@/components/ui/DataTable";
import { SecretField } from "@/components/ui/SecretField";
import { SectionDivider } from "@/components/ui/SectionDivider";
import { type SmtpSecurity } from "@/schemas/appSettingsSchema";

import { AlertsMailBlock } from "./AlertsMailBlock";
import {
  AppSettingsFrame,
  type AppSettingsFrameContext,
} from "./AppSettingsFrame";
import { AuditReportBlock } from "./AuditReportBlock";
import { SectionTitle } from "./SectionTitle";

const SECURITIES: SmtpSecurity[] = ["starttls", "tls", "none"];

const MAIL_LANGUAGES = ["fr", "en"] as const;

// The port each mode almost always goes with -- picked for the operator
// when switching modes, unless they typed one of their own.
const DEFAULT_PORT: Record<SmtpSecurity, number> = {
  starttls: 587,
  tls: 465,
  none: 25,
};

// Good enough to catch a typo -- the server does the real check.
const looksLikeEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const NotificationsSection = ({
  data,
  isSaving,
  persist,
  serverBasePayload,
  notify,
}: AppSettingsFrameContext) => {
  const { t, i18n } = useTranslation();
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [security, setSecurity] = useState<SmtpSecurity>("starttls");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [from, setFrom] = useState("");
  const [newRecipient, setNewRecipient] = useState("");
  const [testing, setTesting] = useState(false);
  const [sendingExample, setSendingExample] = useState(false);

  const saved = data?.notifications;

  useEffect(() => {
    if (!saved) return;
    setHost(saved.mail.smtp.host);
    // A blank setup starts on the usual port of the default mode.
    setPort(
      String(
        saved.mail.smtp.port ||
          DEFAULT_PORT[saved.mail.smtp.security || "starttls"],
      ),
    );
    setSecurity(saved.mail.smtp.security || "starttls");
    setUsername(saved.mail.smtp.username);
    setPassword("");
    setFrom(saved.mail.smtp.from);
  }, [saved]);

  const recipients = saved?.mail.to ?? [];

  // Until they're ever set, the mails follow the dashboard's own language,
  // and link back to the address this page is open at.
  const [mailLanguage, setMailLanguage] = useState("en");
  const [dashboardURL, setDashboardURL] = useState("");
  useEffect(() => {
    if (!saved) return;
    setMailLanguage(
      saved.language || (i18n.language.startsWith("fr") ? "fr" : "en"),
    );
    setDashboardURL(saved.dashboardURL || window.location.origin);
  }, [saved, i18n.language]);

  // Checked before sending, as the server would refuse it.
  const dashboardURLInvalid = (() => {
    const value = dashboardURL.trim();
    if (!value) return false;
    try {
      const u = new URL(value);
      return !["http:", "https:"].includes(u.protocol) || !u.host;
    } catch {
      return true;
    }
  })();

  const handleSaveMailFormat = () => {
    if (dashboardURLInvalid) return;
    const base = serverBasePayload();
    return persist({
      ...base,
      notifications: {
        ...base.notifications,
        language: mailLanguage,
        dashboardURL: dashboardURL.trim(),
      },
    });
  };
  const smtpConfigured = Boolean(
    saved?.mail.smtp.host && saved.mail.smtp.port && saved.mail.smtp.from,
  );

  // Checked here, before anything is sent: the server would refuse these
  // anyway, but a form's refusal belongs in the form. A blank server is
  // fine -- it turns mail off.
  const serverSet = host.trim() !== "";
  const portNumber = Number(port);
  const portInvalid =
    serverSet &&
    !(Number.isInteger(portNumber) && portNumber >= 1 && portNumber <= 65535);
  const fromInvalid = serverSet && !looksLikeEmail(from.trim());
  const smtpErrors = [
    portInvalid && t("settingsPage.appSettings.mail.smtp.invalidPort"),
    fromInvalid && t("settingsPage.appSettings.mail.smtp.invalidFrom"),
  ].filter((e): e is string => Boolean(e));

  const handleSecurityChange = (next: SmtpSecurity) => {
    const current = Number(port);
    if (!port || Object.values(DEFAULT_PORT).includes(current)) {
      setPort(String(DEFAULT_PORT[next]));
    }
    setSecurity(next);
  };

  const handleSaveSmtp = () => {
    if (smtpErrors.length > 0) return;
    const base = serverBasePayload();
    return persist({
      ...base,
      notifications: {
        ...base.notifications,
        mail: {
          ...base.notifications.mail,
          smtp: {
            host: host.trim(),
            port: Number(port) || 0,
            security,
            username: username.trim(),
            // Blank keeps the stored password (see handler.keepMailSecrets).
            password,
            from: from.trim(),
          },
        },
      },
    });
  };

  const persistRecipients = (to: string[]) => {
    const base = serverBasePayload();
    return persist({
      ...base,
      notifications: {
        ...base.notifications,
        mail: { ...base.notifications.mail, to },
      },
    });
  };

  const newRecipientValue = newRecipient.trim();
  const isNewRecipientValid =
    looksLikeEmail(newRecipientValue) &&
    !recipients.includes(newRecipientValue);

  const handleAddRecipient = () => {
    if (!isNewRecipientValid) return;
    setNewRecipient("");
    return persistRecipients([...recipients, newRecipientValue]);
  };

  const testBlocker = !smtpConfigured
    ? "needsSmtp"
    : recipients.length === 0
      ? "needsRecipient"
      : null;

  // kind "alert": an example of the alerts mail, with made-up alerts.
  const handleSendTest = async (kind?: "alert") => {
    const setSending = kind ? setSendingExample : setTesting;
    setSending(true);
    try {
      await axios.post("/api/config/mail/test", {
        lang: i18n.language.startsWith("fr") ? "fr" : "en",
        kind,
      });
      notify(
        kind
          ? t("settingsPage.appSettings.mail.alerts.exampleSent")
          : t("settingsPage.appSettings.mail.test.sent"),
      );
    } catch (err) {
      const body = axios.isAxiosError<{ error?: string; message?: string }>(err)
        ? err.response?.data
        : undefined;
      const error =
        body?.message ||
        body?.error ||
        t("settingsPage.appSettings.mail.test.unknownError");
      notify(t("settingsPage.appSettings.mail.test.failed", { error }), error);
    } finally {
      setSending(false);
    }
  };

  return (
    <Stack spacing={4}>
      {/* SMTP server */}
      <Box>
        <SectionTitle
          icon={<DnsIcon fontSize="small" />}
          title={t("settingsPage.appSettings.mail.smtp.title")}
          description={t("settingsPage.appSettings.mail.smtp.description")}
        />
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              size="small"
              label={t("settingsPage.appSettings.mail.smtp.hostLabel")}
              placeholder="smtp.example.com"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <TextField
              size="small"
              label={t("settingsPage.appSettings.mail.smtp.portLabel")}
              placeholder="587"
              value={port}
              error={portInvalid}
              onChange={(e) => setPort(e.target.value.replace(/\D/g, ""))}
              slotProps={{
                htmlInput: { inputMode: "numeric" },
                inputLabel: { shrink: true },
              }}
              sx={{ width: { sm: 120 }, flexShrink: 0 }}
            />
            <TextField
              select
              size="small"
              label={t("settingsPage.appSettings.mail.smtp.securityLabel")}
              value={security}
              onChange={(e) =>
                handleSecurityChange(e.target.value as SmtpSecurity)
              }
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ width: { sm: 180 }, flexShrink: 0 }}
            >
              {SECURITIES.map((s) => (
                <MenuItem key={s} value={s}>
                  {t(`settingsPage.appSettings.mail.smtp.security.${s}`)}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              size="small"
              label={t("settingsPage.appSettings.mail.smtp.usernameLabel")}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <SecretField
              size="small"
              label={t("settingsPage.appSettings.mail.smtp.passwordLabel")}
              placeholder={
                saved?.mail.smtp.passwordSet
                  ? t("settingsPage.appSettings.mail.smtp.passwordKept")
                  : ""
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
          </Stack>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            alignItems={{ xs: "stretch", sm: "center" }}
          >
            <TextField
              size="small"
              label={t("settingsPage.appSettings.mail.smtp.fromLabel")}
              placeholder="axeos@example.com"
              value={from}
              error={fromInvalid}
              onChange={(e) => setFrom(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <ActionButton
              icon={<SaveIcon fontSize="small" />}
              loading={isSaving}
              disabled={smtpErrors.length > 0}
              onClick={() => void handleSaveSmtp()}
            >
              {isSaving
                ? t("settingsPage.appSettings.saving")
                : t("settingsPage.appSettings.save")}
            </ActionButton>
          </Stack>
          {smtpErrors.map((error) => (
            <Typography key={error} variant="caption" color="error">
              {error}
            </Typography>
          ))}
        </Stack>
      </Box>

      <SectionDivider />

      {/* Recipients */}
      <Box>
        <SectionTitle
          icon={<GroupIcon fontSize="small" />}
          title={t("settingsPage.appSettings.mail.recipients.title")}
          description={t(
            "settingsPage.appSettings.mail.recipients.description",
          )}
        />
        <DataTable>
          <TableHead>
            <TableRow>
              <TableCell>
                {t("settingsPage.appSettings.mail.recipients.emailLabel")}
              </TableCell>
              <TableCell align="right" sx={{ width: 56 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {recipients.length === 0 && (
              <TableRow>
                <TableCell colSpan={2}>
                  <Typography variant="caption" color="text.disabled">
                    {t("settingsPage.appSettings.mail.recipients.empty")}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {recipients.map((to) => (
              <TableRow hover key={to}>
                <TableCell sx={{ fontFamily: "monospace" }}>{to}</TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    disabled={isSaving}
                    onClick={() =>
                      void persistRecipients(recipients.filter((r) => r !== to))
                    }
                    aria-label={t(
                      "settingsPage.appSettings.mail.recipients.remove",
                    )}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </DataTable>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems={{ xs: "stretch", sm: "center" }}
          sx={{ mt: 2 }}
        >
          <TextField
            size="small"
            label={t("settingsPage.appSettings.mail.recipients.emailLabel")}
            placeholder="moi@example.com"
            value={newRecipient}
            onChange={(e) => setNewRecipient(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleAddRecipient();
            }}
            slotProps={{ inputLabel: { shrink: true } }}
            fullWidth
          />
          <ActionButton
            icon={<AddIcon fontSize="small" />}
            disabled={isSaving || !isNewRecipientValid}
            onClick={() => void handleAddRecipient()}
          >
            {t("settingsPage.appSettings.mail.recipients.add")}
          </ActionButton>
        </Stack>
        {/* How the mails read: their language, and the dashboard's own
            address for their links. */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems={{ xs: "stretch", sm: "center" }}
          sx={{ mt: 2 }}
        >
          <TextField
            select
            size="small"
            label={t("settingsPage.appSettings.mail.languageLabel")}
            value={mailLanguage}
            onChange={(e) => setMailLanguage(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: { sm: 200 }, flexShrink: 0 }}
          >
            {MAIL_LANGUAGES.map((lang) => (
              <MenuItem key={lang} value={lang}>
                {t(`settingsPage.appSettings.mail.languages.${lang}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label={t("settingsPage.appSettings.mail.dashboardUrlLabel")}
            placeholder="http://192.168.1.60"
            value={dashboardURL}
            error={dashboardURLInvalid}
            onChange={(e) => setDashboardURL(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            fullWidth
          />
          <ActionButton
            icon={<SaveIcon fontSize="small" />}
            loading={isSaving}
            disabled={dashboardURLInvalid}
            onClick={() => void handleSaveMailFormat()}
          >
            {isSaving
              ? t("settingsPage.appSettings.saving")
              : t("settingsPage.appSettings.save")}
          </ActionButton>
        </Stack>
        {dashboardURLInvalid && (
          <Typography
            variant="caption"
            color="error"
            sx={{ display: "block", mt: 1 }}
          >
            {t("settingsPage.appSettings.mail.invalidDashboardUrl")}
          </Typography>
        )}

        {/* Test mail: the server and recipients above, checked right away. */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems={{ xs: "stretch", sm: "center" }}
          sx={{ mt: 3 }}
        >
          <ActionButton
            icon={<SendIcon fontSize="small" />}
            loading={testing}
            disabled={testBlocker !== null}
            onClick={() => void handleSendTest()}
          >
            {testing
              ? t("settingsPage.appSettings.mail.test.sending")
              : t("settingsPage.appSettings.mail.test.send")}
          </ActionButton>
          {testBlocker && (
            <Typography variant="body2" color="text.secondary">
              {t(`settingsPage.appSettings.mail.test.${testBlocker}`)}
            </Typography>
          )}
        </Stack>
      </Box>

      <SectionDivider />

      <AuditReportBlock
        data={data}
        readOnly={false}
        isSaving={isSaving}
        persist={persist}
        serverBasePayload={serverBasePayload}
        notify={notify}
      />

      <SectionDivider />

      <AlertsMailBlock
        data={data}
        readOnly={false}
        isSaving={isSaving}
        persist={persist}
        serverBasePayload={serverBasePayload}
        notify={notify}
        sending={sendingExample}
        blocked={testBlocker !== null}
        onSendExample={() => void handleSendTest("alert")}
      />
    </Stack>
  );
};

// Never shown read-only (see Settings): a board never receives the mail
// settings, and they're nobody else's business anyway.
export const NotificationsSettings = () => (
  <AppSettingsFrame>
    {(ctx) => <NotificationsSection {...ctx} />}
  </AppSettingsFrame>
);
