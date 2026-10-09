import { useTranslation } from "react-i18next";
import { Box, Link } from "@mui/material";

import { AlertList } from "@/components/ui/AlertList";
import { type Miner } from "@/schemas/minerSchema";
import { formatTimestamp } from "@/utils/format";
import {
  FAN_THRESHOLD,
  isFanHigh,
  isTempHigh,
  type MinerStatus,
  TEMP_THRESHOLD,
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

  const problems = [
    miner.alive === false &&
      t("dashboard.issues.unreachable", {
        value: formatTimestamp(miner.aliveCheckedAt),
      }),
    status === "stale" &&
      t("dashboard.issues.stale", { value: formatTimestamp(miner.timestamp) }),
    miner.error && `${t("miner.error.macMismatch")} · ${miner.error}`,
    isTempHigh(miner) &&
      t("dashboard.issues.tempHigh", {
        value: miner.temp.toFixed(0),
        threshold: TEMP_THRESHOLD,
      }),
    isFanHigh(miner) &&
      t("dashboard.issues.fanHigh", {
        value: miner.fanspeed.toFixed(0),
        threshold: FAN_THRESHOLD,
      }),
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
