import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "./ConfirmDialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("ConfirmDialog", () => {
  it("renders nothing meaningful when closed", () => {
    render(
      <ConfirmDialog
        open={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Restart miner?"
      />,
    );

    expect(screen.queryByText("Restart miner?")).not.toBeInTheDocument();
  });

  it("renders the title and description when open", () => {
    render(
      <ConfirmDialog
        open
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Restart miner?"
        description="This will restart 10.0.0.1"
      />,
    );

    expect(screen.getByText("Restart miner?")).toBeInTheDocument();
    expect(screen.getByText("This will restart 10.0.0.1")).toBeInTheDocument();
  });

  it("falls back to the translated confirm label when actionLabel is not provided", () => {
    render(
      <ConfirmDialog open onClose={vi.fn()} onConfirm={vi.fn()} title="t" />,
    );

    expect(
      screen.getByText("dialog.actions.confirm.label"),
    ).toBeInTheDocument();
  });

  it("uses the provided actionLabel over the translated default", () => {
    render(
      <ConfirmDialog
        open
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="t"
        actionLabel="Restart now"
      />,
    );

    expect(screen.getByText("Restart now")).toBeInTheDocument();
    expect(
      screen.queryByText("dialog.actions.confirm.label"),
    ).not.toBeInTheDocument();
  });

  it("calls onConfirm when the confirm action is clicked", () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onClose={vi.fn()}
        onConfirm={onConfirm}
        title="t"
        actionLabel="Confirm"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the cancel action is clicked", () => {
    const onClose = vi.fn();
    render(
      <ConfirmDialog open onClose={onClose} onConfirm={vi.fn()} title="t" />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "dialog.actions.cancel.label" }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("reaches Cancel first from the keyboard, so Enter can't confirm by accident", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog open onClose={onClose} onConfirm={onConfirm} title="t" />,
    );

    await user.tab();
    expect(
      screen.getByRole("button", { name: "dialog.actions.cancel.label" }),
    ).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
