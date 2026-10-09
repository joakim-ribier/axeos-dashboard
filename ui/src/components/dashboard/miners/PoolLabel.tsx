import { useTranslation } from "react-i18next";
import { Box, Typography } from "@mui/material";

import { type Miner } from "@/schemas/minerSchema";
import { activePoolUrl, poolHostname } from "@/utils/minerDisplay";

import { PoolLink } from "../PoolLink";

export const PoolLabel = ({ miner }: { miner: Miner }) => {
  const { t } = useTranslation();
  const isFallback = miner.isUsingFallbackStratum === 1;
  const host = poolHostname(activePoolUrl(miner)) || "—";
  const dashboardUrl = isFallback
    ? miner.fallbackStratumDashboardURL
    : miner.stratumDashboardURL;

  return (
    <Box sx={{ minWidth: 0 }}>
      {dashboardUrl ? (
        <Typography variant="body2" sx={{ display: "flex", minWidth: 0 }}>
          <PoolLink
            host={host}
            href={dashboardUrl}
            iconSize={12}
            // The row/tile around it opens the miner's panel on click --
            // following the link must not do that too.
            onClick={(e) => e.stopPropagation()}
          />
        </Typography>
      ) : (
        <Typography variant="body2" noWrap>
          {host}
        </Typography>
      )}
      <Typography
        variant="caption"
        sx={{
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: isFallback ? "warning.main" : "text.secondary",
        }}
      >
        {isFallback ? t("miner.fallbackPool") : t("miner.mainPool")}
      </Typography>
    </Box>
  );
};
