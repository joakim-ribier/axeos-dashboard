import { I18nextProvider } from "react-i18next";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { addDays, startOfDay } from "date-fns";
import { beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/i18n";
import type { AuditEntry } from "@/schemas/auditSchema";

import { Audit } from "./Audit";

const mockUseAudit = vi.fn();
vi.mock("@/hooks/useAudit", async () => ({
  ...(await vi.importActual<typeof import("@/hooks/useAudit")>(
    "@/hooks/useAudit",
  )),
  useAudit: (...args: unknown[]) => mockUseAudit(...args),
}));

const mockDownloadFile = vi.fn().mockResolvedValue(undefined);
vi.mock("@/utils/download", () => ({
  downloadFile: (...args: unknown[]) => mockDownloadFile(...args),
}));

const mockUseMiners = vi.fn();
vi.mock("@/hooks/useMiners", async () => ({
  ...(await vi.importActual<typeof import("@/hooks/useMiners")>(
    "@/hooks/useMiners",
  )),
  useMiners: (...args: unknown[]) => mockUseMiners(...args),
}));

const apiRestart: AuditEntry = {
  ts: "2026-10-10T07:57:41Z",
  source: "api",
  type: "restart",
  target: "10.0.0.1",
  ip: "192.168.1.20",
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
  requestId: "pi/abc-000001",
  status: 204,
};

const failedSchedulerSwitch: AuditEntry = {
  ts: "2026-10-09T21:59:59Z",
  source: "system",
  service: "scheduler",
  type: "switch_fallback",
  target: "10.0.0.2",
  cron: "59 59 23 * * FRI",
  error: "connection refused",
};

const withEntries = (entries: AuditEntry[]) =>
  mockUseAudit.mockReturnValue({
    data: { entries, total: entries.length, page: 1, pageSize: 50 },
    isLoading: false,
    isPlaceholderData: false,
  });

const lastFilters = () => mockUseAudit.mock.lastCall?.[0];

function renderAudit() {
  return render(
    <I18nextProvider i18n={i18n}>
      <Audit />
    </I18nextProvider>,
  );
}

describe("Audit page", () => {
  beforeEach(() => {
    mockUseAudit.mockReset();
    mockUseMiners.mockReturnValue({
      data: [
        { ip: "10.0.0.1", hostname: "bitaxe-office" },
        { ip: "10.0.0.2", hostname: undefined },
      ],
    });
    withEntries([apiRestart, failedSchedulerSwitch]);
  });

  it("shows an empty state when the period has no events", () => {
    withEntries([]);
    renderAudit();

    expect(screen.getByText("No events in this period.")).toBeInTheDocument();
  });

  it("requests the last 24 hours by default, with nothing to clear", () => {
    renderAudit();

    expect(lastFilters()).toMatchObject({
      page: 1,
      from: undefined,
      to: undefined,
    });
    expect(
      screen.queryByRole("button", { name: "Clear all" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/2 events · last 24 h/)).toBeInTheDocument();
  });

  it("renders a dashboard action with the miner's name and a short browser summary", () => {
    renderAudit();

    const row = screen.getAllByTestId("audit-row")[0];
    expect(
      within(row).getByText("Restart · bitaxe-office"),
    ).toBeInTheDocument();
    const caption = within(row).getByText(/Dashboard · 192\.168\.1\.20/);
    expect(caption).toHaveTextContent("Chrome 154 · macOS");
    // The full User-Agent stays one hover away.
    expect(caption).toHaveAttribute("title", apiRestart.userAgent);
  });

  it("renders a failed scheduler run with its cron and error", () => {
    renderAudit();

    const row = screen.getAllByTestId("audit-row")[1];
    expect(
      within(row).getByText("Switch to fallback pool · 10.0.0.2"),
    ).toBeInTheDocument();
    expect(
      within(row).getByText(/System · Scheduler · 59 59 23 \* \* FRI · Failed/),
    ).toBeInTheDocument();
    expect(within(row).getByText("connection refused")).toBeInTheDocument();
  });

  it("labels a pool switch with no target as applying to every miner", () => {
    withEntries([{ ...failedSchedulerSwitch, target: undefined }]);
    renderAudit();

    expect(
      screen.getByText("Switch to fallback pool · all miners"),
    ).toBeInTheDocument();
  });

  it("filters by type, shows it as a removable chip, and exports with it", async () => {
    const user = userEvent.setup();
    renderAudit();

    await user.click(screen.getByText("All types"));
    await user.click(
      within(await screen.findByRole("listbox")).getByText("Restart"),
    );

    await waitFor(() =>
      expect(lastFilters()).toMatchObject({ page: 1, type: "restart" }),
    );
    expect(screen.getByText("Type: Restart")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Export/ }));
    expect(mockDownloadFile).toHaveBeenCalledWith(
      "/api/audit/export?type=restart",
    );

    await user.click(screen.getByRole("button", { name: "Clear all" }));

    await waitFor(() =>
      expect(lastFilters()).toMatchObject({ type: undefined }),
    );
    expect(screen.queryByText("Type: Restart")).not.toBeInTheDocument();
  });

  it("sends a picked day as its local midnight-to-midnight bounds", async () => {
    const user = userEvent.setup();
    renderAudit();

    // Segmented MUI date field, en-US order: month, day, year.
    await user.click(screen.getAllByRole("spinbutton")[0]);
    await user.keyboard("07142026");

    const dayStart = startOfDay(new Date(2026, 6, 14));
    await waitFor(() =>
      expect(lastFilters()).toMatchObject({
        page: 1,
        from: dayStart.toISOString(),
        to: addDays(dayStart, 1).toISOString(),
      }),
    );
  });

  it("shows what an export asked for", () => {
    withEntries([
      {
        ts: "2026-10-10T09:00:00Z",
        source: "api",
        type: "download_backups",
        ip: "192.168.1.20",
        query: "months=2026-09,2026-10",
        status: 200,
      },
    ]);
    renderAudit();

    const row = screen.getByTestId("audit-row");
    expect(within(row).getByText("Backups download")).toBeInTheDocument();
    expect(within(row).getByText("months=2026-09,2026-10")).toBeInTheDocument();
  });

  it("copies the raw entry as JSON", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    renderAudit();

    await user.click(screen.getAllByRole("button", { name: "Copy entry" })[0]);

    expect(writeText).toHaveBeenCalledWith(JSON.stringify(apiRestart, null, 2));
  });
});
