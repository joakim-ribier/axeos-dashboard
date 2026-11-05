// Every element of Configuration that ui.page.settings controls, each with
// its own test in both states: present when "enabled" (so the check can't
// pass vacuously) and gone -- or disabled -- when "readonly". Mounts the
// real <App/>, so the whole chain (GET /api/info -> useUiFeatures ->
// readOnly -> Writable) is what's under test, not a hand-passed prop.
import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "@/App";
import { makeMiner } from "@/test/miner";
import type { UIVisibility } from "@/types/uiFeatures";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, true);

const settings = {
  electricity: { ratePerKwh: 0.2, devices: [{ name: "Fan", power: 30 }] },
  pools: { dashboards: { "mypool.example.com": "https://mypool/{user}" } },
  remote: {
    pushURL: "",
    apiKey: "",
    sendUser: false,
    sendPools: false,
    sendIP: false,
    actions: { restart: false, switchPool: false, mail: false },
  },
  firmware: { repos: {} },
  defaults: { pools: { dashboards: {} }, firmware: { repos: {} } },
  readOnly: {
    feederInterval: "2m0s",
    healthCheckInterval: "1m0s",
    firmwareCacheTTL: "24h0m0s",
  },
};

const miner = {
  ip: "192.168.1.10",
  hostname: "bitaxe-1",
  mac: "aa:bb:cc:dd:ee:01",
  model: "bitaxe",
  enabled: true,
  url: "pool.example.com",
  port: 3333,
  user: "wallet.worker",
  fallbackUrl: "solo.example.com",
  fallbackPort: 3333,
  fallbackUser: "wallet.worker",
  alerts: { tempHigh: 0, fanHigh: 95 },
};

// What /api/miners reports -- none unless a test says otherwise.
let liveMiners: unknown[] = [];

const mockBackend = (settingsFlag: UIVisibility) => {
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
          },
        },
      });
    }
    if (url === "/api/config/settings") {
      return Promise.resolve({ data: settings });
    }
    if (url === "/api/config/miners") {
      return Promise.resolve({ data: { bitaxes: [miner] } });
    }
    if (url === "/api/miners") {
      return Promise.resolve({
        data: { configured: 1, total: liveMiners.length, miners: liveMiners },
      });
    }
    if (url === "/api/miners/history") {
      return Promise.resolve({ data: { buckets: [], miners: [] } });
    }
    return Promise.reject(new Error(`not mocked: ${url}`));
  });
};

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );

const button = (name: string | RegExp) =>
  screen.queryByRole("button", { name });
const field = (label: string) => screen.queryByLabelText(label);
// The Save button on the same line as a field -- there are several Saves.
const saveNextTo = (label: string) => {
  const line = field(label)?.closest<HTMLElement>(".MuiStack-root");
  return line ? within(line).queryByRole("button", { name: "Save" }) : null;
};

type Section = "miners" | "electricity" | "system";

interface Gated {
  section: Section;
  element: string;
  /** Waits until the section's data is on screen. */
  ready: () => Promise<unknown>;
  /** Brings the element on screen, if it needs an interaction first. */
  open?: () => Promise<void>;
  find: () => HTMLElement | null;
  /** "disabled" = kept on screen but not editable when read-only. */
  readOnly?: "absent" | "disabled";
}

const minersReady = () => screen.findByText("bitaxe-1");
const electricityReady = () => screen.findByText("Fan");
const systemReady = () => screen.findByText("mypool.example.com");
// A miner's configuration panel, open on one of its sections.
const openMinerSection = (name: RegExp) => async () => {
  const user = userEvent.setup();
  await user.click(screen.getByText("bitaxe-1"));
  await user.click(await screen.findByRole("button", { name }));
};
const aliasSection = openMinerSection(/^Display name/);
const poolSection = openMinerSection(/^Pool/);
const alertsSection = openMinerSection(/^Alert thresholds/);
const scheduleSection = openMinerSection(/^Scheduler/);

const GATED: Gated[] = [
  // Miners -- the table
  {
    section: "miners",
    element: "a row's Disable button",
    ready: minersReady,
    find: () => button("Disable"),
  },
  // Miners -- a row's editors
  {
    section: "miners",
    element: "the alias field",
    ready: minersReady,
    open: aliasSection,
    find: () => field("Alias"),
    readOnly: "disabled",
  },
  {
    section: "miners",
    element: "the alias Save button",
    ready: minersReady,
    open: aliasSection,
    find: () => button("Save"),
  },
  {
    section: "miners",
    element: "the pool Save button",
    ready: minersReady,
    open: poolSection,
    find: () => button("Save"),
  },
  {
    section: "miners",
    element: "the pool swap button",
    ready: minersReady,
    open: poolSection,
    find: () => button("Swap primary and fallback"),
  },
  // (Reset only shows once a field changed -- covered by PoolEditor's own
  // read-only test, since nothing can change here when read-only.)
  {
    section: "miners",
    element: "the pool fields",
    ready: minersReady,
    open: poolSection,
    find: () => screen.queryAllByLabelText("URL")[0] ?? null,
    readOnly: "disabled",
  },
  {
    section: "miners",
    element: "the alert threshold fields",
    ready: minersReady,
    open: alertsSection,
    find: () => field("Temperature (°C)"),
    readOnly: "disabled",
  },
  {
    section: "miners",
    element: "the alert thresholds Save button",
    ready: minersReady,
    open: alertsSection,
    find: () => saveNextTo("Temperature (°C)"),
  },
  {
    section: "miners",
    element: "the scheduler's cron field",
    ready: minersReady,
    open: scheduleSection,
    find: () => field("Cron expression"),
  },
  // Miners -- adding miners
  {
    section: "miners",
    element: "the scan button",
    ready: minersReady,
    find: () => button("Start detection"),
  },
  {
    section: "miners",
    element: "the isolated network checkbox",
    ready: minersReady,
    find: () => field("Isolated environment"),
  },
  {
    section: "miners",
    element: "the IP field",
    ready: minersReady,
    find: () => field("IP address"),
  },
  {
    section: "miners",
    element: "the Search button",
    ready: minersReady,
    find: () => button("Search"),
  },
  // Electricity
  {
    section: "electricity",
    element: "the rate field",
    ready: electricityReady,
    find: () => field("Rate (€/kWh)"),
  },
  {
    section: "electricity",
    element: "the rate Save button",
    ready: electricityReady,
    find: () => button("Save"),
  },
  {
    section: "electricity",
    element: "a device's Remove button",
    ready: electricityReady,
    find: () => button("Remove"),
  },
  {
    section: "electricity",
    element: "the device name field",
    ready: electricityReady,
    find: () => field("Name"),
  },
  {
    section: "electricity",
    element: "the device power field",
    ready: electricityReady,
    find: () => field("Power (W)"),
  },
  {
    section: "electricity",
    element: "the add device button",
    ready: electricityReady,
    find: () => button("Add"),
  },
  // System
  {
    section: "system",
    element: "the alert threshold fields",
    ready: systemReady,
    find: () => field("Temperature (°C)"),
    readOnly: "disabled",
  },
  {
    section: "system",
    element: "the alert return margin fields",
    ready: systemReady,
    find: () => field("Return margin (°C)"),
    readOnly: "disabled",
  },
  {
    section: "system",
    element: "the alert thresholds Save button",
    ready: systemReady,
    find: () => saveNextTo("Temperature (°C)"),
  },
  {
    section: "system",
    element: "a pool dashboard's Remove button",
    ready: systemReady,
    find: () => button("Remove"),
  },
  {
    section: "system",
    element: "the pool hostname field",
    ready: systemReady,
    find: () => field("Pool hostname"),
  },
  {
    section: "system",
    element: "the dashboard URL field",
    ready: systemReady,
    find: () => field("Dashboard URL"),
  },
  {
    section: "system",
    element: "the add pool dashboard button",
    ready: systemReady,
    find: () => button("Add"),
  },
];

const READ_ONLY_BANNER =
  "Read-only view — settings are managed from the source dashboard.";

describe("Configuration elements controlled by ui.page.settings", () => {
  describe.each(GATED)("$section: $element", (g) => {
    const show = async (flag: UIVisibility) => {
      mockBackend(flag);
      renderAt(`/settings/${g.section}`);
      await g.ready();
      if (g.open) await g.open();
    };

    it("is there when settings are enabled", async () => {
      await show("enabled");

      const el = g.find();
      expect(el).toBeInTheDocument();
      if (g.readOnly === "disabled") expect(el).toBeEnabled();
    });

    it(
      g.readOnly === "disabled"
        ? "is disabled when settings are read-only"
        : "is gone when settings are read-only",
      async () => {
        await show("readonly");

        if (g.readOnly === "disabled") {
          expect(g.find()).toBeDisabled();
        } else {
          expect(g.find()).not.toBeInTheDocument();
        }
      },
    );
  });

  describe("the read-only banner", () => {
    it("is gone when settings are enabled", async () => {
      mockBackend("enabled");
      renderAt("/settings/miners");
      await minersReady();

      expect(screen.queryByText(READ_ONLY_BANNER)).not.toBeInTheDocument();
    });

    it("is there when settings are read-only", async () => {
      mockBackend("readonly");
      renderAt("/settings/miners");
      await minersReady();

      expect(screen.getByText(READ_ONLY_BANNER)).toBeInTheDocument();
    });
  });

  // Sections with nothing to show read-only (a board never receives the
  // push credentials nor the mail settings): gone from the menu and from
  // the URL, not just emptied.
  describe.each([
    {
      section: "notifications",
      menu: /^Notifications/,
      content: "SMTP server",
    },
    { section: "remote", menu: /^Remote/, content: "Connection" },
  ])("the $section section", ({ section, menu, content }) => {
    const menuLink = () => {
      const nav = screen
        .getAllByRole("navigation")
        .find((n) => within(n).queryByRole("link", { name: /^Miners/ }));
      return nav ? within(nav).queryByRole("link", { name: menu }) : null;
    };

    it("is listed and opens when settings are enabled", async () => {
      mockBackend("enabled");
      renderAt(`/settings/${section}`);

      expect(await screen.findByText(content)).toBeInTheDocument();
      expect(menuLink()).toBeInTheDocument();
    });

    it("is neither listed nor reachable when settings are read-only", async () => {
      mockBackend("readonly");
      renderAt(`/settings/${section}`);

      await minersReady();
      expect(screen.queryByText(content)).not.toBeInTheDocument();
      expect(menuLink()).not.toBeInTheDocument();
    });
  });
});

beforeEach(() => {
  mockedAxios.get.mockReset();
});

describe("saving alert thresholds", () => {
  beforeEach(() => {
    mockedAxios.post.mockReset();
    mockedAxios.post.mockImplementation((url: string) =>
      Promise.resolve({
        data:
          url === "/api/config/miners"
            ? { bitaxes: [{ ...miner, alerts: { tempHigh: 65, fanHigh: 95 } }] }
            : settings,
      }),
    );
  });

  it("says so from a miner's row", async () => {
    const user = userEvent.setup();
    mockBackend("enabled");
    renderAt("/settings/miners");
    await minersReady();
    await alertsSection();

    await user.type(screen.getByLabelText("Temperature (°C)"), "65");
    await user.click(saveNextTo("Temperature (°C)")!);

    expect(await screen.findByText("Miner saved.")).toBeInTheDocument();
  });

  it("says so from Configuration › System", async () => {
    const user = userEvent.setup();
    mockBackend("enabled");
    renderAt("/settings/system");
    await systemReady();

    await user.type(screen.getByLabelText("Return margin (%)"), "10");
    await user.click(saveNextTo("Temperature (°C)")!);

    expect(await screen.findByText("App settings saved.")).toBeInTheDocument();
  });
});

describe("the configured miners table", () => {
  it("shows each miner's alert thresholds, its own told apart, and no MAC", async () => {
    mockBackend("enabled");
    renderAt("/settings/miners");
    await minersReady();

    expect(
      screen.getByRole("columnheader", { name: "Alert thresholds" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "MAC" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("This miner's own")).toHaveTextContent("95 %");
    expect(
      screen.getByLabelText("Every miner's (Configuration › System)"),
    ).toHaveTextContent("62 °C");
  });
});

describe("a configured miner's View button", () => {
  beforeEach(() => {
    liveMiners = [];
  });

  it.each(["enabled", "readonly"] as const)(
    "opens the dashboard's miner panel (settings %s)",
    async (flag) => {
      liveMiners = [
        makeMiner({
          ip: "192.168.1.10",
          macAddr: "AA:BB:CC:DD:EE:01",
          hostname: "bitaxe-1",
        }),
      ];
      mockBackend(flag);
      renderAt("/settings/miners");
      await minersReady();

      await userEvent.setup().click(button("View") as HTMLElement);

      expect(
        await screen.findByRole("button", { name: "Close" }),
      ).toBeInTheDocument();
    },
  );

  it("is disabled while the miner has no reading yet", async () => {
    mockBackend("enabled");
    renderAt("/settings/miners");
    await minersReady();

    expect(button("View")).toBeDisabled();
  });
});

// The section a miner's panel shows -- the menu entries sit in its nav.
const menuEntry = (name: RegExp) => screen.findByRole("button", { name });

describe("a configured miner's panel", () => {
  beforeEach(() => {
    liveMiners = [];
  });

  it("opens from its row and from Configure, one section at a time", async () => {
    const user = userEvent.setup();
    mockBackend("enabled");
    renderAt("/settings/miners");
    await minersReady();

    await user.click(screen.getByText("bitaxe-1"));
    expect(await screen.findByLabelText("Alias")).toBeInTheDocument();
    expect(field("URL")).not.toBeInTheDocument();

    await user.click(await menuEntry(/^Pool/));
    expect(screen.queryAllByLabelText("URL")).toHaveLength(2);
    expect(field("Alias")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));
    // Once it has slid out, as a user would reopen it.
    await waitFor(() =>
      expect(screen.queryAllByLabelText("URL")).toHaveLength(0),
    );
    await user.click(button("Configure") as HTMLElement);
    expect(await screen.findByLabelText("Alias")).toBeInTheDocument();
  });

  it("flags a pool that differs from the miner's on its Pool entry", async () => {
    const user = userEvent.setup();
    liveMiners = [
      makeMiner({
        ip: "192.168.1.10",
        macAddr: "AA:BB:CC:DD:EE:01",
        hostname: "bitaxe-1",
        stratumURL: "stratum+tcp://elsewhere.example.com",
      }),
    ];
    mockBackend("enabled");
    renderAt("/settings/miners");
    await minersReady();

    await user.click(screen.getByText("bitaxe-1"));

    const pool = await menuEntry(/^Pool/);
    expect(within(pool).getByRole("img")).toBeInTheDocument();
    expect(
      within(await menuEntry(/^Display name/)).queryByRole("img"),
    ).not.toBeInTheDocument();
  });
});

describe("disabling a configured miner", () => {
  beforeEach(() => {
    mockedAxios.post.mockReset();
    mockedAxios.post.mockResolvedValue({
      data: { bitaxes: [{ ...miner, enabled: false }] },
    });
  });

  it("asks first, then saves it disabled", async () => {
    const user = userEvent.setup();
    mockBackend("enabled");
    renderAt("/settings/miners");
    await minersReady();

    await user.click(button("Disable") as HTMLElement);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Disable bitaxe-1?")).toBeInTheDocument();
    expect(mockedAxios.post).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Disable" }));

    expect(mockedAxios.post).toHaveBeenCalledWith("/api/config/miners", {
      bitaxes: [{ ...miner, enabled: false }],
    });
  });

  it("saves nothing when cancelled", async () => {
    const user = userEvent.setup();
    mockBackend("enabled");
    renderAt("/settings/miners");
    await minersReady();

    await user.click(button("Disable") as HTMLElement);
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Cancel",
      }),
    );

    expect(mockedAxios.post).not.toHaveBeenCalled();
  });
});

describe("the configured miners on a phone", () => {
  beforeEach(() => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query) =>
        ({
          matches: query.includes("max-width"),
          media: query,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    );
  });

  it("are rows rather than a table, one opening its panel", async () => {
    const user = userEvent.setup();
    mockBackend("enabled");
    renderAt("/settings/miners");
    await minersReady();

    expect(
      screen.queryByRole("columnheader", { name: "IP" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("192.168.1.10")).toBeInTheDocument();

    await user.click(screen.getByText("bitaxe-1"));
    expect(await screen.findByLabelText("Alias")).toBeInTheDocument();

    vi.restoreAllMocks();
  });
});

describe("the pool dashboards", () => {
  it("show the ones added by hand, the built-in ones folded", async () => {
    const user = userEvent.setup();
    const builtIn = settings.defaults.pools.dashboards;
    settings.defaults.pools.dashboards = {
      "solo.example.io": "https://solo.example.io/{user}",
    };
    try {
      mockBackend("enabled");
      renderAt("/settings/system");
      await systemReady();

      expect(screen.queryByText("solo.example.io")).not.toBeInTheDocument();

      await user.click(button("Show the built-in pool") as HTMLElement);

      expect(await screen.findByText("solo.example.io")).toBeInTheDocument();
      expect(screen.getByText("mypool.example.com")).toBeInTheDocument();
    } finally {
      settings.defaults.pools.dashboards = builtIn;
    }
  });
});
