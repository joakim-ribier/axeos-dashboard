import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PageTitleSlotContext } from "@/components/layout/pageTitleSlot";

import { PageHeader } from "./PageHeader";

const renderInSlot = (ui: React.ReactNode) => {
  const slot = document.createElement("div");
  document.body.appendChild(slot);
  render(
    <PageTitleSlotContext.Provider value={slot}>
      {ui}
    </PageTitleSlotContext.Provider>,
  );
  return slot;
};

describe("PageHeader", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders title, description and icon into the top bar's slot", () => {
    const slot = renderInSlot(
      <PageHeader
        title="Dashboard"
        description="Overview"
        icon={<span data-testid="custom-icon">icon</span>}
      />,
    );

    expect(within(slot).getByText("Dashboard")).toBeInTheDocument();
    expect(within(slot).getByText("Overview")).toBeInTheDocument();
    expect(within(slot).getByTestId("custom-icon")).toBeInTheDocument();
  });

  it("renders nothing outside the app layout", () => {
    render(<PageHeader title="Dashboard" />);

    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });
});
