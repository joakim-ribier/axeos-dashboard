import { I18nextProvider } from "react-i18next";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { SearchProvider } from "@/contexts/SearchContext";
import i18n from "@/i18n";

import { TopBar } from "./TopBar";

vi.mock("@/components/LanguageSwitcher", () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher" />,
}));

// Uses the app's real i18n instance (rather than mocking react-i18next) so
// the notification message assertions below also catch a wrong/missing
// translation key, not just a raw key echo.
function renderTopBar(onMenuClick: () => void = () => {}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <NotificationsProvider>
        <SearchProvider>
          <TopBar onMenuClick={onMenuClick} />
        </SearchProvider>
      </NotificationsProvider>
    </I18nextProvider>,
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

  it("renders the search field", () => {
    renderTopBar();

    expect(screen.getAllByPlaceholderText("Search…").length).toBeGreaterThan(0);
  });

  it("filters as the user types, keeping both search field instances in sync", async () => {
    const user = userEvent.setup();
    renderTopBar();

    const fields = screen.getAllByPlaceholderText(
      "Search…",
    ) as HTMLInputElement[];
    await user.type(fields[0], "office");

    for (const field of screen.getAllByPlaceholderText(
      "Search…",
    ) as HTMLInputElement[]) {
      expect(field).toHaveValue("office");
    }
  });

  it("renders a search syntax help icon next to the search field", () => {
    renderTopBar();

    expect(
      screen.getAllByRole("button", { name: "search syntax help" }).length,
    ).toBeGreaterThan(0);
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
      "axeos.notifications",
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

  it("renders the language switcher", () => {
    renderTopBar();

    expect(screen.getByTestId("language-switcher")).toBeInTheDocument();
  });
});
