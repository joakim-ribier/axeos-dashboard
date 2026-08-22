import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { RefreshSettingsProvider } from "@/contexts/RefreshSettingsContext";

import { Sidebar } from "./Sidebar";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockUseAppInfo = vi.fn();
vi.mock("@/hooks/useMiners", () => ({
  useAppInfo: () => mockUseAppInfo(),
}));

function renderSidebar(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <RefreshSettingsProvider>
        <NotificationsProvider>
          <Sidebar mobileOpen={false} onClose={() => {}} />
        </NotificationsProvider>
      </RefreshSettingsProvider>
    </MemoryRouter>,
  );
}

describe("Sidebar", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockUseAppInfo.mockReturnValue({
      buildSHA: undefined,
      versionStatus: "unknown",
      releaseUrl: null,
      hashboardUrl: null,
      isPublic: false,
    });
  });

  describe("board public/private indicator", () => {
    it("shows the private icon by default", () => {
      renderSidebar("/demo");

      expect(
        screen.getAllByLabelText("board is private").length,
      ).toBeGreaterThan(0);
      expect(
        screen.queryByLabelText("board is public"),
      ).not.toBeInTheDocument();
    });

    it("shows the public icon when the board is public", () => {
      mockUseAppInfo.mockReturnValue({
        buildSHA: undefined,
        versionStatus: "unknown",
        releaseUrl: null,
        hashboardUrl: null,
        isPublic: true,
      });
      renderSidebar("/demo");

      expect(
        screen.getAllByLabelText("board is public").length,
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

    it("links Home/Alerts to the board-scoped routes when on a remote board", () => {
      renderSidebar("/demo");

      const homeLinks = screen
        .getAllByText("nav.home")
        .map((el) => el.closest("a"));
      const alertsLinks = screen
        .getAllByText("nav.alerts")
        .map((el) => el.closest("a"));

      expect(homeLinks[0]).toHaveAttribute("href", "/demo");
      expect(alertsLinks[0]).toHaveAttribute("href", "/demo/alerts");
    });

    it("marks Home as selected on the board root, and Alerts as selected on the alerts route", () => {
      const { container: homeContainer } = renderSidebar("/demo");
      const homeSelected = homeContainer.querySelectorAll(".Mui-selected");
      expect(homeSelected.length).toBeGreaterThan(0);
      expect(homeSelected[0]).toHaveTextContent("nav.home");

      const { container: alertsContainer } = renderSidebar("/demo/alerts");
      const alertsSelected = alertsContainer.querySelectorAll(".Mui-selected");
      expect(alertsSelected.length).toBeGreaterThan(0);
      expect(alertsSelected[0]).toHaveTextContent("nav.alerts");
    });
  });

  it("shows the current board id (without the word 'board') on a remote route", () => {
    renderSidebar("/demo");

    expect(screen.getAllByText("demo").length).toBeGreaterThan(0);
    expect(screen.queryByText(/board demo/)).not.toBeInTheDocument();
  });

  it("shows the full board id, not truncated to a handful of characters", () => {
    const longBoardId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    renderSidebar(`/${longBoardId}`);

    expect(screen.getAllByText(longBoardId).length).toBeGreaterThan(0);
  });

  it("does not show a board id chip on the local route", () => {
    renderSidebar("/");

    expect(screen.queryByText("demo")).not.toBeInTheDocument();
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

    render(
      <MemoryRouter initialEntries={["/"]}>
        <RefreshSettingsProvider>
          <NotificationsProvider>
            <Sidebar mobileOpen onClose={onClose} />
          </NotificationsProvider>
        </RefreshSettingsProvider>
      </MemoryRouter>,
    );

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

    it("links to the board's home page in remote mode", () => {
      renderSidebar("/demo");

      const logos = screen.getAllByText("AxeOS");
      expect(logos[0].closest("a")).toHaveAttribute("href", "/demo");
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
      rerender(
        <MemoryRouter initialEntries={["/"]}>
          <RefreshSettingsProvider>
            <NotificationsProvider>
              <Sidebar mobileOpen={false} onClose={() => {}} />
            </NotificationsProvider>
          </RefreshSettingsProvider>
        </MemoryRouter>,
      );

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
      const sidebarTree = (
        <MemoryRouter initialEntries={["/"]}>
          <RefreshSettingsProvider>
            <NotificationsProvider>
              <Sidebar mobileOpen={false} onClose={() => {}} />
            </NotificationsProvider>
          </RefreshSettingsProvider>
        </MemoryRouter>
      );

      const { rerender } = renderSidebar("/");

      mockUseAppInfo.mockReturnValue({
        buildSHA: "abc1234",
        versionStatus: "updateAvailable",
        releaseUrl: "https://example.com/releases/latest",
      });
      rerender(sidebarTree);

      // Same status again, as if a later 90s poll came back unchanged.
      mockUseAppInfo.mockReturnValue({
        buildSHA: "abc1234",
        versionStatus: "updateAvailable",
        releaseUrl: "https://example.com/releases/latest",
      });
      rerender(sidebarTree);

      const stored = JSON.parse(
        window.localStorage.getItem("axeos.notifications.local") ?? "[]",
      );
      expect(stored).toHaveLength(1);
    });
  });
});
