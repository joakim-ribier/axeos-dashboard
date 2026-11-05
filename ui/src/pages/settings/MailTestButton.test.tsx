import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";

import { type AppSettings } from "@/schemas/appSettingsSchema";

import { MailBlockedNotice, MailTestButton } from "./MailTestButton";

let language = "fr-FR";
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language },
  }),
}));

let mailerState: string | undefined;
vi.mock("@/hooks/useServicesStatus", () => ({
  useServicesStatus: () => ({
    data: mailerState
      ? { services: { mailer: { state: mailerState } } }
      : undefined,
  }),
}));

type Mail = AppSettings["notifications"]["mail"];

const ready: Mail = {
  smtp: {
    host: "smtp.example.com",
    port: 587,
    security: "starttls",
    username: "",
    from: "axeos@example.com",
    passwordSet: false,
  },
  to: ["me@example.com"],
};
const withSmtp = (smtp: Partial<Mail["smtp"]>): Mail => ({
  ...ready,
  smtp: { ...ready.smtp, ...smtp },
});

const k = "settingsPage.appSettings.mail.test";
const button = () => screen.getByRole("button");

const renderBoth = (mail: Mail | undefined, kind?: "alert" | "remote") => {
  const notify = vi.fn();
  render(
    <>
      <MailBlockedNotice mail={mail} />
      <MailTestButton
        mail={mail}
        kind={kind}
        label="Tester"
        sentMessage="Envoyé"
        notify={notify}
      />
    </>,
  );
  return notify;
};

describe("MailTestButton", () => {
  let post: MockInstance<typeof axios.post>;

  beforeEach(() => {
    language = "fr-FR";
    mailerState = "ok";
    post = vi.spyOn(axios, "post").mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each<[string, Mail | undefined, string]>([
    ["settings not loaded", undefined, "needsSmtp"],
    ["no host", withSmtp({ host: "" }), "needsSmtp"],
    ["no port", withSmtp({ port: 0 }), "needsSmtp"],
    ["no sender", withSmtp({ from: "" }), "needsSmtp"],
    ["no recipient", { ...ready, to: [] }, "needsRecipient"],
  ])("is greyed out and says why: %s", (_, mail, blocker) => {
    renderBoth(mail);

    expect(button()).toBeDisabled();
    expect(screen.getByText(`${k}.${blocker}`)).toBeInTheDocument();
  });

  it("tells the SMTP server first, when the recipient is missing too", () => {
    renderBoth({ ...withSmtp({ host: "" }), to: [] });

    expect(screen.getByText(`${k}.needsSmtp`)).toBeInTheDocument();
    expect(screen.queryByText(`${k}.needsRecipient`)).not.toBeInTheDocument();
  });

  it("is greyed out while the mailer doesn't answer", () => {
    mailerState = "offline";
    renderBoth(ready);

    expect(button()).toBeDisabled();
    expect(screen.getByText(`${k}.mailerDown`)).toBeInTheDocument();
  });

  // Late only means a missed run: a mail may still go out.
  it.each(["ok", "late", "unknown"])(
    "is available with the mailer %s, nothing to say",
    (state) => {
      mailerState = state;
      renderBoth(ready);

      expect(button()).toBeEnabled();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.queryByText(`${k}.mailerDown`)).not.toBeInTheDocument();
    },
  );

  it("is available before the status is known", () => {
    mailerState = undefined;
    renderBoth(ready);

    expect(button()).toBeEnabled();
  });

  it.each([
    ["fr-FR", "fr"],
    ["en-US", "en"],
  ])("sends in the dashboard's language: %s", async (browser, lang) => {
    language = browser;
    const user = userEvent.setup();
    const notify = renderBoth(ready, "remote");

    await user.click(button());

    expect(post).toHaveBeenCalledWith("/api/config/mail/test", {
      lang,
      kind: "remote",
    });
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Envoyé"));
  });

  it("reports a failure with its reason", async () => {
    post.mockRejectedValue(new Error("connection refused"));
    const user = userEvent.setup();
    const notify = renderBoth(ready);

    await user.click(button());

    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(`${k}.failed`, "connection refused"),
    );
    expect(button()).toBeEnabled();
  });
});
