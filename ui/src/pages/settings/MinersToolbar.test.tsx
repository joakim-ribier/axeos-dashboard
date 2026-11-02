// The Actions panel of Configuration › Miners: a switch of every miner to a
// pool, the pools check, Disable all -- through the real <App/>, so each
// action's gate (ui.page.settings, ui.action.minerPoolSwitch) is what's
// under test, not a hand-passed prop.
import { MemoryRouter } from "react-router-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "@/App";
import { makeMiner } from "@/test/miner";
import type { UIVisibility } from "@/types/uiFeatures";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, true);

const configured = {
  ip: "192.168.1.10",
  hostname: "bitaxe-1",
  alias: "Prof",
  mac: "aa:bb:cc:dd:ee:01",
  model: "bitaxe",
  enabled: true,
  url: "pool.example.com",
  port: 3333,
  user: "wallet.worker",
  fallbackUrl: "solo.example.com",
  fallbackPort: 3333,
  fallbackUser: "wallet.solo",
};

// Mining on its primary pool, holding solo.example.com as its fallback.
const live = makeMiner({
  ip: configured.ip,
  macAddr: "AA:BB:CC:DD:EE:01",
  stratumURL: "pool.example.com",
  stratumPort: 3333,
  fallbackStratumURL: "solo.example.com",
  fallbackStratumPort: 3333,
  isUsingFallbackStratum: 0,
});

const device = {
  stratumURL: "pool.example.com",
  stratumPort: 3333,
  stratumUser: "wallet.worker",
  fallbackStratumURL: "solo.example.com",
  fallbackStratumPort: 3333,
  fallbackStratumUser: "wallet.solo-NEW",
};

const mockBackend = (
  settingsFlag: UIVisibility = "enabled",
  poolSwitchFlag: UIVisibility = "enabled",
) => {
  mockedAxios.get.mockImplementation((url: string) => {
    if (url === "/api/info") {
      return Promise.resolve({
        data: {
          remote: false,
          ui: {
            page: {
              settings: settingsFlag,
              backups: "enabled",
              audit: "enabled",
            },
            action: {
              minerRestart: "enabled",
              minerPoolSwitch: poolSwitchFlag,
            },
          },
        },
      });
    }
    if (url === "/api/config/settings") {
      return Promise.resolve({
        data: {
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
          defaults: { pools: { dashboards: {} }, firmware: { repos: {} } },
          readOnly: {
            feederInterval: "2m0s",
            healthCheckInterval: "1m0s",
            firmwareCacheTTL: "24h0m0s",
          },
        },
      });
    }
    if (url === "/api/config/miners") {
      return Promise.resolve({ data: { bitaxes: [configured] } });
    }
    if (url === "/api/miners") {
      return Promise.resolve({
        data: { configured: 1, total: 1, miners: [live] },
      });
    }
    if (url === "/api/miners/history") {
      return Promise.resolve({ data: { buckets: [], miners: [] } });
    }
    if (url === "/api/config/miners/sync") {
      return Promise.resolve({
        data: {
          bitaxes: [{ ...configured, fallbackUser: "wallet.solo-NEW" }],
          miners: [
            {
              ip: configured.ip,
              mac: configured.mac,
              device,
              changes: [
                {
                  field: "fallbackUser",
                  kind: "changed",
                  before: "wallet.solo",
                  after: "wallet.solo-NEW",
                },
              ],
            },
          ],
        },
      });
    }
    return Promise.reject(new Error(`not mocked: ${url}`));
  });
};

const openMiners = async () => {
  render(
    <MemoryRouter initialEntries={["/settings/miners"]}>
      <App />
    </MemoryRouter>,
  );
  // Its row shows it by its alias.
  await screen.findByText("Prof");
};

const actionsButton = () => screen.queryByRole("button", { name: "Actions" });
const openActions = async () => {
  await userEvent.setup().click(actionsButton()!);
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("the Actions panel", () => {
  it("is folded until Actions is clicked, and folds back", async () => {
    mockBackend();
    await openMiners();
    expect(
      screen.queryByRole("button", { name: "Disable all" }),
    ).not.toBeInTheDocument();

    await openActions();
    expect(
      screen.getByRole("button", { name: "Disable all" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Switch to a pool")).toBeInTheDocument();
    expect(screen.getByText("Check the pools")).toBeInTheDocument();

    await openActions();
    await vi.waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Disable all" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("is there while one of its actions is left", async () => {
    mockBackend("readonly", "enabled");
    await openMiners();
    expect(actionsButton()).toBeInTheDocument();
  });

  it("is gone when none of its actions is left", async () => {
    mockBackend("readonly", "hidden");
    await openMiners();
    expect(actionsButton()).not.toBeInTheDocument();
  });
});

describe("the switch to a pool, controlled by ui.action.minerPoolSwitch", () => {
  it("is there when enabled", async () => {
    mockBackend("enabled", "enabled");
    await openMiners();
    await openActions();
    expect(screen.getByRole("combobox", { name: "Pool" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("is disabled when read-only", async () => {
    mockBackend("enabled", "readonly");
    await openMiners();
    await openActions();
    expect(screen.getByRole("combobox", { name: "Pool" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("button", { name: "Switch" })).toBeDisabled();
  });

  it("is gone when hidden", async () => {
    mockBackend("enabled", "hidden");
    await openMiners();
    await openActions();
    expect(screen.queryByText("Switch to a pool")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Pool" }),
    ).not.toBeInTheDocument();
  });
});

describe("the switch to a pool", () => {
  const pick = async (pool: RegExp) => {
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "Pool" }));
    await user.click(screen.getByRole("option", { name: pool }));
  };

  it("lists the pools the miners hold, with how many mine on each", async () => {
    mockBackend();
    await openMiners();
    await openActions();
    await userEvent
      .setup()
      .click(screen.getByRole("combobox", { name: "Pool" }));

    expect(
      screen.getByRole("option", {
        name: "pool.example.com:3333 — active on 1 / 1",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", {
        name: "solo.example.com:3333 — active on 0 / 1",
      }),
    ).toBeInTheDocument();
  });

  it("can't switch to a pool every miner holding it is already on", async () => {
    mockBackend();
    await openMiners();
    await openActions();
    await pick(/^pool\.example\.com/);

    expect(screen.getByRole("button", { name: "Switch" })).toBeDisabled();
  });

  it("switches after a confirmation, then sums it up in the confirmation toast", async () => {
    mockBackend();
    mockedAxios.put.mockResolvedValue({
      data: { miners: [{ ip: configured.ip, status: "switched" }] },
    });
    await openMiners();
    await openActions();
    await pick(/^solo\.example\.com/);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Switch" }));
    expect(mockedAxios.put).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: "Switch every miner" }),
    );

    expect(mockedAxios.put).toHaveBeenCalledWith(
      "/api/miners/pool/switch",
      null,
      {
        params: { url: "solo.example.com", port: 3333 },
      },
    );
    expect(
      await screen.findByText(
        "1 switched · 0 already on it · 0 without this pool · 0 failed",
      ),
    ).toBeInTheDocument();
    // No failure: no box under the panel.
    expect(screen.queryByText(/^Prof :/)).not.toBeInTheDocument();
  });

  it("lists each miner it couldn't switch, with why", async () => {
    mockBackend();
    mockedAxios.put.mockResolvedValue({
      data: {
        miners: [
          { ip: configured.ip, status: "failed", error: "connection refused" },
        ],
      },
    });
    await openMiners();
    await openActions();
    await pick(/^solo\.example\.com/);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Switch" }));
    await user.click(
      screen.getByRole("button", { name: "Switch every miner" }),
    );

    // The toast sums it up; the miner and why it failed get their own box.
    expect(
      await screen.findByText("Prof : connection refused"),
    ).toBeInTheDocument();
  });
});

describe("the pools check, controlled by ui.page.settings", () => {
  it("is there when settings are enabled", async () => {
    mockBackend("enabled");
    await openMiners();
    await openActions();
    expect(screen.getByRole("button", { name: "Check" })).toBeInTheDocument();
  });

  it("is gone when settings are read-only", async () => {
    mockBackend("readonly");
    await openMiners();
    await openActions();
    expect(
      screen.queryByRole("button", { name: "Check" }),
    ).not.toBeInTheDocument();
  });
});

describe("the pools check", () => {
  const check = async () => {
    await openMiners();
    await openActions();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Check" }));
    return screen.findByRole("dialog");
  };

  it("reports every miner, slot by slot, with what differs", async () => {
    mockBackend();
    const dialog = await check();

    expect(within(dialog).getByText("Pool check")).toBeInTheDocument();
    expect(within(dialog).getByText("bitaxe-1 · Prof")).toBeInTheDocument();
    expect(
      within(dialog).getByText("192.168.1.10 · aa:bb:cc:dd:ee:01"),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("To fix")).toBeInTheDocument();
    expect(dialog).toHaveTextContent(
      "Fallback user : wallet.solo → wallet.solo-NEW",
    );
    expect(dialog).toHaveTextContent(
      "1 miner has pools that differ from the ones saved in the dashboard.",
    );
  });

  it("syncs the entries the check returned, then confirms it in the toast", async () => {
    mockBackend();
    mockedAxios.post.mockResolvedValue({
      data: { bitaxes: [{ ...configured, fallbackUser: "wallet.solo-NEW" }] },
    });
    const dialog = await check();

    await userEvent
      .setup()
      .click(within(dialog).getByRole("button", { name: "Sync" }));

    expect(mockedAxios.post).toHaveBeenCalledWith("/api/config/miners", {
      bitaxes: [{ ...configured, fallbackUser: "wallet.solo-NEW" }],
    });
    expect(await screen.findByText("1 miner(s) synced.")).toBeInTheDocument();
  });

  it("has nothing to sync when every miner is up to date", async () => {
    mockBackend();
    const getBackend = mockedAxios.get.getMockImplementation()!;
    mockedAxios.get.mockImplementation((url: string) =>
      url === "/api/config/miners/sync"
        ? Promise.resolve({
            data: {
              bitaxes: [],
              miners: [{ ip: configured.ip, mac: configured.mac, device }],
            },
          })
        : getBackend(url),
    );
    const dialog = await check();

    expect(within(dialog).getByText("Up to date")).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: "Sync" }),
    ).not.toBeInTheDocument();
  });

  it("reports a miner it couldn't read, with why", async () => {
    mockBackend();
    const getBackend = mockedAxios.get.getMockImplementation()!;
    mockedAxios.get.mockImplementation((url: string) =>
      url === "/api/config/miners/sync"
        ? Promise.resolve({
            data: {
              bitaxes: [],
              miners: [
                {
                  ip: configured.ip,
                  mac: configured.mac,
                  error: "connection refused",
                },
              ],
            },
          })
        : getBackend(url),
    );
    const dialog = await check();

    expect(within(dialog).getByText("Not read")).toBeInTheDocument();
    expect(within(dialog).getByText("connection refused")).toBeInTheDocument();
  });
});

describe("a configured miner's IP", () => {
  it("opens the miner's own interface, without unfolding its row", async () => {
    mockBackend();
    await openMiners();

    const link = screen.getByRole("link", { name: "192.168.1.10" });
    expect(link).toHaveAttribute("href", "http://192.168.1.10");
    expect(link).toHaveAttribute("target", "_blank");

    await userEvent.setup().click(link);
    expect(screen.queryByLabelText("Alias")).not.toBeInTheDocument();
  });
});
