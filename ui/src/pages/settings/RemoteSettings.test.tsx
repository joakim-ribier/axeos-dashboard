import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type AppSettings,
  EMPTY_NOTIFICATIONS,
} from "@/schemas/appSettingsSchema";

import { RemoteSettings } from "./RemoteSettings";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

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

const noMiners: never[] = [];
vi.mock("@/hooks/useMiners", () => ({
  useMiners: () => ({ data: noMiners }),
  useUiFeatures: () => ({
    ui: { page: { settings: "enabled" } },
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useRemoteBoard", () => ({
  useRemoteBoard: () => ({ data: undefined }),
}));

const k = "settingsPage.appSettings.remote";
const pushUrl = () => screen.getByLabelText(`${k}.pushUrlLabel`);
const save = () =>
  screen.getByRole("button", { name: "settingsPage.appSettings.save" });

// A form's refusal belongs in the form: nothing invalid ever reaches the
// server (whose 400 would otherwise land in the audit).
describe("RemoteSettings -- push URL check", () => {
  beforeEach(() => {
    saveSettings.mockReset();
    saveSettings.mockResolvedValue(undefined);
    settings = {
      electricity: { ratePerKwh: 0.2 },
      pools: { dashboards: {} },
      remote: {
        pushURL: "",
        apiKey: "",
        sendUser: false,
        sendPools: false,
        sendIP: false,
      },
      firmware: { repos: {} },
      defaults: { pools: { dashboards: {} }, firmware: { repos: {} } },
      readOnly: {
        feederInterval: "2m0s",
        healthCheckInterval: "1m0s",
        firmwareCacheTTL: "24h0m0s",
        auditReport: {},
      },
      notifications: EMPTY_NOTIFICATIONS,
    };
  });

  it("won't save an address that isn't http(s)", async () => {
    const user = userEvent.setup();
    render(<RemoteSettings />);

    await user.type(pushUrl(), "hashboard.live/api/push");

    expect(save()).toBeDisabled();
    expect(screen.getByText(`${k}.invalidPushUrl`)).toBeInTheDocument();
  });

  it("saves a valid address", async () => {
    const user = userEvent.setup();
    render(<RemoteSettings />);

    await user.type(pushUrl(), "https://hashboard.live/api/push");
    await user.click(save());

    expect(saveSettings.mock.calls[0][0].remote.pushURL).toBe(
      "https://hashboard.live/api/push",
    );
  });

  it("saves a blank address -- that's the push turned off", async () => {
    const user = userEvent.setup();
    render(<RemoteSettings />);

    await user.click(save());

    expect(saveSettings.mock.calls[0][0].remote.pushURL).toBe("");
  });
});

describe("RemoteSettings -- sensitive data", () => {
  const toggle = (name: "user" | "pools" | "ip") =>
    screen.getByRole("switch", { name: `${k}.shared.${name}` });

  beforeEach(() => {
    saveSettings.mockReset();
    saveSettings.mockResolvedValue(undefined);
    settings = {
      electricity: { ratePerKwh: 0.2 },
      pools: { dashboards: {} },
      remote: {
        pushURL: "https://hashboard.live/api/push",
        apiKey: "key",
        sendUser: false,
        sendPools: true,
        sendIP: false,
      },
      firmware: { repos: {} },
      defaults: { pools: { dashboards: {} }, firmware: { repos: {} } },
      readOnly: {
        feederInterval: "2m0s",
        healthCheckInterval: "1m0s",
        firmwareCacheTTL: "24h0m0s",
        auditReport: {},
      },
      notifications: EMPTY_NOTIFICATIONS,
    };
  });

  it("shows what is shared and what stays private", () => {
    render(<RemoteSettings />);

    expect(toggle("user")).not.toBeChecked();
    expect(toggle("pools")).toBeChecked();
    expect(toggle("ip")).not.toBeChecked();
    expect(screen.getAllByText(`${k}.shared.notSent`)).toHaveLength(1);
    expect(screen.getAllByText(`${k}.shared.sent`)).toHaveLength(1);
    // The IP isn't left out but replaced.
    expect(screen.getAllByText(`${k}.shared.masked`)).toHaveLength(1);
  });

  it("saves a toggle on its own, nothing else changed", async () => {
    const user = userEvent.setup();
    render(<RemoteSettings />);

    await user.click(toggle("user"));

    expect(saveSettings).toHaveBeenCalledTimes(1);
    expect(saveSettings.mock.calls[0][0].remote).toEqual({
      ...settings.remote,
      sendUser: true,
    });
  });

  it("keeps the saved toggles when the connection is saved", async () => {
    const user = userEvent.setup();
    render(<RemoteSettings />);

    await user.clear(pushUrl());
    await user.type(pushUrl(), "https://elsewhere.example/api/push");
    await user.click(save());

    expect(saveSettings.mock.calls[0][0].remote).toEqual({
      ...settings.remote,
      pushURL: "https://elsewhere.example/api/push",
    });
  });
});
