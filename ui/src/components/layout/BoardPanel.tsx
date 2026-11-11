// src/components/layout/BoardPanel.tsx
import { createContext, useContext } from "react";
import { Trans, useTranslation } from "react-i18next";
import CloseIcon from "@mui/icons-material/Close";
import PrivacyTipOutlinedIcon from "@mui/icons-material/PrivacyTipOutlined";
import { Box, IconButton, Tooltip, Typography } from "@mui/material";

import {
  DetailList,
  DrawerSection,
} from "@/components/dashboard/drawer/DrawerSection";
import { ExternalLink } from "@/components/ui/ExternalLink";
import { SidePanel } from "@/components/ui/SidePanel";
import { useAppInfo, useMiners } from "@/hooks/useMiners";
import { type Miner } from "@/schemas/minerSchema";

const REPO_URL = "https://github.com/joakim-ribier/axeos-dashboard";

export type Share = "sent" | "notSent" | "masked" | "unknown";

/** What hashboard holds of these miners, read off their latest samples -- a
 * value their dashboard doesn't share arrives as "xxxxxxxx" (none, once
 * parsed), an IP as a made-up fd00:: one. The data itself, so it can't
 * disagree with what was actually sent. */
export const sharedOnBoard = (
  miners: Miner[],
): { user: Share; pools: Share; ip: Share } => {
  if (miners.length === 0)
    return { user: "unknown", pools: "unknown", ip: "unknown" };
  return {
    user: miners.some((m) => m.stratumUser || m.fallbackStratumUser)
      ? "sent"
      : "notSent",
    pools: miners.some((m) => m.stratumURL || m.fallbackStratumURL)
      ? "sent"
      : "notSent",
    ip: miners.some((m) => !m.ip.startsWith("fd00:")) ? "sent" : "masked",
  };
};

export type Allowed = "allowed" | "notAllowed" | "publicBoard" | "unknown";

/** What the board's owner may ask of its miners, read off the miners still
 * sending data -- the only ones offered an action (none on a public board),
 * each carrying the actions its dashboard allows. */
export const actionsOnBoard = (
  miners: Miner[],
  isPublic: boolean,
): { restart: Allowed; switchPool: Allowed } => {
  if (isPublic) return { restart: "publicBoard", switchPool: "publicBoard" };
  const alive = miners.filter((m) => m.alive);
  if (alive.length === 0) return { restart: "unknown", switchPool: "unknown" };
  const offered = (test: (a: string) => boolean) =>
    alive.some((m) => (m.remoteActions ?? []).some(test))
      ? "allowed"
      : "notAllowed";
  return {
    restart: offered((a) => a === "restart"),
    switchPool: offered((a) => a.startsWith("switch_")),
  };
};

const AllowedValue = ({ allowed }: { allowed: Allowed }) => {
  const { t } = useTranslation();
  return (
    <Box
      component="span"
      sx={{ color: allowed === "allowed" ? "warning.main" : "text.primary" }}
    >
      {t(`boardPanel.actions.${allowed}`)}
    </Box>
  );
};

const ShareValue = ({ share }: { share: Share }) => {
  const { t } = useTranslation();
  return (
    <Box
      component="span"
      sx={{ color: share === "sent" ? "warning.main" : "text.primary" }}
    >
      {t(`boardPanel.shared.${share}`)}
    </Box>
  );
};

const Description = ({ children }: { children: React.ReactNode }) => (
  <Typography variant="body2" color="text.secondary">
    {children}
  </Typography>
);

/** Opens the board's panel: set by BoardLayout, so null anywhere but on a
 * board. */
export const BoardPanelContext = createContext<(() => void) | null>(null);

/** The icon opening the board's panel -- nothing off a board. */
export const BoardPanelButton = () => {
  const { t } = useTranslation();
  const open = useContext(BoardPanelContext);
  if (!open) return null;
  return (
    <Tooltip title={t("boardPanel.open")} arrow>
      <IconButton
        size="small"
        onClick={open}
        aria-label={t("boardPanel.open")}
        // Outlined like the fleet's health badge next to it, so it reads as
        // a button too.
        sx={{
          p: "3px",
          borderRadius: 1,
          border: 1,
          borderColor: "primary.main",
          color: "primary.main",
        }}
      >
        <PrivacyTipOutlinedIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Tooltip>
  );
};

/** A board's own details, behind its icon: the board itself, what
 * hashboard gets of its miners, and the version it runs -- laid out like a
 * miner's panel. */
export const BoardPanel = ({
  open,
  onClose,
  boardId,
}: {
  open: boolean;
  onClose: () => void;
  boardId: string;
}) => {
  const { t } = useTranslation();
  const { hashboardUrl, isPublic, buildSHA } = useAppInfo();
  const { data } = useMiners();
  const shared = sharedOnBoard(data ?? []);
  const actions = actionsOnBoard(data ?? [], isPublic);

  const boardRows: [string, React.ReactNode][] = [
    [t("boardPanel.board.id"), boardId],
    [
      t("boardPanel.board.visibility"),
      t(isPublic ? "boardPanel.board.public" : "boardPanel.board.private"),
    ],
  ];
  if (hashboardUrl)
    boardRows.push([
      t("boardPanel.board.account"),
      <ExternalLink key="account" href={`${hashboardUrl}/me`}>
        {t("boardPanel.board.manage")}
      </ExternalLink>,
    ]);

  return (
    <SidePanel open={open} onClose={onClose}>
      <Box
        sx={{
          px: 2.5,
          pt: 2.5,
          pb: 2,
          display: "flex",
          alignItems: "center",
          gap: 2,
          borderBottom: 1,
          borderBottomColor: "divider",
        }}
      >
        <Typography
          variant="h5"
          component="h2"
          sx={{ flex: 1, fontWeight: 600 }}
        >
          {t("boardPanel.title")}
        </Typography>
        <IconButton
          onClick={onClose}
          aria-label={t("dashboard.drawer.close")}
          sx={{ mr: -1 }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      <Box
        sx={{
          flex: 1,
          p: 2.5,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          overflowY: "auto",
        }}
      >
        <DrawerSection icon="board" title={t("boardPanel.board.title")}>
          <DetailList rows={boardRows} />
        </DrawerSection>

        <DrawerSection icon="privacy" title={t("boardPanel.shared.title")}>
          <Description>{t("boardPanel.setLocally")}</Description>
          <DetailList
            rows={[
              [
                t("boardPanel.shared.user"),
                <ShareValue key="user" share={shared.user} />,
              ],
              [
                t("boardPanel.shared.pools"),
                <ShareValue key="pools" share={shared.pools} />,
              ],
              [
                t("boardPanel.shared.ip"),
                <ShareValue key="ip" share={shared.ip} />,
              ],
              [
                t("boardPanel.shared.network"),
                <ShareValue key="network" share="notSent" />,
              ],
            ]}
          />
        </DrawerSection>

        <DrawerSection icon="actions" title={t("boardPanel.actions.title")}>
          <Description>{t("boardPanel.setLocally")}</Description>
          <DetailList
            rows={[
              [
                t("boardPanel.actions.restart"),
                <AllowedValue key="restart" allowed={actions.restart} />,
              ],
              [
                t("boardPanel.actions.switchPool"),
                <AllowedValue key="switchPool" allowed={actions.switchPool} />,
              ],
            ]}
          />
        </DrawerSection>

        <DrawerSection icon="version" title={t("boardPanel.version.title")}>
          <Description>
            <Trans
              i18nKey="boardPanel.version.description"
              components={{ repo: <ExternalLink href={REPO_URL} /> }}
            />
          </Description>
          <DetailList
            rows={[[t("boardPanel.version.label"), buildSHA ?? "—"]]}
          />
        </DrawerSection>
      </Box>
    </SidePanel>
  );
};
