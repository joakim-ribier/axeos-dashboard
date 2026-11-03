import { useTranslation } from "react-i18next";
import CloseIcon from "@mui/icons-material/Close";
import { Box, IconButton, Typography } from "@mui/material";

import { DeviceLink } from "@/components/ui/DeviceLink";
import { type Miner } from "@/schemas/minerSchema";
import { displayName } from "@/utils/minerDisplay";
import { type MinerStatus, STATUS_COLOR } from "@/utils/minerStatus";

import { StatusChip } from "../StatusChip";

interface MinerHeaderProps {
  miner: Miner;
  status: MinerStatus;
  onClose: () => void;
}

export const MinerHeader = ({ miner, status, onClose }: MinerHeaderProps) => {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        px: 2.5,
        pt: 2.5,
        pb: 2,
        display: "flex",
        flexDirection: "column",
        gap: 2,
        borderTop: "4px solid",
        borderTopColor: STATUS_COLOR[status],
        borderBottom: 1,
        borderBottomColor: "divider",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              columnGap: 1.5,
            }}
          >
            <Typography
              variant="h5"
              component="h2"
              noWrap
              sx={{ fontWeight: 600 }}
            >
              {displayName(miner) ?? miner.ip}
            </Typography>
            <StatusChip status={status} />
          </Box>
          <Typography
            variant="body2"
            component="div"
            sx={{ mt: 0.5, color: "text.secondary" }}
          >
            <DeviceLink ip={miner.ip} />
            {miner.deviceModel && ` · ${miner.deviceModel}`}
          </Typography>
        </Box>
        <IconButton
          onClick={onClose}
          aria-label={t("dashboard.drawer.close")}
          sx={{ mt: -0.5, mr: -1 }}
        >
          <CloseIcon />
        </IconButton>
      </Box>
    </Box>
  );
};
