import { I18nextProvider } from "react-i18next";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";

import { ModeProvider } from "@/contexts/ModeContext";
import i18n from "@/i18n";
import { makeMiner } from "@/test/miner";
import { formatTimeOnly } from "@/utils/format";

import { MinerActions } from "./MinerActions";

const restartMiner = vi.fn();
const switchPool = vi.fn();
vi.mock("@/hooks/useMinerActions", () => ({
  useMinerAction: () => ({
    restartMiner,
    switchPool,
    isExecuting: false,
    error: null,
    clearError: () => {},
  }),
}));

const renderActions = (overrides = {}) =>
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <ModeProvider mode="local">
            <MinerActions miner={makeMiner({ ip: "10.0.0.7", ...overrides })} />
          </ModeProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );

describe("MinerActions", () => {
  beforeEach(() => {
    restartMiner.mockClear();
    switchPool.mockClear();
  });

  it("restarts the miner only once confirmed", async () => {
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByRole("button", { name: "Restart" }));
    expect(restartMiner).not.toHaveBeenCalled();

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Restart Miner");
    await user.click(within(dialog).getByRole("button", { name: "Restart" }));

    expect(restartMiner).toHaveBeenCalledWith("10.0.0.7");
    expect(switchPool).not.toHaveBeenCalled();
  });

  it("switches to the pool the miner isn't on", async () => {
    const user = userEvent.setup();
    renderActions({ isUsingFallbackStratum: 1 });

    await user.click(screen.getByRole("button", { name: "Switch" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Switch",
      }),
    );

    expect(switchPool).toHaveBeenCalledWith("10.0.0.7", "primary");
  });

  it("does nothing when the confirmation is cancelled", async () => {
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByRole("button", { name: "Restart" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(restartMiner).not.toHaveBeenCalled();
  });

  it("always offers both actions on a local dashboard", () => {
    renderActions();

    expect(screen.getByRole("button", { name: "Restart" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Switch" })).toBeEnabled();
  });
});

describe("MinerActions on a board", () => {
  const actionPath = "/api/board00000000001/miners/fd00::1/actions";
  let post: MockInstance<typeof axios.post>;

  const renderOnBoard = (overrides = {}, client = new QueryClient()) =>
    render(
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={["/board00000000001"]}>
            <Routes>
              <Route
                path="/:boardId"
                element={
                  <ModeProvider mode="remote">
                    <MinerActions
                      miner={makeMiner({
                        ip: "fd00::1",
                        hostname: "salon",
                        ...overrides,
                      })}
                    />
                  </ModeProvider>
                }
              />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </I18nextProvider>,
    );

  const allActions = ["restart", "switch_primary", "switch_fallback"];

  beforeEach(() => {
    restartMiner.mockClear();
    switchPool.mockClear();
    post = vi.spyOn(axios, "post").mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("shows nothing when the dashboard allows nothing", () => {
    renderOnBoard({ remoteActions: [] });

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows nothing when the miner carries no actions", () => {
    renderOnBoard();

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows only what the dashboard allows", () => {
    renderOnBoard({ remoteActions: ["restart"] });

    expect(screen.getByRole("button", { name: "Restart" })).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Switch" }),
    ).not.toBeInTheDocument();
  });

  it("offers a switch only towards the slot the dashboard allows", () => {
    renderOnBoard({
      remoteActions: ["switch_primary"],
      isUsingFallbackStratum: 0,
    });

    expect(
      screen.queryByRole("button", { name: "Switch" }),
    ).not.toBeInTheDocument();
  });

  it("asks for a restart through its own API, once confirmed", async () => {
    const user = userEvent.setup();
    renderOnBoard({ remoteActions: allActions });

    await user.click(screen.getByRole("button", { name: "Restart" }));
    expect(post).not.toHaveBeenCalled();

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("salon");
    expect(dialog).toHaveTextContent(
      "Your dashboard will do it within a minute.",
    );
    await user.click(within(dialog).getByRole("button", { name: "Restart" }));

    expect(post).toHaveBeenCalledWith(actionPath, { action: "restart" });
    expect(restartMiner).not.toHaveBeenCalled();
  });

  it.each([
    [0, "switch_fallback"],
    [1, "switch_primary"],
  ])(
    "asks for the slot the miner isn't on (using fallback: %i)",
    async (isUsingFallbackStratum, action) => {
      const user = userEvent.setup();
      renderOnBoard({ remoteActions: allActions, isUsingFallbackStratum });

      await user.click(screen.getByRole("button", { name: "Switch" }));
      await user.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Switch",
        }),
      );

      expect(post).toHaveBeenCalledWith(actionPath, { action });
      expect(switchPool).not.toHaveBeenCalled();
    },
  );

  it("asks nothing when the confirmation is cancelled", async () => {
    const user = userEvent.setup();
    renderOnBoard({ remoteActions: allActions });

    await user.click(screen.getByRole("button", { name: "Restart" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(post).not.toHaveBeenCalled();
  });

  it("greys the buttons out while a request is pending", () => {
    renderOnBoard({
      remoteActions: allActions,
      remoteAction: {
        action: "switch_primary",
        status: "pending",
        createdAt: "2026-11-05T08:00:00Z",
      },
    });

    expect(
      screen.getByText("Switch to the primary pool — request in progress"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restart" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Switch" })).toBeDisabled();
  });

  it("says when the dashboard picked the request up, still greyed out", () => {
    const polledAt = "2026-11-05T08:01:00Z";
    renderOnBoard({
      remoteActions: allActions,
      remoteAction: {
        action: "restart",
        status: "polled",
        createdAt: "2026-11-05T08:00:00Z",
        polledAt,
      },
    });

    expect(
      screen.getByText(
        `Restart — picked up by your dashboard at ${formatTimeOnly(polledAt)}`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restart" })).toBeDisabled();
  });

  it("shows a refused request in the snackbar", async () => {
    post.mockRejectedValue(new Error("too many actions this hour"));
    const user = userEvent.setup();
    renderOnBoard({ remoteActions: allActions });

    await user.click(screen.getByRole("button", { name: "Restart" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Restart",
      }),
    );

    expect(
      await screen.findByText("too many actions this hour"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restart" })).toBeEnabled();
  });

  it("reads the miners again while a request is in progress, only then", () => {
    vi.useFakeTimers();
    const minersKey = { queryKey: ["miners", "/api/board00000000001/miners"] };

    const idle = new QueryClient();
    const idleSpy = vi.spyOn(idle, "invalidateQueries");
    const { unmount } = renderOnBoard({ remoteActions: allActions }, idle);
    vi.advanceTimersByTime(30_000);
    expect(idleSpy).not.toHaveBeenCalled();
    unmount();

    const busy = new QueryClient();
    const busySpy = vi.spyOn(busy, "invalidateQueries");
    renderOnBoard(
      {
        remoteActions: allActions,
        remoteAction: {
          action: "restart",
          status: "pending",
          createdAt: "2026-11-05T08:00:00Z",
        },
      },
      busy,
    );
    vi.advanceTimersByTime(10_000);
    expect(busySpy).toHaveBeenCalledWith(minersKey);
  });
});
