import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TopBar } from "./TopBar";

vi.mock("@/components/LanguageSwitcher", () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher" />,
}));

describe("TopBar", () => {
  it("calls onMenuClick when the hamburger button is clicked", async () => {
    const user = userEvent.setup();
    const onMenuClick = vi.fn();
    render(<TopBar onMenuClick={onMenuClick} />);

    await user.click(
      screen.getByRole("button", { name: "open navigation menu" }),
    );

    expect(onMenuClick).toHaveBeenCalledTimes(1);
  });

  it("renders the search field placeholder", () => {
    render(<TopBar onMenuClick={() => {}} />);

    expect(screen.getAllByPlaceholderText("Search…").length).toBeGreaterThan(0);
  });

  it("renders the notifications button", () => {
    render(<TopBar onMenuClick={() => {}} />);

    expect(
      screen.getByRole("button", { name: "notifications" }),
    ).toBeInTheDocument();
  });

  it("renders the language switcher", () => {
    render(<TopBar onMenuClick={() => {}} />);

    expect(screen.getByTestId("language-switcher")).toBeInTheDocument();
  });
});
