import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RefreshSettingsProvider } from "@/contexts/RefreshSettingsContext";

import { useActiveAlerts, useAlerts, useMarkAlertsSeen } from "./useAlerts";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, true);

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <RefreshSettingsProvider>{children}</RefreshSettingsProvider>
      </QueryClientProvider>
    );
  }

  return Wrapper;
}

describe("useAlerts", () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
    mockedAxios.post.mockReset();
    mockedAxios.get.mockResolvedValue({
      data: {
        events: [
          {
            ts: "2026-10-28T11:00:00Z",
            mac: "aabbccddeeff",
            type: "offline",
            state: "raised",
          },
        ],
      },
    });
  });

  it("fetches the events from /api/miners/alerts", async () => {
    const { result } = renderHook(() => useAlerts(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(mockedAxios.get).toHaveBeenCalledWith("/api/miners/alerts");
    expect(result.current.data?.events[0].type).toBe("offline");
    expect(result.current.data?.seenAt).toBeUndefined();
  });

  it("marks them read on the server and keeps the seenAt it answers", async () => {
    mockedAxios.post.mockResolvedValue({
      data: { seenAt: "2026-10-28T11:00:00Z" },
    });
    const { result } = renderHook(
      () => ({ alerts: useAlerts(), markSeen: useMarkAlertsSeen() }),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.alerts.data).toBeDefined());

    act(() =>
      result.current.markSeen.mutate(Date.parse("2026-10-28T11:00:00Z")),
    );

    await waitFor(() =>
      expect(result.current.alerts.data?.seenAt).toBe("2026-10-28T11:00:00Z"),
    );
    expect(mockedAxios.post).toHaveBeenCalledWith("/api/miners/alerts/seen", {
      seenAt: "2026-10-28T11:00:00.000Z",
    });
    expect(result.current.alerts.data?.events).toHaveLength(1);
  });

  it("fetches the alerts in progress from /api/miners/alerts/active", async () => {
    mockedAxios.get.mockResolvedValue({
      data: [
        {
          ts: "2026-10-25T11:00:00Z",
          mac: "aabbccddeeff",
          type: "firmwareUpdate",
          state: "raised",
          message: "v2.15.4",
        },
      ],
    });
    const { result } = renderHook(() => useActiveAlerts(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(mockedAxios.get).toHaveBeenCalledWith("/api/miners/alerts/active");
    expect(result.current.data?.[0].message).toBe("v2.15.4");
  });
});
