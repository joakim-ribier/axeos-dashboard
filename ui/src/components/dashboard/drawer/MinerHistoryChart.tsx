import { useState } from "react";

import { useMinerStats } from "@/hooks/useMinerStats";
import { MinerInfo } from "@/types/miner";

import { MinerStatsChart } from "./MinerStatsChart";

// Plotted alone: their scale has nothing in common with temp/fan's.
const EXCLUSIVE_FIELDS: (keyof MinerInfo)[] = ["hashRateTHs", "responseTime"];

export const MinerHistoryChart = ({ ip }: { ip: string }) => {
  const { data, isLoading } = useMinerStats(ip);
  const [fields, setFields] = useState<(keyof MinerInfo)[]>(["hashRateTHs"]);

  const toggle = (field: keyof MinerInfo) =>
    setFields((prev) => {
      if (EXCLUSIVE_FIELDS.includes(field))
        return prev.includes(field) ? [] : [field];
      const shared = prev.filter((f) => !EXCLUSIVE_FIELDS.includes(f));
      return shared.includes(field)
        ? shared.filter((f) => f !== field)
        : [...shared, field];
    });

  return (
    <MinerStatsChart
      data={data ?? []}
      isLoading={isLoading}
      selectedFields={fields}
      onFieldToggle={toggle}
      maxHeight={180}
    />
  );
};
