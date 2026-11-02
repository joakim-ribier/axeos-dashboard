import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AlertThresholdsForm } from "./AlertThresholdsForm";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key} ${JSON.stringify(opts)}` : key,
  }),
}));

const unset = { tempHigh: 0, fanHigh: 0, tempMargin: 0, fanMargin: 0 };
const builtIn = { tempHigh: 62, fanHigh: 75, tempMargin: 2, fanMargin: 5 };

const input = (key: string) => screen.getByLabelText(`alertThresholds.${key}`);
const saveButton = () =>
  screen.getByRole("button", { name: "alertThresholds.save" });
const backToNormal = (value: string) =>
  screen.queryByText(`alertThresholds.backToNormal {"value":"${value}"}`);

describe("AlertThresholdsForm", () => {
  it("shows a field per threshold, the margins only when asked", () => {
    const { rerender } = render(
      <AlertThresholdsForm
        saved={unset}
        placeholders={builtIn}
        onSave={vi.fn()}
      />,
    );

    expect(input("tempHigh")).toHaveAttribute("placeholder", "62");
    expect(input("fanHigh")).toHaveAttribute("placeholder", "75");
    expect(
      screen.queryByLabelText("alertThresholds.tempMargin"),
    ).not.toBeInTheDocument();

    rerender(
      <AlertThresholdsForm
        saved={unset}
        placeholders={builtIn}
        withMargins
        onSave={vi.fn()}
      />,
    );

    expect(input("tempMargin")).toHaveAttribute("placeholder", "2");
    expect(input("fanMargin")).toHaveAttribute("placeholder", "5");
  });

  it("draws a gauge per measure, with where its alert ends", () => {
    render(
      <AlertThresholdsForm
        saved={unset}
        placeholders={builtIn}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getAllByTestId("threshold-bar")).toHaveLength(2);
    expect(backToNormal("60 °C")).toBeInTheDocument();
    expect(backToNormal("70 %")).toBeInTheDocument();
  });

  it("follows what's typed, as it's typed", async () => {
    const user = userEvent.setup();
    render(
      <AlertThresholdsForm
        saved={unset}
        placeholders={builtIn}
        withMargins
        onSave={vi.fn()}
      />,
    );

    await user.type(input("tempHigh"), "70");
    expect(backToNormal("68 °C")).toBeInTheDocument();

    await user.type(input("tempMargin"), "5");
    expect(backToNormal("65 °C")).toBeInTheDocument();
  });

  it("gives the miner's current readings when it has them", () => {
    render(
      <AlertThresholdsForm
        saved={unset}
        placeholders={builtIn}
        current={{ temp: 58.4, fan: 88 }}
        onSave={vi.fn()}
      />,
    );

    expect(
      screen.getByText('alertThresholds.now {"value":"58 °C"}'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('alertThresholds.now {"value":"88 %"}'),
    ).toBeInTheDocument();
  });

  it("saves every value, an empty one as unset", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <AlertThresholdsForm
        saved={{ ...unset, fanHigh: 80 }}
        placeholders={builtIn}
        withMargins
        onSave={onSave}
      />,
    );

    expect(saveButton()).toBeDisabled();
    await user.type(input("fanMargin"), "10");
    await user.clear(input("fanHigh"));
    await user.click(saveButton());

    expect(onSave).toHaveBeenCalledWith({ ...unset, fanMargin: 10 });
  });

  it.each([
    ["temperature margin over 20 °C", "tempMargin", "25"],
    ["fan margin over 50 %", "fanMargin", "60"],
    ["fan threshold over 100 %", "fanHigh", "150"],
  ])("can't save a %s", async (_, key, value) => {
    const user = userEvent.setup();
    render(
      <AlertThresholdsForm
        saved={unset}
        placeholders={builtIn}
        withMargins
        onSave={vi.fn()}
      />,
    );

    await user.type(input(key), value);

    expect(input(key)).toHaveAttribute("aria-invalid", "true");
    expect(saveButton()).toBeDisabled();
  });

  it("hides Save and disables the fields in read-only mode", () => {
    render(
      <AlertThresholdsForm
        saved={unset}
        placeholders={builtIn}
        withMargins
        onSave={vi.fn()}
        readOnly
      />,
    );

    expect(
      screen.queryByRole("button", { name: "alertThresholds.save" }),
    ).not.toBeInTheDocument();
    for (const key of ["tempHigh", "tempMargin", "fanHigh", "fanMargin"]) {
      expect(input(key)).toBeDisabled();
    }
  });
});
