// src/components/ui/GlobalStats/GlobalStats.test.tsx
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GlobalStats } from "./GlobalStats";
import { MinerInfo } from "./types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    // Mimics real i18next's {{value}} interpolation just enough to assert
    // on the resulting text (e.g. the "all-time: €X" sub-value) without
    // pulling in the full i18n setup.
    t: (key: string, options?: Record<string, unknown>) =>
      options && "value" in options ? `${key}:${options.value}` : key,
  }),
}));

const miner = (hashRateTHs: number): MinerInfo => ({ hashRateTHs });

const buildMiner = (overrides: Partial<MinerInfo> = {}): MinerInfo => ({
  ...overrides,
});

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

  it("shows the miner count and total power, with the min/max power range below", () => {
    const { container } = render(
      <GlobalStats
        data={[buildMiner({ power: 100 }), buildMiner({ power: 200 })]}
        isLoading={false}
      />,
    );

    expect(container.textContent).toContain("2 · 300W"); // count · total
    expect(container.textContent).toContain("100");
    expect(container.textContent).toContain("200W");
  });

  it("shows the instant hourly cost and the all-time total spent", () => {
    const { container } = render(
      <GlobalStats
        data={[
          buildMiner({
            power: 1000,
            electricityRatePerKwh: 0.2,
            totalElectricityCost: 12.5,
          }),
        ]}
        isLoading={false}
      />,
    );

    expect(container.textContent).toContain("0.20€/h");
    expect(container.textContent).toContain("12.50€");
  });

  it("hides the all-time figure when there is no historical cost yet", () => {
    const { container } = render(
      <GlobalStats
        data={[
          buildMiner({
            power: 1000,
            electricityRatePerKwh: 0.2,
            totalElectricityCost: 0,
          }),
        ]}
        isLoading={false}
      />,
    );

    expect(container.textContent).toContain("0.20€/h");
    // The shares card always renders its own "allTime:<n>" sub-value --
    // only the cost-specific "allTime:0.00€" (which would come from the
    // electricity card) must be absent.
    expect(container.textContent).not.toContain("allTime:0.00€");
  });

  it("hides the electricity card entirely when no rate is configured", () => {
    const { container } = render(
      <GlobalStats data={[buildMiner({ power: 1000 })]} isLoading={false} />,
    );

    expect(container.textContent).not.toContain("€/h");
  });
});
