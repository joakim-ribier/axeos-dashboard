import { act, renderHook, waitFor } from "@testing-library/react";
import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useMinerAction } from "./useMinerActions";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, true);

describe("useMinerAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("restartMiner posts to the restart endpoint and toggles isExecuting", async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: {} });
    const { result } = renderHook(() => useMinerAction());

    expect(result.current.isExecuting).toBe(false);

    await act(async () => {
      await result.current.restartMiner("10.0.0.1");
    });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      "/api/miners/10.0.0.1/restart",
    );
    expect(result.current.isExecuting).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("restartMiner records an error message on failure", async () => {
    mockedAxios.post.mockRejectedValueOnce(new Error("network down"));
    const { result } = renderHook(() => useMinerAction());

    await act(async () => {
      await result.current.restartMiner("10.0.0.1");
    });

    await waitFor(() => expect(result.current.error).toBe("network down"));
    expect(result.current.isExecuting).toBe(false);
  });

  it("switchPool puts to the pool enable endpoint with the miner as a query param", async () => {
    mockedAxios.put.mockResolvedValueOnce({ data: {} });
    const { result } = renderHook(() => useMinerAction());

    await act(async () => {
      await result.current.switchPool("10.0.0.1", "fallback");
    });

    expect(mockedAxios.put).toHaveBeenCalledWith(
      "/api/miners/pool/fallback/enable",
      null,
      { params: { miner: "10.0.0.1" } },
    );
    expect(result.current.error).toBeNull();
  });

  it("switchPool records a generic error message for non-Error rejections", async () => {
    mockedAxios.put.mockRejectedValueOnce("boom");
    const { result } = renderHook(() => useMinerAction());

    await act(async () => {
      await result.current.switchPool("10.0.0.1", "primary");
    });

    expect(result.current.error).toBe("Request failed");
  });

  it("clearError resets the error state", async () => {
    mockedAxios.post.mockRejectedValueOnce(new Error("network down"));
    const { result } = renderHook(() => useMinerAction());

    await act(async () => {
      await result.current.restartMiner("10.0.0.1");
    });
    expect(result.current.error).toBe("network down");

    act(() => {
      result.current.clearError();
    });
    expect(result.current.error).toBeNull();
  });
});
