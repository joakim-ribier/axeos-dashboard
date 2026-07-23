import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAppInfo } from "./useMiners";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, true);

function makeWrapper(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }

  return Wrapper;
}

describe("useAppInfo", () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
  });

  it("fetches /api/miners and returns buildSHA on the local route", async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { miners: [], buildSHA: "abc1234" },
    });

    const { result } = renderHook(() => useAppInfo(), {
      wrapper: makeWrapper("/"),
    });

    await waitFor(() => expect(result.current.buildSHA).toBe("abc1234"));
    expect(mockedAxios.get).toHaveBeenCalledWith("/api/miners");
  });

  it("derives the board-scoped path from the URL on a remote route", async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { miners: [], buildSHA: "def5678" },
    });

    const { result } = renderHook(() => useAppInfo(), {
      wrapper: makeWrapper("/demo"),
    });

    await waitFor(() => expect(result.current.buildSHA).toBe("def5678"));
    expect(mockedAxios.get).toHaveBeenCalledWith("/api/demo/miners");
  });

  it("returns undefined buildSHA when the request fails (no retry)", async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error("board not found"));

    const { result } = renderHook(() => useAppInfo(), {
      wrapper: makeWrapper("/unknown-board"),
    });

    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalled());
    expect(result.current.buildSHA).toBeUndefined();
    expect(result.current.versionStatus).toBe("unknown");
  });

  it("returns undefined buildSHA when the response has no buildSHA field", async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { miners: [] } });

    const { result } = renderHook(() => useAppInfo(), {
      wrapper: makeWrapper("/"),
    });

    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalled());
    expect(result.current.buildSHA).toBeUndefined();
  });

  it("returns the app version status and release URL from the response", async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        miners: [],
        buildSHA: "abc1234",
        appVersionStatus: "updateAvailable",
        appVersionReleaseURL:
          "https://github.com/joakim-ribier/axeos-dashboard/releases/tag/latest",
      },
    });

    const { result } = renderHook(() => useAppInfo(), {
      wrapper: makeWrapper("/"),
    });

    await waitFor(() =>
      expect(result.current.versionStatus).toBe("updateAvailable"),
    );
    expect(result.current.releaseUrl).toBe(
      "https://github.com/joakim-ribier/axeos-dashboard/releases/tag/latest",
    );
  });

  it("defaults versionStatus to unknown when the field is missing", async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { miners: [], buildSHA: "abc1234" },
    });

    const { result } = renderHook(() => useAppInfo(), {
      wrapper: makeWrapper("/"),
    });

    await waitFor(() => expect(result.current.buildSHA).toBe("abc1234"));
    expect(result.current.versionStatus).toBe("unknown");
    expect(result.current.releaseUrl).toBeNull();
  });
});
