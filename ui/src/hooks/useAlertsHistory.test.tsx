import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAlertsHistory } from "./useAlertsHistory";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, true);

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  return Wrapper;
}

describe("useAlertsHistory", () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
    mockedAxios.get.mockResolvedValue({
      data: { events: [], total: 0, page: 1, pageSize: 50 },
    });
  });

  it("fetches from /api/miners/alerts/history", async () => {
    const { result } = renderHook(
      () => useAlertsHistory({ page: 1, pageSize: 50, date: "2026-07-14" }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(mockedAxios.get).toHaveBeenCalledWith(
      "/api/miners/alerts/history",
      expect.objectContaining({
        params: expect.objectContaining({ page: 1, pageSize: 50 }),
      }),
    );
  });

  it("passes ip/type filters through as query params", async () => {
    const { result } = renderHook(
      () =>
        useAlertsHistory({
          page: 2,
          pageSize: 50,
          ip: "10.0.0.1",
          type: "offline",
          date: "2026-07-14",
        }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(mockedAxios.get).toHaveBeenCalledWith(
      "/api/miners/alerts/history",
      expect.objectContaining({
        params: expect.objectContaining({
          page: 2,
          pageSize: 50,
          ip: "10.0.0.1",
          type: "offline",
        }),
      }),
    );
  });

  it("omits ip/type params entirely when unset", async () => {
    renderHook(
      () => useAlertsHistory({ page: 1, pageSize: 50, date: "2026-07-14" }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalled());
    const params = mockedAxios.get.mock.calls[0][1]?.params;
    expect(params.ip).toBeUndefined();
    expect(params.type).toBeUndefined();
  });

  it("always passes the date filter through as a query param -- the API requires it", async () => {
    renderHook(
      () => useAlertsHistory({ page: 1, pageSize: 50, date: "2026-07-14" }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalled());
    expect(mockedAxios.get).toHaveBeenCalledWith(
      "/api/miners/alerts/history",
      expect.objectContaining({
        params: expect.objectContaining({ date: "2026-07-14" }),
      }),
    );
  });

  it("returns the parsed events/total/page/pageSize", async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        events: [
          {
            ts: "2026-07-14T10:00:00Z",
            mac: "aabbccddeeff",
            type: "tempHigh",
            state: "cleared",
            raisedAt: "2026-07-14T09:00:00Z",
          },
        ],
        total: 1,
        page: 1,
        pageSize: 50,
      },
    });

    const { result } = renderHook(
      () => useAlertsHistory({ page: 1, pageSize: 50, date: "2026-07-14" }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.data?.total).toBe(1));
    expect(result.current.data?.events[0]).toMatchObject({
      state: "cleared",
      raisedAt: "2026-07-14T09:00:00Z",
    });
  });
});
