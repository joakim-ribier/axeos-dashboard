import { I18nextProvider } from "react-i18next";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import i18n from "@/i18n";
import { type PowerDevice } from "@/schemas/appSettingsSchema";
import { type Miner } from "@/schemas/minerSchema";
import { makeMiner } from "@/test/miner";

import { FleetKpis } from "./FleetKpis";

const renderKpis = (miners: Miner[], devices: PowerDevice[] = []) =>
  render(
    <I18nextProvider i18n={i18n}>
      <FleetKpis miners={miners} devices={devices} />
    </I18nextProvider>,
  );

const kpi = (label: string) => screen.getByRole("group", { name: label });

describe("FleetKpis", () => {
  it("adds up the reachable miners' power, with the lowest and highest below", () => {
    renderKpis([
      makeMiner({ ip: "10.0.0.1", power: 12 }),
      makeMiner({ ip: "10.0.0.2", power: 20 }),
      // Its last readings are still in latest.json -- they must not count.
      makeMiner({ ip: "10.0.0.3", power: 50, alive: false }),
    ]);

    expect(kpi("Power")).toHaveTextContent("32 W");
    // ↓12 ↑20 W -- the arrows are icons, not text.
    expect(kpi("Power")).toHaveTextContent("1220 W");
  });

  it("collapses the range to a single value when every miner reads the same", () => {
    renderKpis([
      makeMiner({ ip: "10.0.0.1", power: 12 }),
      makeMiner({ ip: "10.0.0.2", power: 12 }),
    ]);

    expect(kpi("Power")).toHaveTextContent("24 W");
    expect(kpi("Power")).not.toHaveTextContent("1212");
  });

  it("leaves a miner with no hashrate out of the efficiency range", () => {
    renderKpis([
      makeMiner({
        ip: "10.0.0.1",
        hashRateTHs: 1,
        power: 15,
        energyJPerTh: 15,
      }),
      makeMiner({
        ip: "10.0.0.2",
        hashRateTHs: 2,
        power: 36,
        energyJPerTh: 18,
      }),
      // Reported as 0 J/TH -- it would pass for the most efficient one.
      makeMiner({ ip: "10.0.0.3", hashRateTHs: 0, power: 0, energyJPerTh: 0 }),
    ]);

    expect(kpi("Efficiency")).toHaveTextContent("17.0 J/TH");
    expect(kpi("Efficiency")).toHaveTextContent("15.018.0 J/TH");
  });

  it("adds the declared devices to the daily cost, never to the all-time spent", () => {
    renderKpis(
      [
        makeMiner({
          ip: "10.0.0.1",
          power: 12,
          electricityRatePerKwh: 0.2,
          totalElectricityCost: 1.5,
        }),
        makeMiner({
          ip: "10.0.0.2",
          power: 13,
          electricityRatePerKwh: 0.2,
          totalElectricityCost: 2.25,
        }),
      ],
      [{ name: "Fan", power: 75 }],
    );

    // (12 + 13 + 75) W over 24 h at 0.20 €/kWh.
    expect(kpi("Electricity")).toHaveTextContent("0.48 € / day");
    expect(kpi("Electricity")).toHaveTextContent("All-time: 3.75 €");
  });

  it("hides the all-time spent until there is some", () => {
    renderKpis([makeMiner({ electricityRatePerKwh: 0.2 })]);

    expect(kpi("Electricity")).not.toHaveTextContent("All-time");
  });

  it("shows no cost without a configured rate", () => {
    renderKpis([makeMiner({ power: 12 })]);

    expect(kpi("Electricity")).toHaveTextContent("—");
    expect(kpi("Electricity")).not.toHaveTextContent("/ day");
  });
});
