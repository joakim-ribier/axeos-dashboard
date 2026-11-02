import { useTranslation } from "react-i18next";
import { Box, Link } from "@mui/material";

import { AlertList } from "@/components/ui/AlertList";
import { type Miner } from "@/schemas/minerSchema";
import { formatTimestamp } from "@/utils/format";
import {
  clearBelow,
  fanThreshold,
  isFanHigh,
  isTempHigh,
  type MinerStatus,
  tempThreshold,
} from "@/utils/minerStatus";

/** Everything about the miner that needs a look, in the app's usual alert
 * banners -- nothing at all when it's fine, the status in the header
 * already says so. A firmware update gets its own (info) banner: it's
 * worth knowing, not a problem. */
export const MinerIssues = ({
  miner,
  status,
}: {
  miner: Miner;
  status: MinerStatus;
}) => {
  const { t } = useTranslation();
  // A temp/fan alert in progress -- with the level it ends under, once the
  // reading is back under its threshold.
  const reading = (
    type: "tempHigh" | "fanHigh",
    value: number,
    threshold: number,
  ) => {
    const clear = clearBelow(miner, type);
    return value > threshold || clear === undefined
      ? t(`dashboard.issues.${type}`, { value: value.toFixed(0), threshold })
      : t(`dashboard.issues.${type}Ending`, {
          value: value.toFixed(0),
          threshold,
          clear,
        });
  };

  const problems = [
    miner.alive === false &&
      t("dashboard.issues.unreachable", {
        value: formatTimestamp(miner.aliveCheckedAt),
      }),
    status === "stale" &&
      t("dashboard.issues.stale", { value: formatTimestamp(miner.timestamp) }),
    miner.error && `${t("miner.error.macMismatch")} · ${miner.error}`,
    isTempHigh(miner) && reading("tempHigh", miner.temp, tempThreshold(miner)),
    isFanHigh(miner) && reading("fanHigh", miner.fanspeed, fanThreshold(miner)),
  ].filter((p) => typeof p === "string");

  const update = t("dashboard.issues.update", { value: miner.latestVersion });

  if (!problems.length && !miner.updateAvailable) return null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <AlertList
        severity={status === "offline" ? "error" : "warning"}
        items={problems}
      />
      {miner.updateAvailable && (
        <AlertList
          severity="info"
          items={[
            miner.releaseURL ? (
              <Link
                href={miner.releaseURL}
                target="_blank"
                rel="noopener noreferrer"
                color="inherit"
              >
                {update}
              </Link>
            ) : (
              update
            ),
          ]}
        />
      )}
    </Box>
  );
};
