import { useTranslation } from "react-i18next";
import { Box } from "@mui/material";

import { type MinerStatus, STATUS_COLOR } from "@/utils/minerStatus";

export const StatusChip = ({ status }: { status: MinerStatus }) => {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        px: 1,
        py: 0.25,
        borderRadius: 1,
        border: 1,
        borderColor: STATUS_COLOR[status],
        color: STATUS_COLOR[status],
        fontSize: "0.75rem",
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      <Box
        sx={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          bgcolor: STATUS_COLOR[status],
        }}
      />
      {t(`dashboard.status.${status}`)}
    </Box>
  );
};
