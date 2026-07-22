import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useBuildSHA } from "./useMiners";

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

describe("useBuildSHA", () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
  });

  it("fetches /api/miners and returns buildSHA on the local route", async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { miners: [], buildSHA: "abc1234" },
    });

    const { result } = renderHook(() => useBuildSHA(), {
      wrapper: makeWrapper("/"),
    });

    await waitFor(() => expect(result.current).toBe("abc1234"));
    expect(mockedAxios.get).toHaveBeenCalledWith("/api/miners");
  });

  it("derives the board-scoped path from the URL on a remote route", async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { miners: [], buildSHA: "def5678" },
    });

    const { result } = renderHook(() => useBuildSHA(), {
      wrapper: makeWrapper("/demo"),
    });

    await waitFor(() => expect(result.current).toBe("def5678"));
    expect(mockedAxios.get).toHaveBeenCalledWith("/api/demo/miners");
  });

  it("returns undefined when the request fails (no retry)", async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error("board not found"));

    const { result } = renderHook(() => useBuildSHA(), {
      wrapper: makeWrapper("/unknown-board"),
    });

    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalled());
    expect(result.current).toBeUndefined();
  });

  it("returns undefined when the response has no buildSHA field", async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { miners: [] } });

    const { result } = renderHook(() => useBuildSHA(), {
      wrapper: makeWrapper("/"),
    });

    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalled());
    expect(result.current).toBeUndefined();
  });
});
