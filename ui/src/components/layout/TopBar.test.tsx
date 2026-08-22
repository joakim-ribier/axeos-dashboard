import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { RefreshSettingsProvider } from "@/contexts/RefreshSettingsContext";
import i18n from "@/i18n";

import { TopBar } from "./TopBar";

vi.mock("@/components/LanguageSwitcher", () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher" />,
}));

// The bell also renders currently-active alerts (useActiveAlerts) and runs
// useAlertResolutionEffect, which cross-references alert history against
// the live miners list to turn resolutions into notifications -- covered
// by its own tests (minerNotifications.test.ts for the underlying logic).
// Mocked here so this file stays focused on the local-notification/layout
// behavior it actually tests, without making a real network call.
vi.mock("@/hooks/useAlerts", () => ({
  useActiveAlerts: () => [],
  useAlertResolutionEffect: () => {},
}));

// Uses the app's real i18n instance (rather than mocking react-i18next) so
// the notification message assertions below also catch a wrong/missing
// translation key, not just a raw key echo.
function renderTopBar(onMenuClick: () => void = () => {}) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/"]}>
          <RefreshSettingsProvider>
            <NotificationsProvider>
              <TopBar onMenuClick={onMenuClick} />
            </NotificationsProvider>
          </RefreshSettingsProvider>
        </MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

describe("TopBar", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("calls onMenuClick when the hamburger button is clicked", async () => {
    const user = userEvent.setup();
    const onMenuClick = vi.fn();
    renderTopBar(onMenuClick);

    await user.click(
      screen.getByRole("button", { name: "open navigation menu" }),
    );

    expect(onMenuClick).toHaveBeenCalledTimes(1);
  });

  it("renders the notifications button", () => {
    renderTopBar();

    expect(
      screen.getByRole("button", { name: "notifications" }),
    ).toBeInTheDocument();
  });

  it("shows an empty state in the notifications menu when there are none", async () => {
    const user = userEvent.setup();
    renderTopBar();

    await user.click(screen.getByRole("button", { name: "notifications" }));

    expect(
      await screen.findByText("No notifications yet."),
    ).toBeInTheDocument();
  });

  it("lists persisted notifications with a clear button", async () => {
    window.localStorage.setItem(
      "axeos.notifications.local",
      JSON.stringify([
        {
          id: "n1",
          timestamp: Date.now(),
          minerLabel: "bitaxe-office",
          type: "offline",
        },
      ]),
    );

    const user = userEvent.setup();
    renderTopBar();

    await user.click(screen.getByRole("button", { name: "notifications" }));

    expect(
      await screen.findByText("bitaxe-office went offline"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
  });

  it("shows an unread badge for a persisted notification, then hides it once opened", async () => {
    window.localStorage.setItem(
      "axeos.notifications.local",
      JSON.stringify([
        {
          id: "n1",
          timestamp: Date.now(),
          minerLabel: "bitaxe-office",
          type: "offline",
        },
      ]),
    );

    const user = userEvent.setup();
    const { container } = renderTopBar();
    const badge = () => container.querySelector(".MuiBadge-badge");

    expect(badge()?.textContent).toBe("1");
    expect(badge()?.className).not.toContain("MuiBadge-invisible");

    await user.click(screen.getByRole("button", { name: "notifications" }));

    expect(badge()?.className).toContain("MuiBadge-invisible");
  });

  it("only counts ids not already marked read -- e.g. one seen last session, one new", () => {
    window.localStorage.setItem(
      "axeos.notifications.local",
      JSON.stringify([
        {
          id: "n1",
          timestamp: Date.now(),
          minerLabel: "bitaxe-office",
          type: "offline",
        },
        {
          id: "n2",
          timestamp: Date.now(),
          minerLabel: "bitaxe-office",
          type: "online",
        },
      ]),
    );
    window.localStorage.setItem(
      "axeos.notifications.read.local",
      JSON.stringify(["n1"]),
    );

    const { container } = renderTopBar();

    expect(container.querySelector(".MuiBadge-badge")?.textContent).toBe("1");
  });

  it("renders the language switcher", () => {
    renderTopBar();

    expect(screen.getByTestId("language-switcher")).toBeInTheDocument();
  });

  describe("auto-refresh indicator", () => {
    it("shows the 'on' state by default", () => {
      renderTopBar();

      expect(
        screen.getByLabelText("Auto-refresh is on", { exact: false }),
      ).toBeInTheDocument();
    });

    it("shows the 'off' state when auto-refresh was disabled", () => {
      window.localStorage.setItem("axeos.autoRefreshEnabled", "false");
      renderTopBar();

      expect(
        screen.getByLabelText("Auto-refresh is off", { exact: false }),
      ).toBeInTheDocument();
    });
  });
});
