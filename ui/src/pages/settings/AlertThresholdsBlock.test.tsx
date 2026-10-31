import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type AlertThresholds,
  type AppSettings,
  EMPTY_NOTIFICATIONS,
} from "@/schemas/appSettingsSchema";

import { SystemSettings } from "./SystemSettings";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key} ${JSON.stringify(opts)}` : key,
    i18n: { language: "en" },
  }),
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

const buildSettings = (alerts: AlertThresholds): AppSettings => ({
  electricity: { ratePerKwh: 0.2, devices: [] },
  pools: { dashboards: {} },
  remote: {
    pushURL: "",
    apiKey: "",
    sendUser: false,
    sendPools: false,
    sendIP: false,
  },
  firmware: { repos: {} },
  defaults: {
    pools: { dashboards: {} },
    firmware: { repos: {} },
    alerts: { tempHigh: 62, fanHigh: 75 },
  },
  alerts,
  readOnly: {
    feederInterval: "2m0s",
    healthCheckInterval: "1m0s",
    firmwareCacheTTL: "24h0m0s",
    auditReport: {},
    alertsMail: {},
  },
  notifications: EMPTY_NOTIFICATIONS,
});

const key = "settingsPage.appSettings.alerts";
const tempInput = () => screen.getByLabelText(`${key}.tempLabel`);
const fanInput = () => screen.getByLabelText(`${key}.fanLabel`);
const saveButton = () =>
  screen.getByRole("button", { name: "settingsPage.appSettings.save" });

describe("SystemSettings -- alert thresholds", () => {
  beforeEach(() => {
    saveSettings.mockReset();
    saveSettings.mockResolvedValue(undefined);
    settings = buildSettings({ tempHigh: 0, fanHigh: 80 });
  });

  it("shows the saved thresholds, the built-in ones as placeholders", () => {
    render(<SystemSettings />);

    expect(tempInput()).toHaveValue("");
    expect(tempInput()).toHaveAttribute("placeholder", "62");
    expect(fanInput()).toHaveValue("80");
    expect(fanInput()).toHaveAttribute("placeholder", "75");
    expect(saveButton()).toBeDisabled();
  });

  it("saves the thresholds, keeping the rest of the settings", async () => {
    const user = userEvent.setup();
    render(<SystemSettings />);

    await user.type(tempInput(), "65");
    await user.clear(fanInput());
    await user.click(saveButton());

    expect(saveSettings).toHaveBeenCalledTimes(1);
    const payload = saveSettings.mock.calls[0][0];
    expect(payload.alerts).toEqual({ tempHigh: 65, fanHigh: 0 });
    expect(payload.electricity.ratePerKwh).toBe(0.2);
  });

  it("can't save a threshold out of bounds", async () => {
    const user = userEvent.setup();
    render(<SystemSettings />);

    await user.type(tempInput(), "150");

    expect(tempInput()).toHaveAttribute("aria-invalid", "true");
    expect(saveButton()).toBeDisabled();
  });
});
