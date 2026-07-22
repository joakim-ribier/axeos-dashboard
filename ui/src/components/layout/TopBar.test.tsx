import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SearchProvider } from "@/contexts/SearchContext";

import { TopBar } from "./TopBar";

vi.mock("@/components/LanguageSwitcher", () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher" />,
}));

function renderTopBar(onMenuClick: () => void = () => {}) {
  return render(
    <SearchProvider>
      <TopBar onMenuClick={onMenuClick} />
    </SearchProvider>,
  );
}

describe("TopBar", () => {
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

  it("renders the language switcher", () => {
    renderTopBar();

    expect(screen.getByTestId("language-switcher")).toBeInTheDocument();
  });
});
