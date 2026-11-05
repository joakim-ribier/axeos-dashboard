import { useState } from "react";
import { useTranslation } from "react-i18next";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SyncAltIcon from "@mui/icons-material/SyncAlt";
import {
  Box,
  Button,
  CircularProgress,
  Snackbar,
  Typography,
} from "@mui/material";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useMode } from "@/contexts/ModeContext";
import { useMinerAction } from "@/hooks/useMinerActions";
import {
  type RemoteAction,
  useRemoteMinerAction,
} from "@/hooks/useRemoteMinerAction";
import { type Miner } from "@/schemas/minerSchema";
import { formatTimeOnly } from "@/utils/format";
import { displayName } from "@/utils/minerDisplay";

type Action = "restart" | "switchPool";

interface ActionButtonProps {
  icon: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

const ActionButton = ({
  icon,
  disabled,
  onClick,
  children,
}: ActionButtonProps) => (
  <Box component="span" sx={{ flex: 1, minWidth: 0 }}>
    <Button
      fullWidth
      variant="outlined"
      startIcon={icon}
      disabled={disabled}
      onClick={onClick}
      sx={{ whiteSpace: "nowrap" }}
    >
      {children}
    </Button>
  </Box>
);

/** A bar pinned to the bottom of the panel: always at hand, under the thumb
 * on a phone, however far down the details have been scrolled. On a
 * board, the same buttons ask the dashboard pushing to it instead, for the
 * actions it allows. */
export const MinerActions = ({ miner }: { miner: Miner }) => {
  const { t } = useTranslation();
  const { apiPaths } = useMode();
  const local = useMinerAction();
  const inProgress = miner.remoteAction;
  const remote = useRemoteMinerAction(inProgress !== undefined);
  const onBoard = apiPaths.remoteAction !== undefined;
  // Kept apart from the open flag: the dialog still shows the action's own
  // wording while it fades out.
  const [action, setAction] = useState<Action>("restart");
  const [confirming, setConfirming] = useState(false);
  const ask = (next: Action) => {
    setAction(next);
    setConfirming(true);
  };

  const target = miner.isUsingFallbackStratum === 1 ? "primary" : "fallback";
  const switchAction: RemoteAction = `switch_${target}`;
  const offered = (a: RemoteAction) =>
    !onBoard || (miner.remoteActions ?? []).includes(a);
  const canRestart = offered("restart");
  const canSwitch = offered(switchAction);

  if (!canRestart && !canSwitch) return null;

  const busy = onBoard
    ? remote.isRequesting || inProgress !== undefined
    : local.isExecuting;
  const error = onBoard ? remote.error : local.error;

  const confirm = () => {
    if (onBoard)
      void remote.request(
        miner.ip,
        action === "restart" ? "restart" : switchAction,
      );
    else if (action === "restart") void local.restartMiner(miner.ip);
    else void local.switchPool(miner.ip, target);
    setConfirming(false);
  };

  // Its name, as everywhere else -- on a board, its IP is often a made-up one.
  const name = displayName(miner) ?? miner.ip;
  const description =
    action === "switchPool"
      ? t(`dashboard.drawer.confirmSwitch.${target}`, { name })
      : t("miner.actions.restart.description", { name });

  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        gap: 1.5,
        px: 2.5,
        pt: 1.5,
        pb: "calc(12px + env(safe-area-inset-bottom, 0px))",
        borderTop: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      {onBoard && inProgress && (
        <Box
          sx={{ width: "100%", display: "flex", alignItems: "center", gap: 1 }}
        >
          <CircularProgress size={14} />
          <Typography variant="body2" color="primary">
            {t(
              inProgress.polledAt
                ? "miner.actions.remote.polled"
                : "miner.actions.remote.pending",
              {
                action: t(`miner.actions.remote.label.${inProgress.action}`),
                time: formatTimeOnly(inProgress.polledAt),
              },
            )}
          </Typography>
        </Box>
      )}
      {canRestart && (
        <ActionButton
          icon={<RestartAltIcon />}
          disabled={busy}
          onClick={() => ask("restart")}
        >
          {t("miner.actions.restart.label")}
        </ActionButton>
      )}
      {canSwitch && (
        <ActionButton
          icon={<SyncAltIcon />}
          disabled={busy}
          onClick={() => ask("switchPool")}
        >
          {t("miner.actions.switchPool.label")}
        </ActionButton>
      )}

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={confirm}
        title={t(`miner.actions.${action}.title`)}
        description={
          onBoard
            ? `${description} ${t("miner.actions.remote.confirmHint")}`
            : description
        }
        actionLabel={t(`miner.actions.${action}.label`)}
      />
      <Snackbar
        open={error !== null}
        autoHideDuration={5000}
        onClose={onBoard ? remote.clearError : local.clearError}
        message={error ?? ""}
        // An error: the red edge, not the accent of a plain toast.
        slotProps={{ content: { sx: { borderLeftColor: "error.main" } } }}
      />
    </Box>
  );
};
