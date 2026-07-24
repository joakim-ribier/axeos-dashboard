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

// useAppInfo fires two independent requests: GET /api/info (build/version
// status, hashboard link -- never board-gated, see internal/handler/info.go)
// and GET /api/{boardId}/miners (or /api/miners locally, for isPublic only).
// Route each mock by URL so both resolve independently, matching what
// actually happens in the app.
function mockGetByUrl(responses: Record<string, unknown>) {
  mockedAxios.get.mockImplementation((url: unknown) => {
    const key = url as string;
    if (key in responses) return Promise.resolve({ data: responses[key] });
    return Promise.reject(new Error(`unexpected URL ${key}`));
  });
}

describe("useAppInfo", () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
  });

  it("fetches build info from /api/info regardless of route", async () => {
    mockGetByUrl({
      "/api/info": { buildSHA: "abc1234" },
      "/api/miners": { miners: [] },
    });

    const { result } = renderHook(() => useAppInfo(), {
      wrapper: makeWrapper("/"),
    });

    await waitFor(() => expect(result.current.buildSHA).toBe("abc1234"));
    expect(mockedAxios.get).toHaveBeenCalledWith("/api/info");
  });

  it("still derives the board-scoped miners path from the URL, for isPublic", async () => {
    mockGetByUrl({
      "/api/info": { buildSHA: "def5678" },
      "/api/demo/miners": { miners: [], boardPublic: true },
    });

    const { result } = renderHook(() => useAppInfo(), {
      wrapper: makeWrapper("/demo"),
    });

    await waitFor(() => expect(result.current.buildSHA).toBe("def5678"));
    expect(mockedAxios.get).toHaveBeenCalledWith("/api/demo/miners");
    await waitFor(() => expect(result.current.isPublic).toBe(true));
  });

  it("keeps buildSHA/version available even when the board's own miners call fails (private, no session)", async () => {
    mockedAxios.get.mockImplementation((url: unknown) => {
      if (url === "/api/info") {
        return Promise.resolve({ data: { buildSHA: "abc1234" } });
      }
      return Promise.reject(new Error("board is private"));
    });

    const { result } = renderHook(() => useAppInfo(), {
      wrapper: makeWrapper("/private-board"),
    });

    await waitFor(() => expect(result.current.buildSHA).toBe("abc1234"));
    expect(result.current.isPublic).toBe(false);
  });

  it("returns undefined buildSHA when /api/info itself fails", async () => {
    mockedAxios.get.mockImplementation((url: unknown) => {
      if (url === "/api/info") {
        return Promise.reject(new Error("server error"));
      }
      return Promise.resolve({ data: { miners: [] } });
    });

    const { result } = renderHook(() => useAppInfo(), {
      wrapper: makeWrapper("/"),
    });

    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalled());
    expect(result.current.buildSHA).toBeUndefined();
    expect(result.current.versionStatus).toBe("unknown");
  });

  it("returns undefined buildSHA when the /api/info response has no buildSHA field", async () => {
    mockGetByUrl({
      "/api/info": {},
      "/api/miners": { miners: [] },
    });

    const { result } = renderHook(() => useAppInfo(), {
      wrapper: makeWrapper("/"),
    });

    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalled());
    expect(result.current.buildSHA).toBeUndefined();
  });

  it("returns the app version status and release URL from /api/info", async () => {
    mockGetByUrl({
      "/api/info": {
        buildSHA: "abc1234",
        appVersionStatus: "updateAvailable",
        appVersionReleaseURL:
          "https://github.com/joakim-ribier/axeos-dashboard/releases/tag/latest",
      },
      "/api/miners": { miners: [] },
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
    mockGetByUrl({
      "/api/info": { buildSHA: "abc1234" },
      "/api/miners": { miners: [] },
    });

    const { result } = renderHook(() => useAppInfo(), {
      wrapper: makeWrapper("/"),
    });

    await waitFor(() => expect(result.current.buildSHA).toBe("abc1234"));
    expect(result.current.versionStatus).toBe("unknown");
    expect(result.current.releaseUrl).toBeNull();
  });

  it("hashboardUrl comes from /api/info, not the miners response", async () => {
    mockGetByUrl({
      "/api/info": {
        buildSHA: "abc1234",
        hashboardURL: "https://hashboard.live",
      },
      "/api/miners": { miners: [] },
    });

    const { result } = renderHook(() => useAppInfo(), {
      wrapper: makeWrapper("/"),
    });

    await waitFor(() =>
      expect(result.current.hashboardUrl).toBe("https://hashboard.live"),
    );
  });
});
