import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

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
      <Sidebar mobileOpen={false} onClose={() => {}} />
    </MemoryRouter>,
  );
}

describe("Sidebar", () => {
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
        <Sidebar mobileOpen onClose={onClose} />
      </MemoryRouter>,
    );

    for (const item of screen.getAllByText("nav.home")) {
      await user.click(item);
    }

    expect(onClose).toHaveBeenCalled();
  });
});
