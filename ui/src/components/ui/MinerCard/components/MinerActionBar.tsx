// src/components/ui/MinerCard/MinerActionBar.tsx
import { useTranslation } from "react-i18next";
import { RestartAltOutlined } from "@mui/icons-material";
import SyncAltIcon from "@mui/icons-material/SyncAlt";
import { Box, Tooltip, Typography } from "@mui/material";

import { UIVisibility } from "@/types/uiFeatures";

interface MinerActionBarProps {
  isFallback: boolean;
  onSwitchPool: () => void;
  onRestart: () => void;
  isExecuting: boolean;
  /** "hidden": button isn't rendered. "readonly": rendered but disabled, with a hint explaining why. "enabled": normal. */
  switchPoolVisibility: UIVisibility;
  restartVisibility: UIVisibility;
}

interface ActionChipProps {
  icon: React.ReactNode;
  label: string;
  color: string;
  hoverBg: string;
  onClick: () => void;
  disabled?: boolean;
  disabledHint?: string;
  active?: boolean;
}

const ActionChip = ({
  icon,
  label,
  color,
  hoverBg,
  onClick,
  disabled,
  disabledHint,
  active,
}: ActionChipProps) => {
  const chip = (
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
      <Box sx={{ display: "flex", alignItems: "center", fontSize: 16 }}>
        {icon}
      </Box>
      <Typography
        variant="body2"
        sx={{
          fontSize: "0.875rem",
          lineHeight: 1,
        }}
      >
        {label}
      </Typography>
    </Box>
  );

  if (!disabled || !disabledHint) return chip;

  // A disabled Box still fires pointer events (unlike a disabled form
  // control), but Tooltip needs a stable child to anchor to regardless.
  return (
    <Tooltip title={disabledHint} arrow>
      <span>{chip}</span>
    </Tooltip>
  );
};

export const MinerActionBar = ({
  isFallback,
  onSwitchPool,
  onRestart,
  isExecuting,
  switchPoolVisibility,
  restartVisibility,
}: MinerActionBarProps) => {
  const { t } = useTranslation();

  const switchLabel = isFallback
    ? t("miner.actions.switchPool.toMain")
    : t("miner.actions.switchPool.toFallback");

  const disabledHint = t("miner.actions.disabledHint");
  const bothHidden =
    switchPoolVisibility === "hidden" && restartVisibility === "hidden";

  return (
    <Box>
      <Box
        sx={{
          height: "1px",
          mt: 1.5,
          // No bottom margin when the button row below is absent (bothHidden)
          // -- the parent's own flex gap already spaces this divider from
          // whatever comes next, so a bottom margin here on top of that gap
          // would double up into an oversized empty band.
          mb: bothHidden ? 0 : 1.5,
          background: (theme) =>
            `linear-gradient(to right, transparent, ${theme.palette.divider} 20%, ${theme.palette.divider} 80%, transparent)`,
        }}
      />
      {!bothHidden && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 0.75,
          }}
        >
          {switchPoolVisibility !== "hidden" && (
            <ActionChip
              icon={<SyncAltIcon sx={{ fontSize: 16 }} />}
              label={switchLabel}
              color="#29b6f6"
              hoverBg="rgba(41,182,246,0.1)"
              onClick={onSwitchPool}
              disabled={isExecuting || switchPoolVisibility === "readonly"}
              disabledHint={
                switchPoolVisibility === "readonly" ? disabledHint : undefined
              }
            />
          )}
          {restartVisibility !== "hidden" && (
            <ActionChip
              icon={<RestartAltOutlined sx={{ fontSize: 16 }} />}
              label={t("miner.actions.restart.label")}
              color="#ffa726"
              hoverBg="rgba(255,167,38,0.1)"
              onClick={onRestart}
              disabled={isExecuting || restartVisibility === "readonly"}
              disabledHint={
                restartVisibility === "readonly" ? disabledHint : undefined
              }
            />
          )}
        </Box>
      )}
    </Box>
  );
};
