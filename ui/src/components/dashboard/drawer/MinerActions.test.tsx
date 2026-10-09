import { I18nextProvider } from "react-i18next";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/i18n";
import { makeMiner } from "@/test/miner";
import { DEFAULT_UI_FEATURES, type UIFeatures } from "@/types/uiFeatures";

import { MinerActions } from "./MinerActions";

let ui: UIFeatures = DEFAULT_UI_FEATURES;
vi.mock("@/hooks/useMiners", () => ({
  useUiFeatures: () => ({ ui, isLoading: false }),
}));

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
      <MinerActions miner={makeMiner({ ip: "10.0.0.7", ...overrides })} />
    </I18nextProvider>,
  );

describe("MinerActions", () => {
  beforeEach(() => {
    ui = DEFAULT_UI_FEATURES;
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

  it("keeps a read-only action visible but disabled", () => {
    ui = {
      ...DEFAULT_UI_FEATURES,
      action: { minerRestart: "readonly", minerPoolSwitch: "enabled" },
    };
    renderActions();

    expect(screen.getByRole("button", { name: "Restart" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Switch" })).toBeEnabled();
  });

  it("shows nothing when both actions are hidden", () => {
    ui = {
      ...DEFAULT_UI_FEATURES,
      action: { minerRestart: "hidden", minerPoolSwitch: "hidden" },
    };
    const { container } = renderActions();

    expect(container).toBeEmptyDOMElement();
  });
});
