import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { makeMiner } from "@/test/miner";

import { MinerIssues } from "./MinerIssues";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key} ${JSON.stringify(opts)}` : key,
  }),
}));

describe("MinerIssues -- a temp/fan alert in progress", () => {
  it("gives the reading and its threshold while above it", () => {
    render(
      <MinerIssues
        miner={makeMiner({
          fanspeed: 80,
          activeAlerts: [{ type: "fanHigh", clearBelow: 70 }],
        })}
        status="warning"
      />,
    );

    expect(
      screen.getByText(
        'dashboard.issues.fanHigh {"value":"80","threshold":75}',
      ),
    ).toBeInTheDocument();
  });

  it("adds where it ends once back under the threshold", () => {
    render(
      <MinerIssues
        miner={makeMiner({
          temp: 61,
          activeAlerts: [{ type: "tempHigh", clearBelow: 60 }],
        })}
        status="warning"
      />,
    );

    expect(
      screen.getByText(
        'dashboard.issues.tempHighEnding {"value":"61","threshold":62,"clear":60}',
      ),
    ).toBeInTheDocument();
  });

  it("says nothing once the alert has ended", () => {
    const { container } = render(
      <MinerIssues
        miner={makeMiner({ temp: 61, activeAlerts: [] })}
        status="ok"
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
