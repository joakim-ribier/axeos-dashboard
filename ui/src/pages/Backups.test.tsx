import { I18nextProvider } from "react-i18next";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/i18n";

import { Backups } from "./Backups";

const mockUseBackups = vi.fn();
vi.mock("@/hooks/useBackups", async () => ({
  ...(await vi.importActual<typeof import("@/hooks/useBackups")>(
    "@/hooks/useBackups",
  )),
  useBackups: (...args: unknown[]) => mockUseBackups(...args),
}));

// Relative to today so the "in progress" badge and the default year match
// whatever date the suite runs on.
const currentMonth = new Date().toISOString().slice(0, 7);
const currentYear = currentMonth.slice(0, 4);
const lastYear = String(Number(currentYear) - 1);

const backups = [
  { month: currentMonth, size: 2048, updatedAt: "2026-10-06T00:30:00Z" },
  {
    month: `${lastYear}-12`,
    size: 1024,
    updatedAt: "2026-10-06T00:30:00Z",
    checksum: "0123456789abcdef0123456789abcdef",
  },
  {
    month: `${lastYear}-11`,
    size: 3 * 1024 * 1024,
    updatedAt: "2026-10-06T00:30:00Z",
  },
];

const monthLabel = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString(i18n.language, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

function renderBackups() {
  return render(
    <I18nextProvider i18n={i18n}>
      <Backups />
    </I18nextProvider>,
  );
}

const downloadSelectionButton = () =>
  screen.getByText("Download").closest("a")!;

describe("Backups page", () => {
  beforeEach(() => {
    mockUseBackups.mockReturnValue({
      data: backups,
      isLoading: false,
      error: null,
    });
  });

  it("shows an empty state when no archive exists yet", () => {
    mockUseBackups.mockReturnValue({ data: [], isLoading: false, error: null });
    renderBackups();

    expect(
      screen.getByText(
        "No backups yet: the first one will be created tonight.",
      ),
    ).toBeInTheDocument();
  });

  it("shows an error when the list can't be loaded", () => {
    mockUseBackups.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("boom"),
    });
    renderBackups();

    expect(screen.getByText("Failed to load backups.")).toBeInTheDocument();
  });

  it("shows the current year by default, with the current month flagged in progress", () => {
    renderBackups();

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(1);
    expect(
      within(rows[0]).getByText(monthLabel(currentMonth)),
    ).toBeInTheDocument();
    expect(within(rows[0]).getByText("in progress")).toBeInTheDocument();
    expect(within(rows[0]).getByText(/\b(00|12):30\b/)).toBeInTheDocument();
    expect(
      within(rows[0]).getByRole("link", { name: "Download" }),
    ).toHaveAttribute("href", `/api/backups/download?months=${currentMonth}`);
    expect(screen.getByText(currentYear)).toBeInTheDocument();
  });

  it("shows the checksum of final months only", async () => {
    renderBackups();

    const [currentRow] = screen.getAllByRole("row").slice(1);
    expect(within(currentRow).getByText("—")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Previous year" }),
    );

    expect(
      screen.getByText("0123456789abcdef0123456789abcdef"),
    ).toBeInTheDocument();
  });

  it("pages back to the previous year", async () => {
    renderBackups();

    await userEvent.click(
      screen.getByRole("button", { name: "Previous year" }),
    );

    const rows = screen.getAllByRole("row").slice(1);
    expect(
      rows.map((r) => within(r).getAllByRole("cell")[1].textContent),
    ).toEqual([monthLabel(`${lastYear}-12`), monthLabel(`${lastYear}-11`)]);
    expect(screen.queryByText("in progress")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Previous year" }),
    ).toBeDisabled();
  });

  it("keeps the selection across years and downloads it as one archive", async () => {
    renderBackups();

    expect(downloadSelectionButton()).toHaveAttribute("aria-disabled", "true");

    await userEvent.click(
      screen.getByRole("checkbox", { name: monthLabel(currentMonth) }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Previous year" }),
    );
    await userEvent.click(
      screen.getByRole("checkbox", { name: monthLabel(`${lastYear}-11`) }),
    );

    expect(screen.getByText("Selected: 2 · ≈ 3 MB")).toBeInTheDocument();
    expect(downloadSelectionButton()).not.toHaveAttribute("aria-disabled");
    expect(downloadSelectionButton()).toHaveAttribute(
      "href",
      `/api/backups/download?months=${currentMonth},${lastYear}-11`,
    );
  });

  it("selects and clears all only within the displayed year", async () => {
    renderBackups();

    await userEvent.click(
      screen.getByRole("checkbox", { name: monthLabel(currentMonth) }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Previous year" }),
    );
    await userEvent.click(screen.getByRole("checkbox", { name: "Select all" }));

    expect(screen.getByText("Selected: 3 · ≈ 3 MB")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: "Select all" }));

    expect(screen.getByText("Selected: 1 · ≈ 2 kB")).toBeInTheDocument();
  });
});
