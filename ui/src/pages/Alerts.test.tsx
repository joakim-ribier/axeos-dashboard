import { I18nextProvider } from "react-i18next";
import { MemoryRouter, Route, Routes } from "react-router-dom";
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
  return render(
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
    </I18nextProvider>,
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
      data: { episodes: [], total: 0, page: 1, pageSize: 50 },
      isLoading: false,
      isPlaceholderData: false,
      error: null,
    });

    renderAlerts();

    expect(
      screen.getByText("No alerts match these filters."),
    ).toBeInTheDocument();
  });

  it("renders a row per episode, most recently active first", () => {
    mockUseAlertsHistory.mockReturnValue({
      data: {
        episodes: [
          {
            type: "tempHigh",
            minerIp: "10.0.0.1",
            minerMac: "aabbccddeeff",
            hostname: "bitaxe-office",
            firstSeen: "2026-07-22T10:00:00Z",
            lastSeen: "2026-07-22T10:00:00Z",
            occurrences: 1,
            peakValue: 65,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 50,
      },
      isLoading: false,
      isPlaceholderData: false,
      error: null,
    });

    renderAlerts();

    expect(
      screen.getByText("bitaxe-office temperature reached 65°C"),
    ).toBeInTheDocument();
  });

  it("shows the summary and pagination when there is more than one page", () => {
    mockUseAlertsHistory.mockReturnValue({
      data: {
        episodes: [
          {
            type: "offline",
            minerIp: "10.0.0.1",
            minerMac: "aabbccddeeff",
            hostname: "bitaxe-office",
            firstSeen: "2026-07-22T10:00:00Z",
            lastSeen: "2026-07-22T10:00:00Z",
            occurrences: 1,
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
        episodes: [
          {
            type: "offline",
            minerIp: "10.0.0.1",
            minerMac: "aabbccddeeff",
            hostname: "bitaxe-office",
            firstSeen: "2026-07-22T10:00:00Z",
            lastSeen: "2026-07-22T10:00:00Z",
            occurrences: 1,
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
          episodes: [
            {
              type: "offline",
              minerIp: "10.0.0.1",
              minerMac: "mac1",
              hostname: "bitaxe-one",
              firstSeen: "2026-07-22T09:00:00Z",
              lastSeen: "2026-07-22T09:00:00Z",
              occurrences: 1,
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
        data: { episodes: [], total: 0, page: 1, pageSize: 50 },
        isLoading: false,
        isPlaceholderData: false,
        error: null,
      });

      renderAlerts();

      expect(screen.queryByText(/shown of/)).not.toBeInTheDocument();
    });
  });

  it("defaults to today's date (fast path, required by the API) with the reset button disabled", () => {
    mockUseAlertsHistory.mockReturnValue({
      data: { episodes: [], total: 0, page: 1, pageSize: 50 },
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
    // today is the no-filter default -- nothing to reset yet.
    expect(
      screen.getByRole("button", { name: "Reset filters" }),
    ).toBeDisabled();
  });

  it("resets to page 1 when another filter is chosen on top of the default date", async () => {
    mockUseAlertsHistory.mockReturnValue({
      data: { episodes: [], total: 0, page: 1, pageSize: 50 },
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

  it("resets ip/type back to unset and date back to today when reset is clicked", async () => {
    mockUseAlertsHistory.mockReturnValue({
      data: { episodes: [], total: 0, page: 1, pageSize: 50 },
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
    expect(screen.getByRole("button", { name: "Reset filters" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Reset filters" }));

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
      screen.getByRole("button", { name: "Reset filters" }),
    ).toBeDisabled();
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
        data: { episodes: [], total: 0, page: 1, pageSize: 50 },
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
      expect(
        screen.getByRole("button", { name: "Reset filters" }),
      ).toBeEnabled();
    });

    it("puts the date back to today (not unset -- the API requires a date) when reset is clicked", async () => {
      mockUseAlertsHistory.mockReturnValue({
        data: { episodes: [], total: 0, page: 1, pageSize: 50 },
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

      await user.click(screen.getByRole("button", { name: "Reset filters" }));

      const today = format(new Date(), "yyyy-MM-dd");
      await waitFor(() => {
        expect(mockUseAlertsHistory).toHaveBeenLastCalledWith(
          expect.objectContaining({ date: today }),
        );
      });
    });
  });
});
