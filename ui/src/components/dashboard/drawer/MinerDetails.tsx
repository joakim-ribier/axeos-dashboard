import { useTranslation } from "react-i18next";

import { type Miner } from "@/schemas/minerSchema";
import { formatDuration, formatMetric, formatTimestamp } from "@/utils/format";

import { DetailList, DrawerSection } from "./DrawerSection";

const duration = (seconds?: number) =>
  seconds === undefined ? "—" : formatDuration(seconds * 1000);

export const MinerDetails = ({ miner }: { miner: Miner }) => {
  const { t } = useTranslation();
  const shares = miner.sharesAccepted + miner.sharesRejected;

  return (
    <>
      <DrawerSection icon="session" title={t("dashboard.drawer.session")}>
        <DetailList
          rows={[
            [
              t("dashboard.drawer.sharesAccepted"),
              miner.sharesAccepted.toLocaleString(),
            ],
            [
              t("dashboard.drawer.rejectRate"),
              shares
                ? `${((miner.sharesRejected / shares) * 100).toFixed(2)} % · ${miner.sharesRejected.toLocaleString()}`
                : "—",
            ],
            [t("dashboard.kpi.bestDiff"), formatMetric(miner.bestDiff)],
            [t("dashboard.drawer.uptime"), duration(miner.uptimeSeconds)],
          ]}
        />
      </DrawerSection>

      <DrawerSection icon="allTime" title={t("dashboard.drawer.allTime")}>
        <DetailList
          rows={[
            [
              t("dashboard.drawer.sharesAccepted"),
              miner.totalSharesAccepted === undefined
                ? "—"
                : formatMetric(miner.totalSharesAccepted),
            ],
            [t("dashboard.drawer.uptime"), duration(miner.totalUptimeSeconds)],
            [
              t("dashboard.kpi.electricity"),
              miner.totalElectricityCost
                ? `${miner.totalElectricityCost.toFixed(2)} €`
                : "—",
            ],
          ]}
        />
      </DrawerSection>

      <DrawerSection icon="device" title={t("dashboard.drawer.device")}>
        <DetailList
          rows={[
            [t("dashboard.columns.firmware"), miner.version],
            [t("dashboard.drawer.mac"), miner.macAddr],
            [t("dashboard.drawer.ping"), `${miner.responseTime.toFixed(0)} ms`],
            [t("dashboard.drawer.lastPoll"), formatTimestamp(miner.timestamp)],
          ]}
        />
      </DrawerSection>
    </>
  );
};
