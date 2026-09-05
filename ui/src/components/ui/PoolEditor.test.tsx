import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { MinerConfig } from "@/schemas/minerConfigSchema";
import type { Miner } from "@/schemas/minerSchema";

import { PoolEditor } from "./PoolEditor";

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

const getUrlInputs = () =>
  screen.getAllByLabelText("settingsPage.configured.pool.urlLabel");
const getPortInputs = () =>
  screen.getAllByLabelText("settingsPage.configured.pool.portLabel");
const getUserInputs = () =>
  screen.getAllByLabelText("settingsPage.configured.pool.userLabel");
const saveButton = () =>
  screen.getByRole("button", { name: "settingsPage.configured.pool.save" });

describe("PoolEditor", () => {
  it("pre-fills primary and fallback fields from the miner config", () => {
    render(<PoolEditor miner={baseMiner} saveMiners={vi.fn()} />);

    const [primaryUrl, fallbackUrl] = getUrlInputs();
    const [primaryPort, fallbackPort] = getPortInputs();
    const [primaryUser, fallbackUser] = getUserInputs();

    expect(primaryUrl).toHaveValue("stratum.example.com");
    expect(primaryPort).toHaveValue("3333");
    expect(primaryUser).toHaveValue("wallet.worker");
    expect(fallbackUrl).toHaveValue("solo.example.com");
    expect(fallbackPort).toHaveValue("4444");
    expect(fallbackUser).toHaveValue("wallet.worker.fallback");
  });

  it("disables Save until a field actually changes", async () => {
    const user = userEvent.setup();
    render(<PoolEditor miner={baseMiner} saveMiners={vi.fn()} />);

    expect(saveButton()).toBeDisabled();

    const [primaryUrl] = getUrlInputs();
    await user.type(primaryUrl, "x");

    expect(saveButton()).not.toBeDisabled();
  });

  it("rejects an empty primary URL and an out-of-range port", async () => {
    const user = userEvent.setup();
    render(<PoolEditor miner={baseMiner} saveMiners={vi.fn()} />);

    const [primaryUrl] = getUrlInputs();
    await user.clear(primaryUrl);

    expect(
      screen.getByText("settingsPage.configured.pool.urlRequired"),
    ).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();

    await user.type(primaryUrl, "stratum.example.com");
    const [primaryPort] = getPortInputs();
    await user.clear(primaryPort);
    await user.type(primaryPort, "99999");

    expect(
      screen.getByText("settingsPage.configured.pool.invalidPort"),
    ).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it("saves the full miner entry with the edited pool fields via saveMiners", async () => {
    const user = userEvent.setup();
    const saveMiners = vi.fn().mockResolvedValue([]);
    render(<PoolEditor miner={baseMiner} saveMiners={saveMiners} />);

    const [primaryUrl] = getUrlInputs();
    await user.clear(primaryUrl);
    await user.type(primaryUrl, "new-pool.example.com");

    await user.click(saveButton());

    expect(saveMiners).toHaveBeenCalledWith([
      { ...baseMiner, url: "new-pool.example.com" },
    ]);
  });

  it("surfaces the server error when saveMiners rejects", async () => {
    const user = userEvent.setup();
    const saveMiners = vi.fn().mockRejectedValue(new Error("save failed"));
    render(<PoolEditor miner={baseMiner} saveMiners={saveMiners} />);

    const [primaryUrl] = getUrlInputs();
    await user.clear(primaryUrl);
    await user.type(primaryUrl, "new-pool.example.com");
    await user.click(saveButton());

    expect(await screen.findByText("save failed")).toBeInTheDocument();
  });

  it("swaps primary and fallback fields when the swap button is clicked", async () => {
    const user = userEvent.setup();
    render(<PoolEditor miner={baseMiner} saveMiners={vi.fn()} />);

    await user.click(
      screen.getByRole("button", {
        name: "settingsPage.configured.pool.swap",
      }),
    );

    const [primaryUrl, fallbackUrl] = getUrlInputs();
    const [primaryPort, fallbackPort] = getPortInputs();
    const [primaryUser, fallbackUser] = getUserInputs();

    expect(primaryUrl).toHaveValue("solo.example.com");
    expect(primaryPort).toHaveValue("4444");
    expect(primaryUser).toHaveValue("wallet.worker.fallback");
    expect(fallbackUrl).toHaveValue("stratum.example.com");
    expect(fallbackPort).toHaveValue("3333");
    expect(fallbackUser).toHaveValue("wallet.worker");
    expect(saveButton()).not.toBeDisabled();
  });

  it("hides the swap button in read-only mode", () => {
    render(<PoolEditor miner={baseMiner} saveMiners={vi.fn()} readOnly />);

    expect(
      screen.queryByRole("button", {
        name: "settingsPage.configured.pool.swap",
      }),
    ).not.toBeInTheDocument();
  });

  it("hides Save/Reset in read-only mode", () => {
    render(<PoolEditor miner={baseMiner} saveMiners={vi.fn()} readOnly />);

    expect(
      screen.queryByRole("button", {
        name: "settingsPage.configured.pool.save",
      }),
    ).not.toBeInTheDocument();
  });

  const liveMiner: Miner = {
    timestamp: "2026-07-22T10:00:00Z",
    ip: "192.168.1.65",
    macAddr: "aabbccddeeff",
    sharesAccepted: 0,
    sharesRejected: 0,
    blockFound: 0,
    version: "v2.4.1",
    uptimeSeconds: 3600,
    responseTime: 42,
    hashRateTHs: 0.5,
    power: 12,
    energyJPerTh: 24,
    networkDifficulty: 1,
    bestDiff: 1,
    temp: 55,
    fanspeed: 40,
    stratumURL: "stratum.example.com",
    stratumPort: 3333,
    stratumUser: "wallet.worker",
    fallbackStratumURL: "solo.example.com",
    fallbackStratumPort: 4444,
    fallbackStratumUser: "wallet.worker.fallback",
  };

  it("shows no drift warning when live data matches the saved config", () => {
    render(
      <PoolEditor
        miner={baseMiner}
        liveMiner={liveMiner}
        saveMiners={vi.fn()}
      />,
    );

    expect(
      screen.queryByText("settingsPage.configured.pool.driftWarning"),
    ).not.toBeInTheDocument();
  });

  it("shows no drift warning when there is no live data at all", () => {
    render(<PoolEditor miner={baseMiner} saveMiners={vi.fn()} />);

    expect(
      screen.queryByText("settingsPage.configured.pool.driftWarning"),
    ).not.toBeInTheDocument();
  });

  it("warns when the saved pool config doesn't match what the miner reports", () => {
    render(
      <PoolEditor
        miner={baseMiner}
        liveMiner={{ ...liveMiner, stratumURL: "other-pool.example.com" }}
        saveMiners={vi.fn()}
      />,
    );

    expect(
      screen.getByText("settingsPage.configured.pool.driftWarning"),
    ).toBeInTheDocument();
    const item = screen.getByText(/"configured":"stratum\.example\.com"/);
    expect(item.textContent).toContain('"live":"other-pool.example.com"');
  });
});
