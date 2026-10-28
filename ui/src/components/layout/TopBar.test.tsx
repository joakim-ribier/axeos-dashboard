import { I18nextProvider } from "react-i18next";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ModeProvider } from "@/contexts/ModeContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { RefreshSettingsProvider } from "@/contexts/RefreshSettingsContext";
import i18n from "@/i18n";
import type { AlertEvent, AlertsResponse } from "@/schemas/minerSchema";

import { TopBar } from "./TopBar";

vi.mock("@/components/LanguageSwitcher", () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher" />,
}));

// The server's side of the bell: what GET /api/miners/alerts returns, and
// the POST that marks it read.
let alertsResponse: AlertsResponse = { events: [] };
const refetch = vi.fn();
const markSeen = vi.fn();
vi.mock("@/hooks/useAlerts", () => ({
  useAlerts: () => ({ data: alertsResponse, refetch }),
  useMarkAlertsSeen: () => ({ mutate: markSeen }),
}));

const alertEvent = (overrides: Partial<AlertEvent>): AlertEvent => ({
  ts: "2026-10-28T10:00:00Z",
  mac: "aabbccddeeff",
  ip: "10.0.0.1",
  hostname: "bitaxe-office",
  type: "offline",
  state: "raised",
  ...overrides,
});

// Uses the app's real i18n instance (rather than mocking react-i18next) so
// the notification message assertions below also catch a wrong/missing
// translation key, not just a raw key echo.
function renderTopBar(onMenuClick: () => void = () => {}) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route
              path="/*"
              element={
                <ModeProvider mode="local">
                  <RefreshSettingsProvider>
                    <NotificationsProvider>
                      <TopBar
                        onMenuClick={onMenuClick}
                        titleSlotRef={() => {}}
                      />
                      <Link to="/">to home</Link>
                      <Link to="/alerts">to alerts</Link>
                    </NotificationsProvider>
                  </RefreshSettingsProvider>
                </ModeProvider>
              }
            />
          </Routes>
        </MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

describe("TopBar", () => {
  beforeEach(() => {
    window.localStorage.clear();
    alertsResponse = { events: [] };
    refetch.mockReset();
    markSeen.mockReset();
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

  describe("the bell", () => {
    const badge = (container: HTMLElement) =>
      container.querySelector(".MuiBadge-badge");
    const openBell = (user: ReturnType<typeof userEvent.setup>) =>
      user.click(screen.getByRole("button", { name: "notifications" }));

    it("lists the alerts raised and cleared and its own events, most recent first", async () => {
      alertsResponse = {
        events: [
          alertEvent({
            ts: "2026-10-28T11:00:00Z",
            type: "tempHigh",
            state: "cleared",
          }),
          alertEvent({
            ts: "2026-10-28T10:00:00Z",
            type: "tempHigh",
            value: 64.6,
          }),
        ],
      };
      window.localStorage.setItem(
        "axeos.notifications",
        JSON.stringify([
          {
            id: "n1",
            timestamp: Date.parse("2026-10-28T10:30:00Z"),
            type: "appUpdateAvailable",
          },
        ]),
      );

      const user = userEvent.setup();
      renderTopBar();
      await openBell(user);

      const lines = [
        "bitaxe-office temperature back to normal",
        "A new version of the dashboard is available",
        "bitaxe-office temperature reached 65°C",
      ].map((text) => screen.getByText(text));
      expect(lines[0].compareDocumentPosition(lines[1])).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
      expect(lines[1].compareDocumentPosition(lines[2])).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
      expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
    });

    it("counts what's newer than the server's seenAt", () => {
      alertsResponse = {
        events: [
          alertEvent({ ts: "2026-10-28T11:00:00Z", state: "cleared" }),
          alertEvent({ ts: "2026-10-28T10:00:00Z" }),
        ],
        seenAt: "2026-10-28T10:00:00Z",
      };

      const { container } = renderTopBar();

      expect(badge(container)?.textContent).toBe("1");
    });

    it("marks what it shows read on the server when clicked, then fetches again", async () => {
      alertsResponse = {
        events: [alertEvent({ ts: "2026-10-28T11:00:00Z" })],
      };

      const user = userEvent.setup();
      renderTopBar();
      await openBell(user);

      expect(markSeen).toHaveBeenCalledWith(Date.parse("2026-10-28T11:00:00Z"));
      expect(refetch).toHaveBeenCalled();
    });

    it("keeps an alert that arrives after the click unread", async () => {
      alertsResponse = {
        events: [alertEvent({ ts: "2026-10-28T11:00:00Z" })],
      };

      const user = userEvent.setup();
      const { container } = renderTopBar();
      await openBell(user);

      // The click's POST went through, and the fetch it triggered brought
      // a newer one.
      alertsResponse = {
        events: [
          alertEvent({ ts: "2026-10-28T11:02:00Z", state: "cleared" }),
          alertEvent({ ts: "2026-10-28T11:00:00Z" }),
        ],
        seenAt: "2026-10-28T11:00:00Z",
      };
      await user.keyboard("{Escape}");

      expect(markSeen).toHaveBeenCalledTimes(1);
      expect(badge(container)?.textContent).toBe("1");
    });

    it("marks nothing when everything shown was already read", async () => {
      alertsResponse = {
        events: [alertEvent({ ts: "2026-10-28T11:00:00Z" })],
        seenAt: "2026-10-28T11:00:00Z",
      };

      const user = userEvent.setup();
      const { container } = renderTopBar();
      expect(badge(container)?.className).toContain("MuiBadge-invisible");
      await openBell(user);

      expect(markSeen).not.toHaveBeenCalled();
    });

    it("hides everything shown in this browser on Clear", async () => {
      alertsResponse = {
        events: [alertEvent({ ts: "2026-10-28T11:00:00Z" })],
      };

      const user = userEvent.setup();
      renderTopBar();
      await openBell(user);
      await user.click(screen.getByRole("button", { name: "Clear" }));

      expect(screen.getByText("No notifications yet.")).toBeInTheDocument();
      expect(window.localStorage.getItem("axeos.notifications.clearedAt")).toBe(
        String(Date.parse("2026-10-28T11:00:00Z")),
      );
    });
  });

  it("renders the language switcher", () => {
    renderTopBar();

    expect(screen.getByTestId("language-switcher")).toBeInTheDocument();
  });

  describe("auto-refresh toggle", () => {
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

    it("turns it off on a click, keeps it, and says so", async () => {
      const user = userEvent.setup();
      renderTopBar();

      await user.click(
        screen.getByRole("button", { name: /Auto-refresh is on/ }),
      );

      expect(
        screen.getByRole("button", { name: /Auto-refresh is off/ }),
      ).toBeInTheDocument();
      expect(window.localStorage.getItem("axeos.autoRefreshEnabled")).toBe(
        "false",
      );
      const stored = JSON.parse(
        window.localStorage.getItem("axeos.notifications") ?? "[]",
      );
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({
        type: "autoRefreshToggled",
        detail: "off",
      });
    });
  });

  describe("on a phone", () => {
    beforeEach(() => {
      vi.spyOn(window, "matchMedia").mockImplementation(
        (query) =>
          ({
            matches: true,
            media: query,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
          }) as unknown as MediaQueryList,
      );
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("unfolds the rest of the controls from the 'More' button", async () => {
      const user = userEvent.setup();
      renderTopBar();
      const more = await screen.findByRole("button", { name: "More" });

      expect(more).toHaveAttribute("aria-expanded", "false");
      await user.click(more);
      expect(more).toHaveAttribute("aria-expanded", "true");
      await user.click(more);
      expect(more).toHaveAttribute("aria-expanded", "false");
    });

    it("folds back on navigation, and stays folded coming back", async () => {
      const user = userEvent.setup();
      renderTopBar();
      const more = await screen.findByRole("button", { name: "More" });

      await user.click(more);
      await user.click(screen.getByRole("link", { name: "to alerts" }));
      expect(more).toHaveAttribute("aria-expanded", "false");

      await user.click(screen.getByRole("link", { name: "to home" }));
      expect(more).toHaveAttribute("aria-expanded", "false");
    });
  });
});
