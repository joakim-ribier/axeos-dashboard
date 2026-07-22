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

const mockUseBuildSHA = vi.fn();
vi.mock("@/hooks/useMiners", () => ({
  useBuildSHA: () => mockUseBuildSHA(),
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
  });

  it("renders the brand mark and the Home nav item", () => {
    mockUseBuildSHA.mockReturnValue(undefined);
    renderSidebar("/");

    expect(screen.getAllByText("AxeOS").length).toBeGreaterThan(0);
    expect(screen.getAllByText("nav.home").length).toBeGreaterThan(0);
  });

  it("shows the current board id on a remote route", () => {
    mockUseBuildSHA.mockReturnValue(undefined);
    renderSidebar("/demo");

    expect(screen.getAllByText("board demo").length).toBeGreaterThan(0);
  });

  it("does not show a board id on the local route", () => {
    mockUseBuildSHA.mockReturnValue(undefined);
    renderSidebar("/");

    expect(screen.queryByText(/^board /)).not.toBeInTheDocument();
  });

  it("shows the build SHA when available", () => {
    mockUseBuildSHA.mockReturnValue("abc1234");
    renderSidebar("/");

    expect(screen.getAllByText("build abc1234").length).toBeGreaterThan(0);
  });

  it("shows nothing build-related when the SHA is unavailable", () => {
    mockUseBuildSHA.mockReturnValue(undefined);
    renderSidebar("/");

    expect(screen.queryByText(/^build /)).not.toBeInTheDocument();
  });

  it("closes the mobile drawer when the Home nav item is clicked", async () => {
    mockUseBuildSHA.mockReturnValue(undefined);
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
      mockUseBuildSHA.mockReturnValue(undefined);
      renderSidebar("/");

      const switches = screen.getAllByLabelText("auto-refresh");
      expect(switches[0]).toBeChecked();
    });

    it("reflects a previously-disabled setting from storage", () => {
      window.localStorage.setItem("axeos.autoRefreshEnabled", "false");
      mockUseBuildSHA.mockReturnValue(undefined);
      renderSidebar("/");

      const switches = screen.getAllByLabelText("auto-refresh");
      expect(switches[0]).not.toBeChecked();
    });

    it("persists the new value and fires a notification when toggled", async () => {
      mockUseBuildSHA.mockReturnValue(undefined);
      const user = userEvent.setup();
      renderSidebar("/");

      const switches = screen.getAllByLabelText("auto-refresh");
      await user.click(switches[0]);

      expect(window.localStorage.getItem("axeos.autoRefreshEnabled")).toBe(
        "false",
      );

      const stored = JSON.parse(
        window.localStorage.getItem("axeos.notifications") ?? "[]",
      );
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({
        type: "autoRefreshToggled",
        detail: "common.off",
      });
    });
  });

  describe("logo", () => {
    it("reloads the page when clicked", async () => {
      mockUseBuildSHA.mockReturnValue(undefined);
      const reload = vi.fn();
      Object.defineProperty(window, "location", {
        value: { ...window.location, reload },
        writable: true,
      });
      const user = userEvent.setup();
      renderSidebar("/");

      const logos = screen.getAllByText("AxeOS");
      await user.click(logos[0]);

      expect(reload).toHaveBeenCalledTimes(1);
    });
  });
});
