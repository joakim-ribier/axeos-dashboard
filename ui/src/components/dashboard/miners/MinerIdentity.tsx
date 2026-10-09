import { useTranslation } from "react-i18next";
import DiamondOutlinedIcon from "@mui/icons-material/DiamondOutlined";
import { Box, Chip, Tooltip, Typography } from "@mui/material";

import { type Miner } from "@/schemas/minerSchema";
import { displayName } from "@/utils/minerDisplay";

export const MinerIdentity = ({ miner }: { miner: Miner }) => {
  const { t } = useTranslation();

  return (
    <Box sx={{ minWidth: 0 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography noWrap sx={{ fontWeight: 600 }}>
          {displayName(miner) ?? miner.ip}
        </Typography>
        {miner.blockFound > 0 && (
          <Tooltip title={t("miner.blockFound.tooltip")} arrow>
            <Chip
              icon={<DiamondOutlinedIcon />}
              label={t("miner.blockFound.label", { count: miner.blockFound })}
              size="small"
              color="success"
              sx={{ height: 20, fontSize: "0.7rem" }}
            />
          </Tooltip>
        )}
      </Box>
      <Typography
        variant="caption"
        noWrap
        component="div"
        sx={{ color: "text.secondary", fontFamily: "monospace" }}
      >
        {[miner.ip, miner.deviceModel].filter(Boolean).join(" · ")}
      </Typography>
    </Box>
  );
};
