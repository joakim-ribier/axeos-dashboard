import { useState } from "react";
import { useTranslation } from "react-i18next";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SyncAltIcon from "@mui/icons-material/SyncAlt";
import { Box, Button, Snackbar, Tooltip } from "@mui/material";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useMinerAction } from "@/hooks/useMinerActions";
import { useUiFeatures } from "@/hooks/useMiners";
import { type Miner } from "@/schemas/minerSchema";
import { UIVisibility } from "@/types/uiFeatures";

type Action = "restart" | "switchPool";

interface ActionButtonProps {
  icon: React.ReactNode;
  visibility: UIVisibility;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

/** "readonly" keeps the button visible but disabled, with the reason on
 * hover -- see UIVisibility. */
const ActionButton = ({
  icon,
  visibility,
  disabled,
  onClick,
  children,
}: ActionButtonProps) => {
  const { t } = useTranslation();
  if (visibility === "hidden") return null;
  const readonly = visibility === "readonly";

  return (
    <Tooltip title={readonly ? t("miner.actions.disabledHint") : ""}>
      <Box component="span" sx={{ flex: 1, minWidth: 0 }}>
        <Button
          fullWidth
          variant="outlined"
          startIcon={icon}
          disabled={readonly || disabled}
          onClick={onClick}
          sx={{ whiteSpace: "nowrap" }}
        >
          {children}
        </Button>
      </Box>
    </Tooltip>
  );
};

/** A bar pinned to the bottom of the panel: always at hand, under the thumb
 * on a phone, however far down the details have been scrolled. */
export const MinerActions = ({ miner }: { miner: Miner }) => {
  const { t } = useTranslation();
  const { ui } = useUiFeatures();
  const { restartMiner, switchPool, isExecuting, error, clearError } =
    useMinerAction();
  // Kept apart from the open flag: the dialog still shows the action's own
  // wording while it fades out.
  const [action, setAction] = useState<Action>("restart");
  const [confirming, setConfirming] = useState(false);
  const ask = (next: Action) => {
    setAction(next);
    setConfirming(true);
  };

  if (
    ui.action.minerRestart === "hidden" &&
    ui.action.minerPoolSwitch === "hidden"
  )
    return null;

  const target = miner.isUsingFallbackStratum === 1 ? "primary" : "fallback";

  const confirm = () => {
    if (action === "restart") restartMiner(miner.ip);
    else switchPool(miner.ip, target);
    setConfirming(false);
  };

  return (
    <Box
      sx={{
        display: "flex",
        gap: 1.5,
        px: 2.5,
        pt: 1.5,
        pb: "calc(12px + env(safe-area-inset-bottom, 0px))",
        borderTop: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <ActionButton
        icon={<RestartAltIcon />}
        visibility={ui.action.minerRestart}
        disabled={isExecuting}
        onClick={() => ask("restart")}
      >
        {t("miner.actions.restart.label")}
      </ActionButton>
      <ActionButton
        icon={<SyncAltIcon />}
        visibility={ui.action.minerPoolSwitch}
        disabled={isExecuting}
        onClick={() => ask("switchPool")}
      >
        {t("miner.actions.switchPool.label")}
      </ActionButton>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={confirm}
        title={t(`miner.actions.${action}.title`)}
        description={
          action === "switchPool"
            ? t(`dashboard.drawer.confirmSwitch.${target}`, { ip: miner.ip })
            : t("miner.actions.restart.description", { ip: miner.ip })
        }
        actionLabel={t(`miner.actions.${action}.label`)}
      />
      <Snackbar
        open={error !== null}
        autoHideDuration={5000}
        onClose={clearError}
        message={error ?? ""}
      />
    </Box>
  );
};
