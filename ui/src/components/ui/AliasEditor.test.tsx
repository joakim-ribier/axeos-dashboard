import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { MinerConfig } from "@/schemas/minerConfigSchema";

import { AliasEditor } from "./AliasEditor";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key} ${JSON.stringify(opts)}` : key,
  }),
}));

const baseMiner: MinerConfig = {
  ip: "192.168.1.65",
  hostname: "bitaxe-1",
  mac: "aabbccddeeff",
  model: "bitaxe",
  enabled: true,
  url: "stratum.example.com",
  port: 3333,
  user: "wallet.worker",
  fallbackUrl: "solo.example.com",
  fallbackPort: 4444,
  fallbackUser: "wallet.worker.fallback",
};

const aliasInput = () =>
  screen.getByLabelText("settingsPage.configured.alias.label");
const saveButton = () =>
  screen.getByRole("button", { name: "settingsPage.configured.alias.save" });

describe("AliasEditor", () => {
  it("starts empty with the hostname as placeholder when no alias is set", () => {
    render(<AliasEditor miner={baseMiner} saveMiners={vi.fn()} />);

    expect(aliasInput()).toHaveValue("");
    expect(aliasInput()).toHaveAttribute("placeholder", "bitaxe-1");
    expect(saveButton()).toBeDisabled();
  });

  it("pre-fills the field when an alias is already configured", () => {
    render(
      <AliasEditor
        miner={{ ...baseMiner, alias: "Garage rig" }}
        saveMiners={vi.fn()}
      />,
    );

    expect(aliasInput()).toHaveValue("Garage rig");
    expect(saveButton()).toBeDisabled();
  });

  it("saves the trimmed alias via saveMiners", async () => {
    const user = userEvent.setup();
    const saveMiners = vi.fn().mockResolvedValue([]);
    render(<AliasEditor miner={baseMiner} saveMiners={saveMiners} />);

    await user.type(aliasInput(), "  Garage rig  ");
    await user.click(saveButton());

    expect(saveMiners).toHaveBeenCalledWith([
      { ...baseMiner, alias: "Garage rig" },
    ]);
  });

  it("surfaces the server error when saveMiners rejects", async () => {
    const user = userEvent.setup();
    const saveMiners = vi.fn().mockRejectedValue(new Error("save failed"));
    render(<AliasEditor miner={baseMiner} saveMiners={saveMiners} />);

    await user.type(aliasInput(), "Garage rig");
    await user.click(saveButton());

    expect(await screen.findByText("save failed")).toBeInTheDocument();
  });

  it("hides Save in read-only mode", () => {
    render(<AliasEditor miner={baseMiner} saveMiners={vi.fn()} readOnly />);

    expect(
      screen.queryByRole("button", {
        name: "settingsPage.configured.alias.save",
      }),
    ).not.toBeInTheDocument();
    expect(aliasInput()).toBeDisabled();
  });
});
