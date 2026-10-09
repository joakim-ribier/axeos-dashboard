import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ModeProvider } from "@/contexts/ModeContext";
import { SearchProvider } from "@/contexts/SearchContext";
import i18n from "@/i18n";
import { type Miner } from "@/schemas/minerSchema";
import { makeMiner } from "@/test/miner";

import { Home } from "./Home";

vi.mock("@/api/info", () => ({
  fetchInfo: () => Promise.resolve({ remote: false }),
}));

const mockUseMiners = vi.fn();
vi.mock("@/hooks/useMiners", async () => {
  const actual =
    await vi.importActual<typeof import("@/hooks/useMiners")>(
      "@/hooks/useMiners",
    );
  return {
    ...actual,
    useMiners: (...args: unknown[]) => mockUseMiners(...args),
    useAppInfo: () => ({ hashboardUrl: null }),
  };
});

// No network in these tests: no 24h history, no feeder interval (the
// fallback one applies).
vi.mock("@/hooks/useMinersHistory", () => ({
  useMinersHistory: () => ({ data: undefined }),
}));
vi.mock("@/hooks/useAppSettings", () => ({
  useAppSettings: () => ({ data: undefined }),
}));

const showMiners = (miners: Miner[]) =>
  mockUseMiners.mockReturnValue({
    data: miners,
    devices: [],
    isLoading: false,
    error: null,
  });

// Fresh timestamps, so nobody is "delayed".
const freshMiner = (overrides: Partial<Miner>) =>
  makeMiner({ timestamp: new Date().toISOString(), ...overrides });

function renderHome() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/"]}>
          <ModeProvider mode="local">
            <SearchProvider>
              <Home />
            </SearchProvider>
          </ModeProvider>
        </MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

const minerRows = () =>
  screen
    .getAllByRole("button", { name: /^rig-/ })
    .map((row) => within(row).getByText(/^rig-/).textContent);

describe("Home page", () => {
  beforeEach(() => {
    window.localStorage.clear();
    void i18n.changeLanguage("en");
  });

  it("says every miner is fine when they are", () => {
    showMiners([
      freshMiner({ hostname: "rig-a", ip: "10.0.0.1", macAddr: "a" }),
      freshMiner({ hostname: "rig-b", ip: "10.0.0.2", macAddr: "b" }),
    ]);
    renderHome();

    expect(screen.getByText("2/2 miners OK")).toBeInTheDocument();
  });

  it("puts a miner over a threshold first and counts it as a problem", () => {
    showMiners([
      freshMiner({
        hostname: "rig-cool",
        ip: "10.0.0.1",
        macAddr: "a",
        temp: 58,
      }),
      freshMiner({
        hostname: "rig-loud",
        ip: "10.0.0.2",
        macAddr: "b",
        temp: 50,
        fanspeed: 75,
      }),
    ]);
    renderHome();

    expect(screen.getByText("1/2 miners OK")).toBeInTheDocument();
    // Hottest first otherwise -- the problem wins over the sort.
    expect(minerRows()).toEqual(["rig-loud", "rig-cool"]);
  });

  it("lists every miner under the health badge, problems first", () => {
    showMiners([
      freshMiner({ hostname: "rig-ok", ip: "10.0.0.1", macAddr: "a" }),
      freshMiner({
        hostname: "rig-down",
        ip: "10.0.0.2",
        macAddr: "b",
        alive: false,
      }),
    ]);
    renderHome();

    fireEvent.click(screen.getByText("1/2 miners OK"));
    const list = document.querySelector<HTMLElement>(".MuiPopover-paper")!;
    expect(
      within(list)
        .getAllByRole("button")
        .map((item) => within(item).getByText(/^rig-/).textContent),
    ).toEqual(["rig-down", "rig-ok"]);

    fireEvent.click(within(list).getByText("rig-ok"));
    expect(
      screen.getByRole("heading", { level: 2, name: "rig-ok" }),
    ).toBeInTheDocument();
  });

  it("filters the list on a status chip", () => {
    showMiners([
      freshMiner({ hostname: "rig-ok", ip: "10.0.0.1", macAddr: "a" }),
      freshMiner({
        hostname: "rig-down",
        ip: "10.0.0.2",
        macAddr: "b",
        alive: false,
      }),
    ]);
    renderHome();

    fireEvent.click(screen.getByRole("button", { name: /^Offline/ }));

    expect(minerRows()).toEqual(["rig-down"]);
  });

  it("explains an empty dashboard instead of showing empty cards", () => {
    showMiners([]);
    renderHome();

    expect(screen.getByText(i18n.t("dashboard.noData"))).toBeInTheDocument();
    expect(screen.queryByText(/miners OK/)).not.toBeInTheDocument();
  });
});
