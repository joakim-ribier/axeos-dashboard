import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { MinerConfig } from "@/schemas/minerConfigSchema";

import { AlertThresholdsEditor } from "./AlertThresholdsEditor";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key} ${JSON.stringify(opts)}` : key,
  }),
}));

const baseMiner: MinerConfig = {
  ip: "192.168.1.65",
  hostname: "bitaxe-1",
  mac: "aabbccddeeff",
  model: "bitaxe",
  enabled: true,
  url: "stratum.example.com",
  port: 3333,
  user: "wallet.worker",
  fallbackUrl: "solo.example.com",
  fallbackPort: 4444,
  fallbackUser: "wallet.worker.fallback",
};

const defaults = { tempHigh: 65, fanHigh: 75 };

const tempInput = () =>
  screen.getByLabelText("settingsPage.configured.alerts.tempLabel");
const fanInput = () =>
  screen.getByLabelText("settingsPage.configured.alerts.fanLabel");
const saveButton = () =>
  screen.getByRole("button", { name: "settingsPage.configured.alias.save" });

describe("AlertThresholdsEditor", () => {
  it("starts empty, every miner's thresholds as placeholders, when the miner has none", () => {
    render(
      <AlertThresholdsEditor
        miner={baseMiner}
        defaults={defaults}
        saveMiners={vi.fn()}
      />,
    );

    expect(tempInput()).toHaveValue("");
    expect(tempInput()).toHaveAttribute("placeholder", "65");
    expect(fanInput()).toHaveAttribute("placeholder", "75");
    expect(saveButton()).toBeDisabled();
  });

  it("pre-fills the miner's own thresholds", () => {
    render(
      <AlertThresholdsEditor
        miner={{ ...baseMiner, alerts: { tempHigh: 0, fanHigh: 95 } }}
        defaults={defaults}
        saveMiners={vi.fn()}
      />,
    );

    expect(tempInput()).toHaveValue("");
    expect(fanInput()).toHaveValue("95");
    expect(saveButton()).toBeDisabled();
  });

  it("saves a threshold, the empty one sent as unset", async () => {
    const user = userEvent.setup();
    const saveMiners = vi.fn().mockResolvedValue([]);
    render(
      <AlertThresholdsEditor
        miner={baseMiner}
        defaults={defaults}
        saveMiners={saveMiners}
      />,
    );

    await user.type(fanInput(), "95");
    await user.click(saveButton());

    expect(saveMiners).toHaveBeenCalledWith([
      { ...baseMiner, alerts: { tempHigh: 0, fanHigh: 95 } },
    ]);
  });

  it("clears a threshold: back to every miner's", async () => {
    const user = userEvent.setup();
    const saveMiners = vi.fn().mockResolvedValue([]);
    const miner = { ...baseMiner, alerts: { tempHigh: 70, fanHigh: 95 } };
    render(
      <AlertThresholdsEditor
        miner={miner}
        defaults={defaults}
        saveMiners={saveMiners}
      />,
    );

    await user.clear(tempInput());
    await user.click(saveButton());

    expect(saveMiners).toHaveBeenCalledWith([
      { ...miner, alerts: { tempHigh: 0, fanHigh: 95 } },
    ]);
  });

  it.each([
    ["temperature under 30 °C", "temp", "20"],
    ["temperature over 100 °C", "temp", "120"],
    ["fan over 100 %", "fan", "150"],
    ["not a number", "fan", "abc"],
  ])("can't save a %s", async (_, which, value) => {
    const user = userEvent.setup();
    render(
      <AlertThresholdsEditor
        miner={baseMiner}
        defaults={defaults}
        saveMiners={vi.fn()}
      />,
    );

    const input = which === "temp" ? tempInput() : fanInput();
    await user.type(input, value);

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(saveButton()).toBeDisabled();
  });

  it("surfaces the server error when saveMiners rejects", async () => {
    const user = userEvent.setup();
    const saveMiners = vi.fn().mockRejectedValue(new Error("save failed"));
    render(
      <AlertThresholdsEditor
        miner={baseMiner}
        defaults={defaults}
        saveMiners={saveMiners}
      />,
    );

    await user.type(tempInput(), "70");
    await user.click(saveButton());

    expect(await screen.findByText("save failed")).toBeInTheDocument();
  });

  it("hides Save and disables the fields in read-only mode", () => {
    render(
      <AlertThresholdsEditor
        miner={baseMiner}
        defaults={defaults}
        saveMiners={vi.fn()}
        readOnly
      />,
    );

    expect(
      screen.queryByRole("button", {
        name: "settingsPage.configured.alias.save",
      }),
    ).not.toBeInTheDocument();
    expect(tempInput()).toBeDisabled();
    expect(fanInput()).toBeDisabled();
  });
});
