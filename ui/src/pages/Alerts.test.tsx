import { I18nextProvider } from "react-i18next";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { format } from "date-fns";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ModeProvider } from "@/contexts/ModeContext";
import i18n from "@/i18n";

import { Alerts } from "./Alerts";

const mockUseAlertsHistory = vi.fn();
vi.mock("@/hooks/useAlertsHistory", () => ({
  useAlertsHistory: (...args: unknown[]) => mockUseAlertsHistory(...args),
}));

const mockUseMiners = vi.fn();
const mockUseAppInfo = vi.fn();
vi.mock("@/hooks/useMiners", async () => {
  const actual =
    await vi.importActual<typeof import("@/hooks/useMiners")>(
      "@/hooks/useMiners",
    );
  return {
    ...actual,
    useMiners: (...args: unknown[]) => mockUseMiners(...args),
    useAppInfo: (...args: unknown[]) => mockUseAppInfo(...args),
  };
});

function renderAlerts(initialEntry = "/alerts") {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route
              path="/alerts"
              element={
                <ModeProvider mode="local">
                  <Alerts />
                </ModeProvider>
              }
            />
          </Routes>
        </MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

describe("Alerts page", () => {
  beforeEach(() => {
    mockUseAppInfo.mockReturnValue({ hashboardUrl: null });
    mockUseMiners.mockReturnValue({
      data: [
        { ip: "10.0.0.1", hostname: "bitaxe-office" },
        { ip: "10.0.0.2", hostname: undefined },
      ],
      isLoading: false,
      error: null,
    });
  });

  it("shows an empty state when there are no alerts", () => {
    mockUseAlertsHistory.mockReturnValue({
      data: { events: [], total: 0, page: 1, pageSize: 50 },
      isLoading: false,
      isPlaceholderData: false,
      error: null,
    });

    renderAlerts();

    expect(
      screen.getByText("No alerts match these filters."),
    ).toBeInTheDocument();
  });

  it("renders a row per change of state: raised, then cleared with how long it lasted", () => {
    mockUseAlertsHistory.mockReturnValue({
      data: {
        events: [
          {
            ts: "2026-07-22T11:30:00Z",
            mac: "aabbccddeeff",
            ip: "10.0.0.1",
            hostname: "bitaxe-office",
            type: "tempHigh",
            state: "cleared",
            raisedAt: "2026-07-22T10:00:00Z",
          },
          {
            ts: "2026-07-22T10:00:00Z",
            mac: "aabbccddeeff",
            ip: "10.0.0.1",
            hostname: "bitaxe-office",
            type: "tempHigh",
            state: "raised",
            value: 64.6,
            threshold: 62,
          },
        ],
        total: 2,
        page: 1,
        pageSize: 50,
      },
      isLoading: false,
      isPlaceholderData: false,
      error: null,
    });

    renderAlerts();

    const rows = screen.getAllByTestId("alert-row");
    expect(rows).toHaveLength(2);
    expect(
      within(rows[0]).getByText("bitaxe-office temperature back to normal"),
    ).toBeInTheDocument();
    expect(rows[0]).toHaveTextContent("lasted 1h 30m");
    expect(
      within(rows[1]).getByText("bitaxe-office temperature reached 65°C"),
    ).toBeInTheDocument();
    expect(rows[1]).not.toHaveTextContent("lasted");
  });

  it("shows the summary and pagination when there is more than one page", () => {
    mockUseAlertsHistory.mockReturnValue({
      data: {
        events: [
          {
            ts: "2026-07-22T10:00:00Z",
            mac: "aabbccddeeff",
            ip: "10.0.0.1",
            hostname: "bitaxe-office",
            type: "offline",
            state: "raised",
          },
        ],
        total: 120,
        page: 1,
        pageSize: 50,
      },
      isLoading: false,
      isPlaceholderData: false,
      error: null,
    });

    renderAlerts();

    expect(screen.getByText("1–50 of 120")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /next page/i }),
    ).toBeInTheDocument();
  });

  it("advances to the next page when its pagination button is clicked", async () => {
    mockUseAlertsHistory.mockReturnValue({
      data: {
        events: [
          {
            ts: "2026-07-22T10:00:00Z",
            mac: "aabbccddeeff",
            ip: "10.0.0.1",
            hostname: "bitaxe-office",
            type: "offline",
            state: "raised",
          },
        ],
        total: 120,
        page: 1,
        pageSize: 50,
      },
      isLoading: false,
      isPlaceholderData: false,
      error: null,
    });

    const user = userEvent.setup();
    renderAlerts();

    await user.click(screen.getByRole("button", { name: /next page/i }));

    await waitFor(() => {
      expect(mockUseAlertsHistory).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 }),
      );
    });
  });

  describe("shown/total count", () => {
    it("shows how many of the total are currently displayed", () => {
      mockUseAlertsHistory.mockReturnValue({
        data: {
          events: [
            {
              ts: "2026-07-22T09:00:00Z",
              mac: "mac1",
              ip: "10.0.0.1",
              hostname: "bitaxe-one",
              type: "offline",
              state: "raised",
            },
          ],
          total: 120,
          page: 1,
          pageSize: 50,
        },
        isLoading: false,
        isPlaceholderData: false,
        error: null,
      });

      renderAlerts();

      expect(screen.getByText("1 shown of 120")).toBeInTheDocument();
    });

    it("shows nothing when there are no alerts at all", () => {
      mockUseAlertsHistory.mockReturnValue({
        data: { events: [], total: 0, page: 1, pageSize: 50 },
        isLoading: false,
        isPlaceholderData: false,
        error: null,
      });

      renderAlerts();

      expect(screen.queryByText(/shown of/)).not.toBeInTheDocument();
    });
  });

  it("defaults to today's date (fast path, required by the API) with nothing to clear", () => {
    mockUseAlertsHistory.mockReturnValue({
      data: { events: [], total: 0, page: 1, pageSize: 50 },
      isLoading: false,
      isPlaceholderData: false,
      error: null,
    });

    renderAlerts();

    expect(mockUseAlertsHistory).toHaveBeenLastCalledWith(
      expect.objectContaining({
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      }),
    );
    // today is the no-filter default -- nothing to clear yet.
    expect(
      screen.queryByRole("button", { name: "Clear all" }),
    ).not.toBeInTheDocument();
  });

  it("resets to page 1 when another filter is chosen on top of the default date", async () => {
    mockUseAlertsHistory.mockReturnValue({
      data: { events: [], total: 0, page: 1, pageSize: 50 },
      isLoading: false,
      isPlaceholderData: false,
      error: null,
    });

    const user = userEvent.setup();
    renderAlerts();

    const typeSelect = screen.getByText("All alert types");
    await user.click(typeSelect);
    const listbox = await screen.findByRole("listbox");
    await user.click(within(listbox).getByText("Offline"));

    await waitFor(() => {
      expect(mockUseAlertsHistory).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1, type: "offline" }),
      );
    });
  });

  it("resets ip/type back to unset and date back to today when clear all is clicked", async () => {
    mockUseAlertsHistory.mockReturnValue({
      data: { events: [], total: 0, page: 1, pageSize: 50 },
      isLoading: false,
      isPlaceholderData: false,
      error: null,
    });

    const user = userEvent.setup();
    renderAlerts();

    const typeSelect = screen.getByText("All alert types");
    await user.click(typeSelect);
    const listbox = await screen.findByRole("listbox");
    await user.click(within(listbox).getByText("Offline"));

    await waitFor(() => {
      expect(mockUseAlertsHistory).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: "offline" }),
      );
    });
    expect(screen.getByRole("button", { name: "Clear all" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Clear all" }));

    const today = format(new Date(), "yyyy-MM-dd");
    await waitFor(() => {
      expect(mockUseAlertsHistory).toHaveBeenLastCalledWith(
        expect.objectContaining({
          date: today,
          ip: undefined,
          type: undefined,
        }),
      );
    });
    expect(
      screen.queryByRole("button", { name: "Clear all" }),
    ).not.toBeInTheDocument();
  });

  describe("date filter", () => {
    // MUI's DatePicker renders a segmented field (separate month/day/year
    // "spinbutton" cells), not a single text input -- typing the digits in
    // order (default en-US display order: month, day, year) fills each
    // segment in turn, same as a real user clicking in and typing.
    const typeDate = async (
      user: ReturnType<typeof userEvent.setup>,
      isoDate: string,
    ) => {
      const [yyyy, mm, dd] = isoDate.split("-");
      const segments = screen.getAllByRole("spinbutton");
      await user.click(segments[0]);
      await user.keyboard(`${mm}${dd}${yyyy}`);
    };

    it("passes the chosen date to the hook and resets to page 1", async () => {
      mockUseAlertsHistory.mockReturnValue({
        data: { events: [], total: 0, page: 1, pageSize: 50 },
        isLoading: false,
        isPlaceholderData: false,
        error: null,
      });

      const user = userEvent.setup();
      renderAlerts();

      await typeDate(user, "2026-07-14");

      await waitFor(() => {
        expect(mockUseAlertsHistory).toHaveBeenLastCalledWith(
          expect.objectContaining({ page: 1, date: "2026-07-14" }),
        );
      });
      expect(screen.getByRole("button", { name: "Clear all" })).toBeEnabled();
    });

    it("puts the date back to today (not unset -- the API requires a date) when clear all is clicked", async () => {
      mockUseAlertsHistory.mockReturnValue({
        data: { events: [], total: 0, page: 1, pageSize: 50 },
        isLoading: false,
        isPlaceholderData: false,
        error: null,
      });

      const user = userEvent.setup();
      renderAlerts();

      await typeDate(user, "2026-07-14");
      await waitFor(() => {
        expect(mockUseAlertsHistory).toHaveBeenLastCalledWith(
          expect.objectContaining({ date: "2026-07-14" }),
        );
      });

      await user.click(screen.getByRole("button", { name: "Clear all" }));

      const today = format(new Date(), "yyyy-MM-dd");
      await waitFor(() => {
        expect(mockUseAlertsHistory).toHaveBeenLastCalledWith(
          expect.objectContaining({ date: today }),
        );
      });
    });
  });
});
