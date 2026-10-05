import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppSettings, PowerDevice } from "@/schemas/appSettingsSchema";

import { AppSettingsSection } from "./AppSettingsSection";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key} ${JSON.stringify(opts)}` : key,
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

// Same reference on every render: the component re-runs an effect whenever
// the miners list changes, so a fresh [] each time would loop forever.
const noMiners: never[] = [];
vi.mock("@/hooks/useMiners", () => ({
  useMiners: () => ({ data: noMiners }),
}));

const buildSettings = (devices: PowerDevice[]): AppSettings => ({
  electricity: { ratePerKwh: 0.2, devices },
  pools: { dashboards: {} },
  remote: { pushURL: "", apiKey: "" },
  firmware: { repos: {} },
  defaults: { pools: { dashboards: {} }, firmware: { repos: {} } },
  readOnly: {
    feederInterval: "2m0s",
    healthCheckInterval: "1m0s",
    firmwareCacheTTL: "24h0m0s",
    remotePushMinersConfig: {},
    remotePushSettingsConfig: {},
  },
});

const key = "settingsPage.appSettings.electricity.devices";
const nameInput = () => screen.getByLabelText(`${key}.nameLabel`);
const powerInput = () => screen.getByLabelText(`${key}.powerLabel`);
const addButton = () => screen.getByRole("button", { name: `${key}.add` });

describe("AppSettingsSection -- other devices", () => {
  beforeEach(() => {
    saveSettings.mockReset();
    saveSettings.mockResolvedValue(undefined);
    settings = buildSettings([{ name: "Fan", power: 30 }]);
  });

  it("lists the declared devices", () => {
    render(<AppSettingsSection />);

    const row = screen.getByText("Fan").closest("tr");
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText("30 W")).toBeInTheDocument();
  });

  it("saves a new device alongside the existing ones, keeping the rate", async () => {
    const user = userEvent.setup();
    render(<AppSettingsSection />);

    await user.type(nameInput(), "  Router  ");
    await user.type(powerInput(), "8");
    await user.click(addButton());

    expect(saveSettings).toHaveBeenCalledTimes(1);
    expect(saveSettings.mock.calls[0][0].electricity).toEqual({
      ratePerKwh: 0.2,
      devices: [
        { name: "Fan", power: 30 },
        { name: "Router", power: 8 },
      ],
    });
  });

  it("replaces a device added again under the same name", async () => {
    const user = userEvent.setup();
    render(<AppSettingsSection />);

    await user.type(nameInput(), "Fan");
    await user.type(powerInput(), "45");
    await user.click(addButton());

    expect(saveSettings.mock.calls[0][0].electricity.devices).toEqual([
      { name: "Fan", power: 45 },
    ]);
  });

  it("removes a device, keeping the rate", async () => {
    const user = userEvent.setup();
    render(<AppSettingsSection />);

    await user.click(screen.getByRole("button", { name: `${key}.remove` }));

    expect(saveSettings.mock.calls[0][0].electricity).toEqual({
      ratePerKwh: 0.2,
      devices: [],
    });
  });

  it("can't add a device without a name or a positive power", async () => {
    const user = userEvent.setup();
    render(<AppSettingsSection />);

    await user.type(powerInput(), "30");
    expect(addButton()).toBeDisabled();

    await user.type(nameInput(), "Router");
    await user.clear(powerInput());
    await user.type(powerInput(), "0");
    expect(addButton()).toBeDisabled();
  });

  it("only accepts whole numbers as power", async () => {
    const user = userEvent.setup();
    render(<AppSettingsSection />);

    await user.type(powerInput(), "3a0.5-");

    expect(powerInput()).toHaveValue("305");
  });

  it("only accepts a decimal number as rate, with a comma read as a dot", async () => {
    const user = userEvent.setup();
    render(<AppSettingsSection />);
    const rateInput = screen.getByLabelText(
      "settingsPage.appSettings.electricity.rateLabel",
    );

    await user.clear(rateInput);
    await user.type(rateInput, "0,19a1.5-");

    expect(rateInput).toHaveValue("0.1915");
  });

  it("keeps the devices when saving the rate", async () => {
    const user = userEvent.setup();
    render(<AppSettingsSection />);

    const [saveRate] = screen.getAllByRole("button", {
      name: "settingsPage.appSettings.save",
    });
    await user.click(saveRate);

    expect(saveSettings.mock.calls[0][0].electricity.devices).toEqual([
      { name: "Fan", power: 30 },
    ]);
  });

  it("shows the devices without any way to edit them when read-only", () => {
    render(<AppSettingsSection readOnly />);

    expect(screen.getByText("Fan")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: `${key}.add` }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: `${key}.remove` }),
    ).not.toBeInTheDocument();
  });
});
