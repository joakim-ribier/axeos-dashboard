// Every element of Configuration that ui.page.settings controls, each with
// its own test in both states: present when "enabled" (so the check can't
// pass vacuously) and gone -- or disabled -- when "readonly". Mounts the
// real <App/>, so the whole chain (GET /api/info -> useUiFeatures ->
// readOnly -> Writable) is what's under test, not a hand-passed prop.
import { MemoryRouter } from "react-router-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "@/App";
import type { UIVisibility } from "@/types/uiFeatures";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, true);

const settings = {
  electricity: { ratePerKwh: 0.2, devices: [{ name: "Fan", power: 30 }] },
  pools: { dashboards: { "mypool.example.com": "https://mypool/{user}" } },
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
};

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
            action: { minerRestart: "enabled", minerPoolSwitch: "enabled" },
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
      return Promise.resolve({ data: { configured: 1, total: 0, miners: [] } });
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
const expandMinerRow = async () => {
  await userEvent.setup().click(screen.getByText("bitaxe-1"));
};

const GATED: Gated[] = [
  // Miners -- the table
  {
    section: "miners",
    element: "the Disable all button",
    ready: minersReady,
    find: () => button("Disable all"),
  },
  {
    section: "miners",
    element: "the table's Actions column",
    ready: minersReady,
    find: () => screen.queryByRole("columnheader", { name: "Actions" }),
  },
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
    open: expandMinerRow,
    find: () => field("Alias"),
    readOnly: "disabled",
  },
  {
    section: "miners",
    element: "the alias and pool Save buttons",
    ready: minersReady,
    open: expandMinerRow,
    find: () => screen.queryAllByRole("button", { name: "Save" })[0] ?? null,
  },
  {
    section: "miners",
    element: "the pool swap button",
    ready: minersReady,
    open: expandMinerRow,
    find: () => button("Swap primary and fallback"),
  },
  // (Reset only shows once a field changed -- covered by PoolEditor's own
  // read-only test, since nothing can change here when read-only.)
  {
    section: "miners",
    element: "the pool fields",
    ready: minersReady,
    open: expandMinerRow,
    find: () => screen.queryAllByLabelText("URL")[0] ?? null,
    readOnly: "disabled",
  },
  {
    section: "miners",
    element: "the scheduler's cron field",
    ready: minersReady,
    open: expandMinerRow,
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
