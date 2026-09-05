import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AlertList } from "./AlertList";

describe("AlertList", () => {
  it("renders nothing when there are no items", () => {
    const { container } = render(<AlertList severity="warning" items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders one row per item, without a title when none is given", () => {
    render(
      <AlertList
        severity="warning"
        items={["First problem", "Second problem"]}
      />,
    );

    expect(screen.getByText("First problem")).toBeInTheDocument();
    expect(screen.getByText("Second problem")).toBeInTheDocument();
  });

  it("renders the optional title above the list", () => {
    render(
      <AlertList
        severity="warning"
        title="Heads up"
        items={["Something's off"]}
      />,
    );

    expect(screen.getByText("Heads up")).toBeInTheDocument();
    expect(screen.getByText("Something's off")).toBeInTheDocument();
  });

  it("supports rich content per item, not just plain strings", () => {
    render(
      <AlertList
        severity="error"
        items={[
          <span key="a">
            <strong>Bold label</strong> — details
          </span>,
        ]}
      />,
    );

    expect(screen.getByText("Bold label")).toBeInTheDocument();
    expect(screen.getByText(/details/)).toBeInTheDocument();
  });
});
