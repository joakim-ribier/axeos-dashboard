import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ModeProvider } from "@/contexts/ModeContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { RefreshSettingsProvider } from "@/contexts/RefreshSettingsContext";

import { Sidebar } from "./Sidebar";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockUseAppInfo = vi.fn();
const mockUseUiFeatures = vi.fn();
vi.mock("@/hooks/useMiners", () => ({
  useAppInfo: () => mockUseAppInfo(),
  useUiFeatures: () => mockUseUiFeatures(),
}));

// ModeProvider itself now fetches GET /api/info (for isRemoteBackend) --
// mocked at the source rather than via axios, so this stays a one-line
// constant instead of duplicating the URL-routing every other axios mock
// in this suite would need. Remote-dashboard-api by default (a board that
// IS reachable) -- the "typo'd against dashboard-api" case lives in
// App.smoke.test.tsx, which mounts the real ModeProvider tree.
const mockFetchInfo = vi.fn();
vi.mock("@/api/info", () => ({
  fetchInfo: () => mockFetchInfo(),
}));

const mockUseRemoteBoard = vi.fn();
vi.mock("@/hooks/useRemoteBoard", () => ({
  useRemoteBoard: () => mockUseRemoteBoard(),
}));

function sidebarProviders(mobileOpen: boolean, onClose: () => void) {
  return (
    <RefreshSettingsProvider>
      <NotificationsProvider>
        <Sidebar mobileOpen={mobileOpen} onClose={onClose} />
      </NotificationsProvider>
    </RefreshSettingsProvider>
  );
}

// ModeProvider derives boardId via useParams(), which only populates from
// an actual matching <Route path=":boardId/*">, not just being inside a
// MemoryRouter -- mirrors how App.tsx's AppLayout route nests it for real
// (see AppLayout.tsx). "/*" (rather than exact leaf paths) is enough here
// since Sidebar itself only reads boardId + the raw pathname, never an
// actual matched child route.
function sidebarRouterTree(
  initialEntry: string,
  mode: "local" | "remote",
  mobileOpen = false,
  onClose: () => void = () => {},
) {
  const routePath = mode === "remote" ? "/:boardId/*" : "/*";
  const queryClient = new QueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route
            path={routePath}
            element={
              <ModeProvider mode={mode}>
                {sidebarProviders(mobileOpen, onClose)}
              </ModeProvider>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function renderSidebar(
  initialEntry: string,
  mode: "local" | "remote" = "local",
) {
  return render(sidebarRouterTree(initialEntry, mode));
}

describe("Sidebar", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockFetchInfo.mockResolvedValue({ remote: true });
    mockUseRemoteBoard.mockReturnValue({ data: undefined });
    mockUseAppInfo.mockReturnValue({
      buildSHA: undefined,
      versionStatus: "unknown",
      releaseUrl: null,
      hashboardUrl: null,
      isPublic: false,
    });
    mockUseUiFeatures.mockReturnValue({
      ui: {
        page: { settings: "enabled", backups: "enabled" },
        action: { minerRestart: "enabled", minerPoolSwitch: "enabled" },
      },
      isLoading: false,
    });
  });

  describe("board public/private indicator", () => {
    it("shows the private icon by default", async () => {
      renderSidebar("/demo", "remote");

      // The chip now also waits on ModeProvider's own /api/info fetch
      // (isRemoteBackend) -- find* auto-retries until that resolves.
      expect(
        (await screen.findAllByLabelText("board is private")).length,
      ).toBeGreaterThan(0);
      expect(
        screen.queryByLabelText("board is public"),
      ).not.toBeInTheDocument();
    });

    it("shows the public icon when the board is public", async () => {
      mockUseAppInfo.mockReturnValue({
        buildSHA: undefined,
        versionStatus: "unknown",
        releaseUrl: null,
        hashboardUrl: null,
        isPublic: true,
      });
      renderSidebar("/demo", "remote");

      expect(
        (await screen.findAllByLabelText("board is public")).length,
      ).toBeGreaterThan(0);
      expect(
        screen.queryByLabelText("board is private"),
      ).not.toBeInTheDocument();
    });
  });

  it("renders the brand mark and the Home nav item", () => {
    renderSidebar("/");

    expect(screen.getAllByText("AxeOS").length).toBeGreaterThan(0);
    expect(screen.getAllByText("nav.home").length).toBeGreaterThan(0);
  });

  describe("nav links", () => {
    it("renders the Alerts nav item", () => {
      renderSidebar("/");

      expect(screen.getAllByText("nav.alerts").length).toBeGreaterThan(0);
    });

    it("links Home/Alerts to the local routes when on the local board", () => {
      renderSidebar("/");

      const homeLinks = screen
        .getAllByText("nav.home")
        .map((el) => el.closest("a"));
      const alertsLinks = screen
        .getAllByText("nav.alerts")
        .map((el) => el.closest("a"));

      expect(homeLinks[0]).toHaveAttribute("href", "/");
      expect(alertsLinks[0]).toHaveAttribute("href", "/alerts");
    });

    it("links Home/Alerts to the board-scoped routes when on a remote board", async () => {
      renderSidebar("/demo", "remote");

      // boardId only feeds nav links once ModeProvider's own /api/info fetch
      // confirms isRemoteBackend -- until then they stay board-free (see
      // Sidebar.tsx's own doc comment), so wait for the real, board-scoped
      // hrefs.
      await waitFor(() => {
        const homeLinks = screen
          .getAllByText("nav.home")
          .map((el) => el.closest("a"));
        expect(homeLinks[0]).toHaveAttribute("href", "/demo");
      });
      const alertsLinks = screen
        .getAllByText("nav.alerts")
        .map((el) => el.closest("a"));
      expect(alertsLinks[0]).toHaveAttribute("href", "/demo/alerts");
    });

    it("marks Home as selected on the board root, and Alerts as selected on the alerts route", async () => {
      const { container: homeContainer } = renderSidebar("/demo", "remote");
      await waitFor(() => {
        const homeSelected = homeContainer.querySelectorAll(".Mui-selected");
        expect(homeSelected.length).toBeGreaterThan(0);
        expect(homeSelected[0]).toHaveTextContent("nav.home");
      });

      const { container: alertsContainer } = renderSidebar(
        "/demo/alerts",
        "remote",
      );
      await waitFor(() => {
        const alertsSelected =
          alertsContainer.querySelectorAll(".Mui-selected");
        expect(alertsSelected.length).toBeGreaterThan(0);
        expect(alertsSelected[0]).toHaveTextContent("nav.alerts");
      });
    });

    it("renders the Settings nav item, enabled, on the local board", () => {
      renderSidebar("/");

      const settingsLinks = screen
        .getAllByText("nav.settings")
        .map((el) => el.closest("a"));

      expect(settingsLinks[0]).toHaveAttribute("href", "/settings");
      expect(settingsLinks[0]).not.toHaveAttribute("aria-disabled");
    });

    it("links the Settings nav item to the board's own settings route, enabled, on a remote board", async () => {
      renderSidebar("/demo", "remote");

      // The page itself renders read-only (ui.page.settings: readonly) --
      // the nav link is no longer force-disabled here, see
      // RequirePageEnabled/Settings.tsx's own readOnly gating.
      await waitFor(() => {
        const settingsLinks = screen
          .getAllByText("nav.settings")
          .map((el) => el.closest("a"));
        expect(settingsLinks[0]).toHaveAttribute("href", "/demo/settings");
      });
      const settingsLinks = screen
        .getAllByText("nav.settings")
        .map((el) => el.closest("a"));
      expect(settingsLinks[0]).not.toHaveAttribute("aria-disabled");
    });

    it("hides the Settings nav item entirely when ui.page.settings is hidden", () => {
      mockUseUiFeatures.mockReturnValue({
        ui: {
          page: { settings: "hidden", backups: "enabled" },
          action: { minerRestart: "enabled", minerPoolSwitch: "enabled" },
        },
        isLoading: false,
      });
      renderSidebar("/");

      expect(screen.queryByText("nav.settings")).not.toBeInTheDocument();
    });

    it("links the Backups nav item to /backups", () => {
      renderSidebar("/");

      const backupsLinks = screen
        .getAllByText("nav.backups")
        .map((el) => el.closest("a"));
      expect(backupsLinks[0]).toHaveAttribute("href", "/backups");
    });

    it("hides the Backups nav item entirely when ui.page.backups is hidden", () => {
      mockUseUiFeatures.mockReturnValue({
        ui: {
          page: { settings: "enabled", backups: "hidden" },
          action: { minerRestart: "enabled", minerPoolSwitch: "enabled" },
        },
        isLoading: false,
      });
      renderSidebar("/");

      expect(screen.queryByText("nav.backups")).not.toBeInTheDocument();
    });
  });

  it("shows the current board id (without the word 'board') on a remote route", async () => {
    renderSidebar("/demo", "remote");

    expect((await screen.findAllByText("demo")).length).toBeGreaterThan(0);
    expect(screen.queryByText(/board demo/)).not.toBeInTheDocument();
  });

  it("shows the full board id, not truncated to a handful of characters", async () => {
    const longBoardId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    renderSidebar(`/${longBoardId}`, "remote");

    expect((await screen.findAllByText(longBoardId)).length).toBeGreaterThan(0);
  });

  it("does not show a board id chip on the local route", () => {
    renderSidebar("/");

    expect(screen.queryByText("demo")).not.toBeInTheDocument();
  });

  it("links the board id chip to the board's home page in remote mode", async () => {
    renderSidebar("/demo/alerts", "remote");

    expect(await screen.findByRole("link", { name: "demo" })).toHaveAttribute(
      "href",
      "/demo",
    );
  });

  describe("local board line (the hashboard board this instance pushes to)", () => {
    beforeEach(() => {
      mockFetchInfo.mockResolvedValue({ remote: false });
    });

    it("shows the board id, its visibility and the hashboard account link", async () => {
      mockUseRemoteBoard.mockReturnValue({
        data: {
          boardId: "abc123",
          public: true,
          hashboardURL: "https://hb.example",
          dashboardURL: "https://d.example/abc123",
        },
      });
      renderSidebar("/");

      const chip = await screen.findByRole("link", { name: "abc123" });
      expect(chip).toHaveAttribute("href", "https://d.example/abc123");
      expect(chip).toHaveAttribute("target", "_blank");
      expect(
        screen.getAllByLabelText("board is public").length,
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByLabelText("open hashboard account")[0],
      ).toHaveAttribute("href", "https://hb.example/me");
    });

    it("shows the private icon for a private board", async () => {
      mockUseRemoteBoard.mockReturnValue({
        data: {
          boardId: "abc123",
          public: false,
          dashboardURL: "https://d.example/abc123",
        },
      });
      renderSidebar("/");

      expect(
        (await screen.findAllByLabelText("board is private")).length,
      ).toBeGreaterThan(0);
    });

    it("shows nothing when remote push isn't configured", async () => {
      mockUseRemoteBoard.mockReturnValue({ data: { public: false } });
      renderSidebar("/");

      await waitFor(() => expect(mockFetchInfo).toHaveBeenCalled());
      expect(screen.queryByLabelText(/board is/)).not.toBeInTheDocument();
    });

    it("keeps the nav links board-free", async () => {
      mockUseRemoteBoard.mockReturnValue({
        data: {
          boardId: "abc123",
          public: true,
          dashboardURL: "https://d.example/abc123",
        },
      });
      renderSidebar("/");

      await screen.findByRole("link", { name: "abc123" });
      expect(screen.getByRole("link", { name: "nav.alerts" })).toHaveAttribute(
        "href",
        "/alerts",
      );
    });
  });

  it("shows the build SHA when available", () => {
    mockUseAppInfo.mockReturnValue({
      buildSHA: "abc1234",
      versionStatus: "unknown",
      releaseUrl: null,
    });
    renderSidebar("/");

    expect(screen.getAllByText("sidebar.versionLabel").length).toBeGreaterThan(
      0,
    );
  });

  it("shows nothing build-related when the SHA is unavailable", () => {
    renderSidebar("/");

    expect(screen.queryByText("sidebar.versionLabel")).not.toBeInTheDocument();
  });

  it("closes the mobile drawer when the Home nav item is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(sidebarRouterTree("/", "local", true, onClose));

    for (const item of screen.getAllByText("nav.home")) {
      await user.click(item);
    }

    expect(onClose).toHaveBeenCalled();
  });

  describe("auto-refresh toggle", () => {
    it("is enabled by default", () => {
      renderSidebar("/");

      const switches = screen.getAllByLabelText("auto-refresh");
      expect(switches[0]).toBeChecked();
    });

    it("reflects a previously-disabled setting from storage", () => {
      window.localStorage.setItem("axeos.autoRefreshEnabled", "false");
      renderSidebar("/");

      const switches = screen.getAllByLabelText("auto-refresh");
      expect(switches[0]).not.toBeChecked();
    });

    it("persists the new value and fires a notification when toggled", async () => {
      const user = userEvent.setup();
      renderSidebar("/");

      const switches = screen.getAllByLabelText("auto-refresh");
      await user.click(switches[0]);

      expect(window.localStorage.getItem("axeos.autoRefreshEnabled")).toBe(
        "false",
      );

      const stored = JSON.parse(
        window.localStorage.getItem("axeos.notifications.local") ?? "[]",
      );
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({
        type: "autoRefreshToggled",
        detail: "common.off",
      });
    });
  });

  describe("logo", () => {
    it("links to the local home page", () => {
      renderSidebar("/");

      const logos = screen.getAllByText("AxeOS");
      expect(logos[0].closest("a")).toHaveAttribute("href", "/");
    });

    it("links to the board's home page in remote mode", async () => {
      renderSidebar("/demo", "remote");

      await waitFor(() => {
        const logos = screen.getAllByText("AxeOS");
        expect(logos[0].closest("a")).toHaveAttribute("href", "/demo");
      });
    });
  });

  describe("app version status", () => {
    it("shows nothing extra when the status is unknown", () => {
      mockUseAppInfo.mockReturnValue({
        buildSHA: "abc1234",
        versionStatus: "unknown",
        releaseUrl: null,
      });
      renderSidebar("/");

      expect(
        screen.queryByLabelText("app update available"),
      ).not.toBeInTheDocument();
    });

    it("shows an up-to-date indicator when the running build matches latest", () => {
      mockUseAppInfo.mockReturnValue({
        buildSHA: "abc1234",
        versionStatus: "upToDate",
        releaseUrl: null,
      });
      renderSidebar("/");

      expect(
        screen.getAllByLabelText("sidebar.versionUpToDate", { exact: false })
          .length,
      ).toBeGreaterThan(0);
    });

    it("shows a clickable update-available link to the release when behind", () => {
      mockUseAppInfo.mockReturnValue({
        buildSHA: "abc1234",
        versionStatus: "updateAvailable",
        releaseUrl:
          "https://github.com/joakim-ribier/axeos-dashboard/releases/tag/latest",
      });
      renderSidebar("/");

      const links = screen.getAllByLabelText("app update available");
      expect(links.length).toBeGreaterThan(0);
      expect(links[0]).toHaveAttribute(
        "href",
        "https://github.com/joakim-ribier/axeos-dashboard/releases/tag/latest",
      );
    });

    describe("in the folded rail", () => {
      const RELEASE =
        "https://github.com/joakim-ribier/axeos-dashboard/releases/tag/latest";
      const fold = (versionStatus: string, releaseUrl: string | null) => {
        mockUseAppInfo.mockReturnValue({
          buildSHA: "abc1234",
          versionStatus,
          releaseUrl,
        });
        window.localStorage.setItem("axeos.sidebarCollapsed", "true");
        renderSidebar("/");
      };

      it("keeps the up-to-date status as an icon", () => {
        fold("upToDate", null);

        expect(
          screen.getByRole("button", { name: "sidebar.versionUpToDate" }),
        ).toBeInTheDocument();
      });

      it("keeps the update link to the release", () => {
        fold("updateAvailable", RELEASE);

        expect(
          screen.getByRole("link", { name: "app update available" }),
        ).toHaveAttribute("href", RELEASE);
      });

      it("shows no status when it's unknown", () => {
        fold("unknown", null);

        expect(
          screen.queryByRole("button", { name: "sidebar.versionUpToDate" }),
        ).not.toBeInTheDocument();
        expect(
          screen.queryByRole("link", { name: "app update available" }),
        ).not.toBeInTheDocument();
      });
    });

    it("fires a one-shot notification when the status transitions to updateAvailable", () => {
      mockUseAppInfo.mockReturnValue({
        buildSHA: "abc1234",
        versionStatus: "upToDate",
        releaseUrl: null,
      });
      const { rerender } = renderSidebar("/");

      mockUseAppInfo.mockReturnValue({
        buildSHA: "abc1234",
        versionStatus: "updateAvailable",
        releaseUrl: "https://example.com/releases/latest",
      });
      rerender(sidebarRouterTree("/", "local"));

      const stored = JSON.parse(
        window.localStorage.getItem("axeos.notifications.local") ?? "[]",
      );
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({ type: "appUpdateAvailable" });
    });

    it("does not re-notify on a later poll that still reports updateAvailable", () => {
      // Mirrors the real app: useAppInfo() is backed by an async query, so
      // the very first render always sees "unknown" before it resolves --
      // the transition (and its notification) happens on a later render,
      // not on mount itself.
      const { rerender } = renderSidebar("/");

      mockUseAppInfo.mockReturnValue({
        buildSHA: "abc1234",
        versionStatus: "updateAvailable",
        releaseUrl: "https://example.com/releases/latest",
      });
      rerender(sidebarRouterTree("/", "local"));

      // Same status again, as if a later 90s poll came back unchanged.
      mockUseAppInfo.mockReturnValue({
        buildSHA: "abc1234",
        versionStatus: "updateAvailable",
        releaseUrl: "https://example.com/releases/latest",
      });
      rerender(sidebarRouterTree("/", "local"));

      const stored = JSON.parse(
        window.localStorage.getItem("axeos.notifications.local") ?? "[]",
      );
      expect(stored).toHaveLength(1);
    });
  });

  describe("collapsed rail (desktop)", () => {
    // queryAllByRole only sees accessible elements: the closed mobile
    // drawer stays mounted but hidden, so these are the desktop entries.
    const links = (name: string) => screen.queryAllByRole("link", { name });

    it("folds into icons only, keeping every entry reachable by name", async () => {
      const user = userEvent.setup();
      renderSidebar("/");

      expect(screen.getAllByText("nav.alerts").length).toBeGreaterThan(0);
      await user.click(
        screen.getByRole("button", { name: "sidebar.collapse" }),
      );

      expect(
        screen.getByRole("button", { name: "sidebar.expand" }),
      ).toBeInTheDocument();
      // Labels move to tooltips: no visible text left in the desktop rail,
      // but every link is still named.
      expect(links("nav.alerts")).toHaveLength(1);
      expect(links("nav.home")).toHaveLength(1);
      expect(window.localStorage.getItem("axeos.sidebarCollapsed")).toBe(
        "true",
      );
    });

    it("unfolds back, and remembers that too", async () => {
      const user = userEvent.setup();
      window.localStorage.setItem("axeos.sidebarCollapsed", "true");
      renderSidebar("/");

      await user.click(screen.getByRole("button", { name: "sidebar.expand" }));

      expect(
        screen.getByRole("button", { name: "sidebar.collapse" }),
      ).toBeInTheDocument();
      expect(window.localStorage.getItem("axeos.sidebarCollapsed")).toBe(
        "false",
      );
    });

    it("comes back folded after a reload", () => {
      window.localStorage.setItem("axeos.sidebarCollapsed", "true");
      renderSidebar("/");

      expect(
        screen.getByRole("button", { name: "sidebar.expand" }),
      ).toBeInTheDocument();
    });

    it("keeps the current page highlighted", async () => {
      window.localStorage.setItem("axeos.sidebarCollapsed", "true");
      renderSidebar("/alerts");

      expect(links("nav.alerts")[0]).toHaveClass("Mui-selected");
      expect(links("nav.home")[0]).not.toHaveClass("Mui-selected");
    });

    // Same gates as unfolded, entry by entry: folding must never bring
    // back a hidden page nor drop an enabled one.
    describe.each([
      { page: "settings", label: "nav.settings" },
      { page: "backups", label: "nav.backups" },
      { page: "audit", label: "nav.audit" },
    ])("the $page entry", ({ page, label }) => {
      const withPage = (state: "enabled" | "readonly" | "hidden") => {
        mockUseUiFeatures.mockReturnValue({
          ui: {
            page: {
              settings: "enabled",
              backups: "enabled",
              audit: "enabled",
              [page]: state,
            },
            action: { minerRestart: "enabled", minerPoolSwitch: "enabled" },
          },
          isLoading: false,
        });
        window.localStorage.setItem("axeos.sidebarCollapsed", "true");
        renderSidebar("/");
      };

      it("is in the folded rail when enabled", () => {
        withPage("enabled");
        expect(links(label)).toHaveLength(1);
      });

      it("is in the folded rail when read-only", () => {
        withPage("readonly");
        expect(links(label)).toHaveLength(1);
      });

      it("is not in the folded rail when hidden", () => {
        withPage("hidden");
        expect(links(label)).toHaveLength(0);
      });
    });
  });
});
