import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ModeProvider } from "@/contexts/ModeContext";
import { SearchProvider } from "@/contexts/SearchContext";
import i18n from "@/i18n";

import { Home } from "./Home";

vi.mock("@/api/info", () => ({
  fetchInfo: () => Promise.resolve({ remote: false }),
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

// The MinerCard grid isn't what this page's own pool-selector logic is
// about, and satisfying its full MinerInfo prop shape would just add noise.
vi.mock("@/components/ui/MinerCard/MinerCard", () => ({
  MinerCard: ({ minerInfo }: { minerInfo?: { hostname?: string } }) => (
    <div>{minerInfo?.hostname}</div>
  ),
}));

function renderHome() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/"]}>
          <ModeProvider mode="local">
            <SearchProvider>
              <Home />
            </SearchProvider>
          </ModeProvider>
        </MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

describe("Home page", () => {
  beforeEach(() => {
    mockUseAppInfo.mockReturnValue({ hashboardUrl: null });
  });

  it("shows the pool name directly when every miner is on the same pool", () => {
    mockUseMiners.mockReturnValue({
      data: [
        {
          hostname: "bitaxe-1",
          stratumURL: "stratum+tcp://pool.example.com:3333",
          isUsingFallbackStratum: 0,
          hashRateTHs: 1,
        },
        {
          hostname: "bitaxe-2",
          stratumURL: "stratum+tcp://pool.example.com:3333",
          isUsingFallbackStratum: 0,
          hashRateTHs: 2,
        },
      ],
      isLoading: false,
      error: null,
    });

    renderHome();

    expect(
      screen.getByRole("button", { name: /pool\.example\.com/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText("All")).not.toBeInTheDocument();
  });

  it("hides the pool selector when there is no miner data", () => {
    mockUseMiners.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    renderHome();

    expect(screen.queryByText("All")).not.toBeInTheDocument();
  });
});
