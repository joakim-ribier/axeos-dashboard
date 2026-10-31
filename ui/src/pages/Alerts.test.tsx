import { I18nextProvider } from "react-i18next";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { format, subDays } from "date-fns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ModeProvider } from "@/contexts/ModeContext";
import i18n from "@/i18n";
import { formatTimestamp } from "@/utils/format";

import { Alerts } from "./Alerts";

const mockUseAlertsHistory = vi.fn();
vi.mock("@/hooks/useAlertsHistory", () => ({
  useAlertsHistory: (...args: unknown[]) => mockUseAlertsHistory(...args),
}));

let activeAlerts: unknown[] = [];
vi.mock("@/hooks/useAlerts", () => ({
  useActiveAlerts: () => ({ data: activeAlerts }),
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
    activeAlerts = [];
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
    expect(rows[0]).toHaveTextContent(
      `${formatTimestamp("2026-07-22T10:00:00Z")} → ${formatTimestamp("2026-07-22T11:30:00Z")} · lasted 1h 30m`,
    );
    expect(
      within(rows[1]).getByText("bitaxe-office temperature reached 65°C"),
    ).toBeInTheDocument();
    expect(rows[1]).not.toHaveTextContent("lasted");
  });

  describe("in progress", () => {
    const noHistory = () =>
      mockUseAlertsHistory.mockReturnValue({
        data: { events: [], total: 0, page: 1, pageSize: 50 },
        isLoading: false,
        isPlaceholderData: false,
        error: null,
      });
    const threeDaysAgo = new Date(
      Date.now() - (3 * 24 + 2) * 3600_000,
    ).toISOString();

    beforeEach(() => {
      activeAlerts = [
        {
          ts: threeDaysAgo,
          mac: "aabbccddeeff",
          ip: "10.0.0.1",
          hostname: "bitaxe-office",
          type: "firmwareUpdate",
          state: "raised",
          message: "v2.15.4",
        },
        {
          ts: threeDaysAgo,
          mac: "112233445566",
          ip: "10.0.0.2",
          hostname: "bitaxe-garage",
          type: "fanHigh",
          state: "raised",
          value: 84.4,
        },
      ];
    });

    it("lists what's still in progress on top, whatever the day, and since when", () => {
      noHistory();
      renderAlerts();

      expect(screen.getByText("In progress (2)")).toBeInTheDocument();
      const rows = screen.getAllByTestId("ongoing-alert-row");
      expect(rows).toHaveLength(2);
      expect(
        within(rows[0]).getByText("bitaxe-office: firmware v2.15.4 available"),
      ).toBeInTheDocument();
      expect(rows[0]).toHaveTextContent(
        `${formatTimestamp(threeDaysAgo)} · for 3j 2h 0m`,
      );
      expect(
        within(rows[1]).getByText("bitaxe-garage fan speed reached 84%"),
      ).toBeInTheDocument();
      // The day's own history still follows.
      expect(screen.getByText("History of the day picked")).toBeInTheDocument();
      expect(
        screen.getByText("No alerts match these filters."),
      ).toBeInTheDocument();
    });

    it("shows the miner's current reading, and the one it started at", () => {
      mockUseMiners.mockReturnValue({
        data: [
          { ip: "10.0.0.1", hostname: "bitaxe-office" },
          { ip: "10.0.0.2", hostname: "bitaxe-garage", fanspeed: 99, temp: 60 },
        ],
        isLoading: false,
        error: null,
      });
      noHistory();
      renderAlerts();

      const fan = screen.getAllByTestId("ongoing-alert-row")[1];
      expect(
        within(fan).getByText("bitaxe-garage fan speed reached 99%"),
      ).toBeInTheDocument();
      expect(fan).toHaveTextContent("84% at the start");
      // Nothing measured for a firmware update: as raised.
      expect(
        screen.getAllByTestId("ongoing-alert-row")[0],
      ).not.toHaveTextContent("at the start");
    });

    it("follows the miner and type filters", async () => {
      noHistory();
      const user = userEvent.setup();
      renderAlerts();

      await user.click(screen.getByText("All alert types"));
      const listbox = await screen.findByRole("listbox");
      await user.click(within(listbox).getByText("Fan speed"));

      expect(await screen.findByText("In progress (1)")).toBeInTheDocument();
      expect(screen.getAllByTestId("ongoing-alert-row")).toHaveLength(1);
    });

    it("shows no section when nothing is in progress", () => {
      activeAlerts = [];
      noHistory();
      renderAlerts();

      expect(screen.queryByText(/In progress/)).not.toBeInTheDocument();
      expect(
        screen.queryByText("History of the day picked"),
      ).not.toBeInTheDocument();
    });
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

  describe("day buttons", () => {
    const iso = (d: Date) => format(d, "yyyy-MM-dd");
    const lastDate = () =>
      (mockUseAlertsHistory.mock.lastCall?.[0] as { date: string }).date;

    beforeEach(() => {
      mockUseAlertsHistory.mockReturnValue({
        data: { events: [], total: 0, page: 1, pageSize: 50 },
        isLoading: false,
        isPlaceholderData: false,
        error: null,
      });
    });

    it("steps back a day, then forward, and back to today -- never past it", async () => {
      const user = userEvent.setup();
      renderAlerts();
      const previous = screen.getByRole("button", { name: "Previous day" });
      const next = screen.getByRole("button", { name: "Next day" });
      const today = screen.getByRole("button", { name: "Today" });

      expect(next).toBeDisabled();
      expect(today).toBeDisabled();

      await user.click(previous);
      await user.click(previous);
      await waitFor(() => expect(lastDate()).toBe(iso(subDays(new Date(), 2))));
      expect(next).toBeEnabled();

      await user.click(next);
      await waitFor(() => expect(lastDate()).toBe(iso(subDays(new Date(), 1))));

      await user.click(today);
      await waitFor(() => expect(lastDate()).toBe(iso(new Date())));
      expect(next).toBeDisabled();
    });

    it("goes back to page 1", async () => {
      mockUseAlertsHistory.mockReturnValue({
        data: {
          events: [
            {
              ts: "2026-07-22T10:00:00Z",
              mac: "aabbccddeeff",
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
      await user.click(screen.getByRole("button", { name: "Previous day" }));

      await waitFor(() =>
        expect(mockUseAlertsHistory).toHaveBeenLastCalledWith(
          expect.objectContaining({
            page: 1,
            date: iso(subDays(new Date(), 1)),
          }),
        ),
      );
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

      it("keeps them in sight, the other filters folded", async () => {
        const user = userEvent.setup();
        renderAlerts();

        expect(screen.queryByText("All alert types")).not.toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Previous day" }));

        await waitFor(() =>
          expect(lastDate()).toBe(iso(subDays(new Date(), 1))),
        );
        // The day shown, as a chip.
        expect(
          screen.getByText(`Date: ${format(subDays(new Date(), 1), "P")}`),
        ).toBeInTheDocument();
      });
    });
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
