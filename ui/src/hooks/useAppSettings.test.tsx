import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import axios from "axios";
import { describe, expect, it, vi } from "vitest";

import { ModeProvider } from "@/contexts/ModeContext";
import type { AppSettings } from "@/schemas/appSettingsSchema";

import { useAppSettings } from "./useAppSettings";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, true);

const settings: AppSettings = {
  electricity: { ratePerKwh: 0.2, devices: [{ name: "Fan", power: 30 }] },
  pools: { dashboards: {} },
  remote: { pushURL: "", apiKey: "" },
  firmware: { repos: {} },
  defaults: { pools: { dashboards: {} }, firmware: { repos: {} } },
  readOnly: {
    feederInterval: "2m0s",
    healthCheckInterval: "1m0s",
    firmwareCacheTTL: "24h0m0s",
    remotePushMinersConfig: {},
    remotePushSettingsConfig: {},
  },
};

describe("useAppSettings", () => {
  it("refreshes the dashboard's miners data after a save, which echoes the devices", async () => {
    mockedAxios.get.mockResolvedValue({ data: settings });
    mockedAxios.post.mockResolvedValue({ data: settings });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route
              path="/*"
              element={<ModeProvider mode="local">{children}</ModeProvider>}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const { result } = renderHook(() => useAppSettings(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());

    await act(async () => {
      await result.current.saveSettings(settings);
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["miners"] });
  });
});
