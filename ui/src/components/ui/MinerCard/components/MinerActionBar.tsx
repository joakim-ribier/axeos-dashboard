// src/components/ui/MinerCard/MinerActionBar.tsx
import { useTranslation } from "react-i18next";
import { RestartAltOutlined, ShowChartOutlined } from "@mui/icons-material";
import SyncAltIcon from "@mui/icons-material/SyncAlt";
import { Box, Divider, Typography } from "@mui/material";

interface MinerActionBarProps {
  isFallback: boolean;
  onSwitchPool: () => void;
  onRestart: () => void;
  isExecuting: boolean;
  showChart: boolean;
  onToggleChart: () => void;
  readOnly?: boolean;
}

interface ActionChipProps {
  icon: React.ReactNode;
  label: string;
  color: string;
  hoverBg: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}

const ActionChip = ({
  icon,
  label,
  color,
  hoverBg,
  onClick,
  disabled,
  active,
}: ActionChipProps) => (
  <Box
    onClick={disabled ? undefined : onClick}
    sx={{
      display: "flex",
      alignItems: "center",
      gap: 0.5,
      px: { xs: 0.75, md: 1.25 },
      py: 0.5,
      borderRadius: 1,
      border: "1px solid",
      borderColor: active ? color : "divider",
      backgroundColor: active ? hoverBg : "transparent",
      color: active ? color : disabled ? "text.disabled" : color,
      cursor: disabled ? "default" : "pointer",
      opacity: disabled ? 0.4 : 1,
      transition: "all 0.15s ease",
      userSelect: "none",
      ...(!disabled && {
        "&:hover": {
          borderColor: color,
          backgroundColor: hoverBg,
        },
      }),
    }}
  >
    <Box sx={{ display: "flex", alignItems: "center", fontSize: 14 }}>
      {icon}
    </Box>
    <Typography
      variant="caption"
      sx={{
        fontSize: "0.75rem",
        lineHeight: 1,
        display: { xs: "none", md: "block" },
      }}
    >
      {label}
    </Typography>
  </Box>
);

export const MinerActionBar = ({
  isFallback,
  onSwitchPool,
  onRestart,
  isExecuting,
  showChart,
  onToggleChart,
  readOnly = false,
}: MinerActionBarProps) => {
  const { t } = useTranslation();

  const switchLabel = isFallback
    ? t("miner.actions.switchPool.toMain")
    : t("miner.actions.switchPool.toFallback");

  return (
    <Box>
      <Divider />
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          py: 1,
        }}
      >
        {!readOnly && (
          <>
            <ActionChip
              icon={<SyncAltIcon sx={{ fontSize: 14 }} />}
              label={switchLabel}
              color="#29b6f6"
              hoverBg="rgba(41,182,246,0.1)"
              onClick={onSwitchPool}
              disabled={isExecuting}
            />
            <ActionChip
              icon={<RestartAltOutlined sx={{ fontSize: 14 }} />}
              label={t("miner.actions.restart.label")}
              color="#ffa726"
              hoverBg="rgba(255,167,38,0.1)"
              onClick={onRestart}
              disabled={isExecuting}
            />
          </>
        )}

        <Box sx={{ flexGrow: 1 }} />

        <ActionChip
          icon={<ShowChartOutlined sx={{ fontSize: 14 }} />}
          label={t("miner.statsTimeline")}
          color="#00b4ff"
          hoverBg="rgba(0,180,255,0.1)"
          onClick={onToggleChart}
          active={showChart}
        />
      </Box>
    </Box>
  );
};
