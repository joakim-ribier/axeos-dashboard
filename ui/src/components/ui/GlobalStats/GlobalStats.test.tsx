// src/components/ui/GlobalStats/GlobalStats.test.tsx
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GlobalStats } from "./GlobalStats";
import { MinerInfo } from "./types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const miner = (hashRateTHs: number): MinerInfo => ({ hashRateTHs });

describe("GlobalStats", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows the min/max hashrate range across miners on a second line", () => {
    const { container } = render(
      <GlobalStats data={[miner(1.2), miner(3.4)]} isLoading={false} />,
    );

    expect(container.textContent).toContain("4.60 TH/s"); // total
    expect(container.textContent).toContain("1.20");
    expect(container.textContent).toContain("3.40 TH/s");
  });

  it("collapses the range to a single value when every miner matches", () => {
    const { container } = render(
      <GlobalStats data={[miner(2), miner(2)]} isLoading={false} />,
    );

    expect(container.textContent).toContain("4.00 TH/s"); // total
    // Range collapsed: "2.00 TH/s" appears once as the sub-value, not as
    // a "min · max" pair.
    expect(container.textContent).not.toContain("2.00 · 2.00");
  });

  it("shows no hashrate range when there is no miner data", () => {
    const { container } = render(<GlobalStats data={[]} isLoading={false} />);

    expect(container.textContent).toContain("0.00 TH/s");
  });
});
