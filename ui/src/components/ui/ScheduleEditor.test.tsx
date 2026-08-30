import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { MinerConfig } from "@/schemas/minerConfigSchema";

import { ScheduleEditor } from "./ScheduleEditor";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key} ${JSON.stringify(opts)}` : key,
    i18n: { language: "en" },
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
  fallbackPort: 3333,
  fallbackUser: "wallet.worker",
};

describe("ScheduleEditor", () => {
  it("shows the empty state when the miner has no schedule", () => {
    render(<ScheduleEditor miner={baseMiner} saveMiners={vi.fn()} />);

    expect(
      screen.getByText("settingsPage.configured.schedule.empty"),
    ).toBeInTheDocument();
  });

  it("lists existing schedule entries with their cron, action and translated description", () => {
    const miner: MinerConfig = {
      ...baseMiner,
      schedule: [{ cron: "59 59 23 * * FRI", action: "switch_fallback" }],
    };
    render(<ScheduleEditor miner={miner} saveMiners={vi.fn()} />);

    expect(screen.getByText("59 59 23 * * FRI")).toBeInTheDocument();
    // The action select's own value box also reads "...switch_fallback" it
    // defaults to "restart", so the list entry's Chip is the only match
    // here -- not asserting an exact count to avoid coupling this test to
    // the select's default value.
    expect(
      screen.getAllByText("settingsPage.configured.schedule.switch_fallback")
        .length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Friday/i)).toBeInTheDocument();
  });

  it("disables Add and shows an error for an invalid cron expression", async () => {
    const user = userEvent.setup();
    render(<ScheduleEditor miner={baseMiner} saveMiners={vi.fn()} />);

    await user.type(
      screen.getByLabelText("settingsPage.configured.schedule.cronLabel"),
      "not a cron expression",
    );

    expect(
      screen.getByText("settingsPage.configured.schedule.invalidCron"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /schedule\.add$/ }),
    ).toBeDisabled();
  });

  it("enables Add and previews the translation + next runs for a valid cron", async () => {
    const user = userEvent.setup();
    render(<ScheduleEditor miner={baseMiner} saveMiners={vi.fn()} />);

    await user.type(
      screen.getByLabelText("settingsPage.configured.schedule.cronLabel"),
      "59 59 23 * * FRI",
    );

    expect(screen.getByText(/Friday/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /schedule\.add$/ }),
    ).not.toBeDisabled();
  });

  it("rejects a cron that duplicates an already-scheduled entry, even with different spacing/case", async () => {
    const user = userEvent.setup();
    const miner: MinerConfig = {
      ...baseMiner,
      schedule: [{ cron: "59 59 23 * * FRI", action: "switch_fallback" }],
    };
    render(<ScheduleEditor miner={miner} saveMiners={vi.fn()} />);

    await user.type(
      screen.getByLabelText("settingsPage.configured.schedule.cronLabel"),
      "59  59 23 * * fri",
    );

    expect(
      screen.getByText("settingsPage.configured.schedule.duplicateCron"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /schedule\.add$/ }),
    ).toBeDisabled();
  });

  it("adds a new schedule entry via saveMiners and clears the input on success", async () => {
    const user = userEvent.setup();
    const saveMiners = vi.fn().mockResolvedValue([]);
    render(<ScheduleEditor miner={baseMiner} saveMiners={saveMiners} />);

    const cronInput = screen.getByLabelText(
      "settingsPage.configured.schedule.cronLabel",
    );
    await user.type(cronInput, "59 59 23 * * FRI");
    await user.click(screen.getByRole("button", { name: /schedule\.add$/ }));

    await waitFor(() => {
      expect(saveMiners).toHaveBeenCalledWith([
        {
          ...baseMiner,
          // "restart" is the form's default action.
          schedule: [{ cron: "59 59 23 * * FRI", action: "restart" }],
        },
      ]);
    });
    await waitFor(() => expect(cronInput).toHaveValue(""));
  });

  it("removes a schedule entry via saveMiners when its delete button is clicked", async () => {
    const user = userEvent.setup();
    const saveMiners = vi.fn().mockResolvedValue([]);
    const miner: MinerConfig = {
      ...baseMiner,
      schedule: [
        { cron: "59 59 23 * * FRI", action: "switch_fallback" },
        { cron: "59 59 23 * * SUN", action: "switch_primary" },
      ],
    };
    render(<ScheduleEditor miner={miner} saveMiners={saveMiners} />);

    const deleteButtons = screen.getAllByLabelText(
      "settingsPage.configured.schedule.removing",
    );
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(saveMiners).toHaveBeenCalledWith([
        {
          ...miner,
          schedule: [{ cron: "59 59 23 * * SUN", action: "switch_primary" }],
        },
      ]);
    });
  });

  it("surfaces the server error when saveMiners rejects", async () => {
    const user = userEvent.setup();
    const saveMiners = vi.fn().mockRejectedValue(new Error("save failed"));
    render(<ScheduleEditor miner={baseMiner} saveMiners={saveMiners} />);

    await user.type(
      screen.getByLabelText("settingsPage.configured.schedule.cronLabel"),
      "59 59 23 * * FRI",
    );
    await user.click(screen.getByRole("button", { name: /schedule\.add$/ }));

    expect(await screen.findByText("save failed")).toBeInTheDocument();
  });
});
