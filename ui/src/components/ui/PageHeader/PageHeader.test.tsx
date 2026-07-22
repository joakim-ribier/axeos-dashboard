import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageHeader } from "./PageHeader";

describe("PageHeader", () => {
  it("renders title and description by default", () => {
    render(<PageHeader title="Dashboard" description="Overview" />);

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Overview")).toBeInTheDocument();
  });

  it("hides title, badge and description when showHeader is false", () => {
    render(
      <PageHeader
        title="Dashboard"
        description="Overview"
        titleBadge={<span>badge</span>}
        showHeader={false}
      />,
    );

    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("Overview")).not.toBeInTheDocument();
    expect(screen.queryByText("badge")).not.toBeInTheDocument();
  });

  it("renders the title badge next to the title when showHeader is true", () => {
    render(
      <PageHeader
        title="Dashboard"
        titleBadge={<span>REMOTE</span>}
        showHeader
      />,
    );

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("REMOTE")).toBeInTheDocument();
  });

  it("renders actions on desktop", () => {
    render(
      <PageHeader
        title="Dashboard"
        actions={[<button key="a">Do thing</button>]}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Do thing" }),
    ).toBeInTheDocument();
  });

  it("renders a custom icon when provided", () => {
    render(
      <PageHeader
        title="Dashboard"
        icon={<span data-testid="custom-icon">icon</span>}
      />,
    );

    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
  });
});
