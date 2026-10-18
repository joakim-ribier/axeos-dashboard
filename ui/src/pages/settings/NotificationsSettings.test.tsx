import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type AppSettings,
  type AppSettingsInput,
  EMPTY_NOTIFICATIONS,
} from "@/schemas/appSettingsSchema";
import { copyToClipboard } from "@/utils/clipboard";

import { NotificationsSettings } from "./NotificationsSettings";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key} ${JSON.stringify(opts)}` : key,
    i18n: { language: "fr-FR" },
  }),
}));

vi.mock("@/utils/clipboard", () => ({
  copyToClipboard: vi.fn(() => Promise.resolve()),
}));

vi.mock("axios");
const mockedAxios = vi.mocked(axios, true);

const saveSettings = vi.fn();
let settings: AppSettings;
vi.mock("@/hooks/useAppSettings", () => ({
  useAppSettings: () => ({
    data: settings,
    isLoading: false,
    saveSettings,
    isSaving: false,
    saveError: null,
  }),
}));

vi.mock("@/hooks/useAudit", () => ({
  useAuditTypes: () => ({ data: ["restart", "save_settings", "discover"] }),
}));

const noMiners: never[] = [];
vi.mock("@/hooks/useMiners", () => ({
  useMiners: () => ({ data: noMiners }),
  useUiFeatures: () => ({
    ui: { page: { settings: "enabled" } },
    isLoading: false,
  }),
}));

const SAVED_SMTP = {
  host: "smtp.example.com",
  port: 587,
  security: "starttls" as const,
  username: "axeos",
  from: "axeos@example.com",
  passwordSet: true,
};

const buildSettings = (
  mail: AppSettings["notifications"]["mail"],
  rest: Partial<AppSettings["notifications"]> = {},
): AppSettings => ({
  electricity: { ratePerKwh: 0.2, devices: [{ name: "Fan", power: 30 }] },
  pools: { dashboards: {} },
  remote: { pushURL: "", apiKey: "" },
  firmware: { repos: {} },
  defaults: { pools: { dashboards: {} }, firmware: { repos: {} } },
  readOnly: {
    feederInterval: "2m0s",
    healthCheckInterval: "1m0s",
    firmwareCacheTTL: "24h0m0s",
    auditReport: {},
  },
  notifications: { ...EMPTY_NOTIFICATIONS, ...rest, mail },
});

const k = "settingsPage.appSettings.mail";
const field = (name: string) => screen.getByLabelText(`${k}.${name}`);
const lastSave = (): AppSettingsInput =>
  saveSettings.mock.calls[saveSettings.mock.calls.length - 1][0];
// The SMTP block's Save -- the section's first (the audit report has its own).
const smtpSaveButton = () =>
  screen.getAllByRole("button", { name: "settingsPage.appSettings.save" })[0];
const testButton = () => screen.getByRole("button", { name: `${k}.test.send` });

describe("NotificationsSettings", () => {
  beforeEach(() => {
    saveSettings.mockReset();
    saveSettings.mockResolvedValue(undefined);
    mockedAxios.post.mockReset();
    settings = buildSettings({ smtp: SAVED_SMTP, to: ["me@example.com"] });
  });

  describe("SMTP server", () => {
    it("shows the saved server, never a password -- only that one is set", () => {
      render(<NotificationsSettings />);

      expect(field("smtp.hostLabel")).toHaveValue("smtp.example.com");
      expect(field("smtp.portLabel")).toHaveValue("587");
      expect(field("smtp.passwordLabel")).toHaveValue("");
      expect(field("smtp.passwordLabel")).toHaveAttribute(
        "placeholder",
        `${k}.smtp.passwordKept`,
      );
    });

    it("keeps the stored password when saving without typing one, and the other sections as saved", async () => {
      const user = userEvent.setup();
      render(<NotificationsSettings />);

      await user.clear(field("smtp.hostLabel"));
      await user.type(field("smtp.hostLabel"), "smtp.new.example");
      await user.click(smtpSaveButton());

      const saved = lastSave();
      expect(saved.notifications.mail.smtp).toEqual({
        host: "smtp.new.example",
        port: 587,
        security: "starttls",
        username: "axeos",
        from: "axeos@example.com",
        password: "",
      });
      expect(saved.notifications.mail.to).toEqual(["me@example.com"]);
      expect(saved.electricity.devices).toEqual([{ name: "Fan", power: 30 }]);
    });

    it("sends a password once one is typed", async () => {
      const user = userEvent.setup();
      render(<NotificationsSettings />);

      await user.type(field("smtp.passwordLabel"), "n3w");
      await user.click(smtpSaveButton());

      expect(lastSave().notifications.mail.smtp.password).toBe("n3w");
    });

    it("masks the password, with an eye to show it", async () => {
      const user = userEvent.setup();
      render(<NotificationsSettings />);

      expect(field("smtp.passwordLabel")).toHaveAttribute("type", "password");
      await user.click(
        screen.getByRole("button", { name: "common.showSecret" }),
      );
      expect(field("smtp.passwordLabel")).toHaveAttribute("type", "text");
    });

    it("picks the usual port when the security mode changes", async () => {
      const user = userEvent.setup();
      render(<NotificationsSettings />);

      await user.click(field("smtp.securityLabel"));
      await user.click(
        await screen.findByRole("option", { name: `${k}.smtp.security.tls` }),
      );

      expect(field("smtp.portLabel")).toHaveValue("465");
    });

    it("keeps a port of the operator's own when the security mode changes", async () => {
      const user = userEvent.setup();
      render(<NotificationsSettings />);

      await user.clear(field("smtp.portLabel"));
      await user.type(field("smtp.portLabel"), "2525");
      await user.click(field("smtp.securityLabel"));
      await user.click(
        await screen.findByRole("option", { name: `${k}.smtp.security.tls` }),
      );

      expect(field("smtp.portLabel")).toHaveValue("2525");
    });
  });

  // A form's refusal belongs in the form: nothing invalid ever reaches
  // the server (whose 400 would otherwise land in the audit).
  describe("SMTP form checks", () => {
    it("starts a blank setup on the usual port", () => {
      settings = buildSettings(EMPTY_NOTIFICATIONS.mail);
      render(<NotificationsSettings />);

      expect(field("smtp.portLabel")).toHaveValue("587");
    });

    it("won't save without a valid port", async () => {
      const user = userEvent.setup();
      render(<NotificationsSettings />);

      await user.clear(field("smtp.portLabel"));

      expect(smtpSaveButton()).toBeDisabled();
      expect(screen.getByText(`${k}.smtp.invalidPort`)).toBeInTheDocument();
      await user.type(field("smtp.portLabel"), "70000");
      expect(smtpSaveButton()).toBeDisabled();
      expect(saveSettings).not.toHaveBeenCalled();
    });

    it("won't save without a valid sender", async () => {
      const user = userEvent.setup();
      render(<NotificationsSettings />);

      await user.clear(field("smtp.fromLabel"));
      await user.type(field("smtp.fromLabel"), "not an address");

      expect(smtpSaveButton()).toBeDisabled();
      expect(screen.getByText(`${k}.smtp.invalidFrom`)).toBeInTheDocument();
    });

    it("lets a blank server through -- that's mail turned off", async () => {
      const user = userEvent.setup();
      render(<NotificationsSettings />);

      await user.clear(field("smtp.hostLabel"));
      await user.clear(field("smtp.portLabel"));
      await user.click(smtpSaveButton());

      expect(lastSave().notifications.mail.smtp.host).toBe("");
    });
  });

  describe("recipients", () => {
    it("adds a recipient alongside the existing ones", async () => {
      const user = userEvent.setup();
      render(<NotificationsSettings />);

      await user.type(field("recipients.emailLabel"), "you@example.com");
      await user.click(
        screen.getByRole("button", { name: `${k}.recipients.add` }),
      );

      expect(lastSave().notifications.mail.to).toEqual([
        "me@example.com",
        "you@example.com",
      ]);
    });

    it("can't add an invalid or already-listed address", async () => {
      const user = userEvent.setup();
      render(<NotificationsSettings />);
      const add = () =>
        screen.getByRole("button", { name: `${k}.recipients.add` });

      await user.type(field("recipients.emailLabel"), "not-an-address");
      expect(add()).toBeDisabled();

      await user.clear(field("recipients.emailLabel"));
      await user.type(field("recipients.emailLabel"), "me@example.com");
      expect(add()).toBeDisabled();
    });

    it("removes a recipient", async () => {
      const user = userEvent.setup();
      render(<NotificationsSettings />);

      await user.click(
        screen.getByRole("button", { name: `${k}.recipients.remove` }),
      );

      expect(lastSave().notifications.mail.to).toEqual([]);
    });
  });

  describe("audit report", () => {
    const r = `${k}.report`;
    // The report's own Save -- the section's last.
    const reportSaveButton = () =>
      screen
        .getAllByRole("button", { name: "settingsPage.appSettings.save" })
        .at(-1) as HTMLElement;
    const startsWith = (prefix: string) => (content: string) =>
      content.startsWith(prefix);

    it("saves the report's settings, keeping the mail as saved", async () => {
      const user = userEvent.setup();
      render(<NotificationsSettings />);

      await user.click(
        screen.getByRole("switch", { name: `${r}.enabledLabel` }),
      );
      await user.click(screen.getByLabelText(`${r}.frequencyLabel`));
      await user.click(
        await screen.findByRole("option", {
          name: `${r}.frequencies.weekly`,
        }),
      );
      await user.click(
        screen.getByRole("checkbox", { name: `${r}.skipIfEmptyLabel` }),
      );
      await user.click(reportSaveButton());

      const saved = lastSave().notifications;
      expect(saved.auditReport).toEqual({
        enabled: true,
        frequency: "weekly",
        types: [],
        skipIfEmpty: true,
      });
      expect(saved.mail.to).toEqual(["me@example.com"]);
    });

    it("keeps only the chosen types", async () => {
      const user = userEvent.setup();
      render(<NotificationsSettings />);

      await user.click(screen.getByLabelText(`${r}.typesLabel`));
      await user.click(
        await screen.findByRole("option", { name: "auditPage.types.restart" }),
      );
      await user.click(reportSaveButton());

      expect(lastSave().notifications.auditReport.types).toEqual(["restart"]);
    });

    it("shows the last report sent", () => {
      settings = buildSettings(
        { smtp: SAVED_SMTP, to: ["me@example.com"] },
        { auditReport: { ...EMPTY_NOTIFICATIONS.auditReport, enabled: true } },
      );
      settings.readOnly.auditReport = {
        lastFrom: "2026-10-15",
        lastTo: "2026-10-16",
        lastSentAt: "2026-10-16T01:00:00Z",
      };
      render(<NotificationsSettings />);

      expect(screen.getByText(startsWith(`${r}.lastSent`))).toBeInTheDocument();
    });

    it("shows the last failure over the last report sent", () => {
      settings.readOnly.auditReport = {
        lastFrom: "2026-10-14",
        lastTo: "2026-10-15",
        lastSentAt: "2026-10-15T01:00:00Z",
        lastAttemptAt: "2026-10-16T01:00:00Z",
        lastError: "535 bad credentials",
      };
      render(<NotificationsSettings />);

      expect(screen.getByText(startsWith(`${r}.lastFailed`))).toHaveTextContent(
        "535 bad credentials",
      );
      expect(
        screen.queryByText(startsWith(`${r}.lastSent`)),
      ).not.toBeInTheDocument();
    });

    it("says it never went out yet once turned on", () => {
      settings = buildSettings(
        { smtp: SAVED_SMTP, to: ["me@example.com"] },
        { auditReport: { ...EMPTY_NOTIFICATIONS.auditReport, enabled: true } },
      );
      render(<NotificationsSettings />);

      expect(screen.getByText(`${r}.neverSent`)).toBeInTheDocument();
    });
  });

  describe("test mail", () => {
    it("can't be sent before a server is saved", () => {
      settings = buildSettings({
        ...EMPTY_NOTIFICATIONS.mail,
        to: ["me@example.com"],
      });
      render(<NotificationsSettings />);

      expect(testButton()).toBeDisabled();
      expect(screen.getByText(`${k}.test.needsSmtp`)).toBeInTheDocument();
    });

    it("can't be sent without a recipient", () => {
      settings = buildSettings({ smtp: SAVED_SMTP, to: [] });
      render(<NotificationsSettings />);

      expect(testButton()).toBeDisabled();
      expect(screen.getByText(`${k}.test.needsRecipient`)).toBeInTheDocument();
    });

    it("sends it in the dashboard's language, with a toast like a save", async () => {
      const user = userEvent.setup();
      mockedAxios.post.mockResolvedValue({
        data: { sentTo: ["me@example.com"] },
      });
      render(<NotificationsSettings />);

      await user.click(testButton());

      expect(mockedAxios.post).toHaveBeenCalledWith("/api/config/mail/test", {
        lang: "fr",
      });
      expect(await screen.findByRole("alert")).toHaveTextContent(
        `${k}.test.sent`,
      );
    });

    it("shows the SMTP server's own error in a toast, ready to copy", async () => {
      const user = userEvent.setup();
      mockedAxios.post.mockRejectedValue({
        response: {
          data: {
            error: "Bad Gateway",
            message: "authentication: 535 bad credentials",
          },
        },
      });
      mockedAxios.isAxiosError.mockReturnValue(true);
      render(<NotificationsSettings />);

      await user.click(testButton());

      await waitFor(() =>
        expect(
          screen.getByText(
            `${k}.test.failed ${JSON.stringify({ error: "authentication: 535 bad credentials" })}`,
          ),
        ).toBeInTheDocument(),
      );

      await user.click(
        screen.getByRole("button", { name: "common.copyError" }),
      );
      expect(copyToClipboard).toHaveBeenCalledWith(
        "authentication: 535 bad credentials",
      );
      // Copying, or a click elsewhere, leaves it there: only ✕ closes it.
      await user.click(screen.getByText(`${k}.test.title`));
      const toast = screen.getByRole("alert");
      expect(toast).toBeVisible();

      await user.click(screen.getByRole("button", { name: "common.close" }));
      await waitFor(() =>
        expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
      );
    });
  });
});
