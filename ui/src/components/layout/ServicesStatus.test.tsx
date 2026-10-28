import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServicesStatus, ServiceState } from "@/hooks/useServicesStatus";

import { ServicesStatusBlock } from "./ServicesStatus";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key} ${JSON.stringify(opts)}` : key,
  }),
}));

const refetch = vi.fn();
let status: ServicesStatus | undefined;
vi.mock("@/hooks/useServicesStatus", () => ({
  useServicesStatus: () => ({ data: status, refetch }),
}));

const running = (interval?: string): ServicesStatus["services"]["feeder"] => ({
  state: "ok",
  interval,
  lastRunAt: "2026-10-16T09:30:00Z",
});

const buildStatus = (
  states: Partial<Record<keyof ServicesStatus["services"], ServiceState>> = {},
): ServicesStatus => {
  const services: ServicesStatus["services"] = {
    dashboardApi: {
      state: "ok",
      startedAt: "2026-10-16T08:00:00Z",
      version: "abc1234",
    },
    feeder: running("2m0s"),
    healthCheck: running("15s"),
    mailer: running("1m0s"),
    firmwareCache: running("24h0m0s"),
  };
  for (const [key, state] of Object.entries(states)) {
    services[key as keyof typeof services] = {
      ...services[key as keyof typeof services],
      state,
    };
  }
  return {
    checkedAt: "2026-10-16T09:31:00Z",
    services,
    remotePushConfigured: false,
  };
};

const card = () =>
  screen.getByRole("button", { name: /^servicesStatus\.label — / });

describe("ServicesStatusBlock", () => {
  beforeEach(() => {
    refetch.mockReset();
    status = buildStatus();
  });

  it("shows nothing until the status is known", () => {
    status = undefined;
    render(<ServicesStatusBlock collapsed={false} />);

    expect(
      screen.queryByRole("button", { name: /servicesStatus/ }),
    ).not.toBeInTheDocument();
  });

  // The card's color says it all; its label words it for a screen reader.
  it.each([
    ["every service running", {}, "ok"],
    ["a run still to come", { healthCheck: "unknown" }, "ok"],
    ["a missed run", { feeder: "late" }, "late"],
    [
      "a service not answering",
      { feeder: "late", mailer: "offline" },
      "offline",
    ],
  ] as const)("reads %s as %s", (_, states, platform) => {
    status = buildStatus(states);
    render(<ServicesStatusBlock collapsed={false} />);

    expect(card()).toHaveAccessibleName(
      `servicesStatus.label — servicesStatus.summary.${platform}`,
    );
  });

  it("opens every service's details, asking for a fresh status", async () => {
    const user = userEvent.setup();
    status = buildStatus({ mailer: "offline" });
    render(<ServicesStatusBlock collapsed={false} />);

    await user.click(card());

    expect(refetch).toHaveBeenCalledTimes(1);
    for (const key of [
      "dashboardApi",
      "feeder",
      "healthCheck",
      "mailer",
      "firmwareCache",
    ]) {
      expect(
        screen.getByText(`servicesStatus.services.${key}`),
      ).toBeInTheDocument();
    }
    expect(
      screen.getByText("servicesStatus.states.offline"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("servicesStatus.states.ok")).toHaveLength(4);
  });

  it("words each interval in its own unit, one as 'every minute'", async () => {
    const user = userEvent.setup();
    render(<ServicesStatusBlock collapsed={false} />);

    await user.click(card());

    expect(
      screen.getByText(
        `servicesStatus.every ${JSON.stringify({ interval: "2 min" })}`,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        `servicesStatus.every ${JSON.stringify({ interval: "15 s" })}`,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        `servicesStatus.every ${JSON.stringify({ interval: "24 h" })}`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("servicesStatus.everyOne.min")).toBeInTheDocument();
  });

  it("keeps the same card, folded into the rail", () => {
    status = buildStatus({ feeder: "late" });
    render(<ServicesStatusBlock collapsed />);

    expect(card()).toHaveAccessibleName(
      "servicesStatus.label — servicesStatus.summary.late",
    );
    expect(screen.queryByText("servicesStatus.label")).not.toBeInTheDocument();
  });
});
