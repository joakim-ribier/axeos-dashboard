import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useRemoteBoard } from "./useRemoteBoard";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, true);

const mockUseMode = vi.fn();
vi.mock("@/contexts/ModeContext", () => ({
  useMode: () => mockUseMode(),
}));

const mockUseServicesStatus = vi.fn();
vi.mock("@/hooks/useServicesStatus", () => ({
  useServicesStatus: () => mockUseServicesStatus(),
}));

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

const status = (remotePushConfigured: boolean) => ({
  data: { remotePushConfigured },
});

describe("useRemoteBoard", () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
    mockedAxios.get.mockResolvedValue({
      data: { boardId: "abc", public: true },
    });
    mockUseMode.mockReturnValue({ mode: "local" });
  });

  it("asks for the board once remote push is configured", async () => {
    mockUseServicesStatus.mockReturnValue(status(true));

    const { result } = renderHook(() => useRemoteBoard(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.data?.boardId).toBe("abc"));
    expect(mockedAxios.get).toHaveBeenCalledWith("/api/remote/board");
  });

  it("doesn't ask when remote push isn't configured", () => {
    mockUseServicesStatus.mockReturnValue(status(false));

    const { result } = renderHook(() => useRemoteBoard(), {
      wrapper: makeWrapper(),
    });

    expect(result.current.data).toBeUndefined();
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it("doesn't ask before the status has answered", () => {
    mockUseServicesStatus.mockReturnValue({ data: undefined });

    renderHook(() => useRemoteBoard(), { wrapper: makeWrapper() });

    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it("drops the board's link once remote push is turned off", async () => {
    mockUseServicesStatus.mockReturnValue(status(true));
    const { result, rerender } = renderHook(() => useRemoteBoard(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.data?.boardId).toBe("abc"));

    mockUseServicesStatus.mockReturnValue(status(false));
    rerender();

    expect(result.current.data).toBeUndefined();
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });

  it("never asks on a board", () => {
    mockUseMode.mockReturnValue({ mode: "remote" });
    mockUseServicesStatus.mockReturnValue(status(true));

    renderHook(() => useRemoteBoard(), { wrapper: makeWrapper() });

    expect(mockedAxios.get).not.toHaveBeenCalled();
  });
});
