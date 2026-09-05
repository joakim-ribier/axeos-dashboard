import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SectionDivider } from "./SectionDivider";

describe("SectionDivider", () => {
  it("renders a single 1px line", () => {
    const { container } = render(<SectionDivider />);
    const line = container.firstElementChild;
    expect(line).toBeInTheDocument();
    expect(line).toHaveStyle({ height: "1px" });
  });

  it("merges caller-provided sx (e.g. margin) on top of the default style", () => {
    const { container } = render(<SectionDivider sx={{ my: 2 }} />);
    const line = container.firstElementChild;
    expect(line).toHaveStyle({ height: "1px", marginTop: "16px" });
  });
});
