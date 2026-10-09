import { useState } from "react";
import { useTranslation } from "react-i18next";
import CheckIcon from "@mui/icons-material/Check";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import {
  Box,
  ButtonBase,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";

import { type Miner } from "@/schemas/minerSchema";
import { poolHostname } from "@/utils/minerDisplay";

import { PoolLink } from "../PoolLink";

import { DrawerSection } from "./DrawerSection";

type Slot = "primary" | "fallback";

interface PoolCardProps {
  label: string;
  /** The pool the miner is mining on right now. */
  active: boolean;
  /** The pool whose user is shown below the cards. */
  selected: boolean;
  onSelect: () => void;
  url?: string;
  port?: number;
  dashboardUrl?: string;
}

const PoolCard = ({
  label,
  active,
  selected,
  onSelect,
  url,
  port,
  dashboardUrl,
}: PoolCardProps) => {
  const { t } = useTranslation();
  const host = url ? poolHostname(url) : "—";

  return (
    <ButtonBase
      component="div"
      onClick={onSelect}
      aria-pressed={selected}
      sx={{
        display: "block",
        p: 1.5,
        minWidth: 0,
        textAlign: "left",
        borderRadius: 1,
        border: 1,
        borderColor: selected ? "primary.main" : "divider",
        bgcolor: selected ? "action.hover" : "transparent",
        "&:hover": { borderColor: "primary.main" },
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        {active && (
          <Typography
            variant="caption"
            color="success.main"
            fontWeight={600}
            sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
          >
            <Box
              component="span"
              sx={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                bgcolor: "success.main",
              }}
            />
            {t("dashboard.drawer.activePool")}
          </Typography>
        )}
      </Box>
      {dashboardUrl ? (
        <Typography sx={{ fontWeight: 600, display: "flex", minWidth: 0 }}>
          <PoolLink host={host} href={dashboardUrl} iconSize={13} />
        </Typography>
      ) : (
        <Typography noWrap sx={{ fontWeight: 600 }}>
          {host}
        </Typography>
      )}
      {port !== undefined && (
        <Typography variant="caption" color="text.secondary">
          {`port ${port}`}
        </Typography>
      )}
    </ButtonBase>
  );
};

/** The selected pool's user -- the card highlight already says which pool,
 * so no label repeats it here. */
const PoolUser = ({ user }: { user?: string }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = () =>
    navigator.clipboard
      .writeText(user ?? "")
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        px: 1.5,
        py: 1,
        borderRadius: 1,
        bgcolor: "action.hover",
      }}
    >
      <PersonOutlineIcon
        sx={{ fontSize: 20, color: "primary.main", flexShrink: 0 }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" component="div">
          {t("dashboard.drawer.poolUser")}
        </Typography>
        <Typography
          sx={{
            fontFamily: "monospace",
            fontSize: "0.8125rem",
            overflowWrap: "anywhere",
          }}
        >
          {user || "—"}
        </Typography>
      </Box>
      {user && (
        <Tooltip
          title={copied ? t("miner.error.copied") : t("miner.error.copy")}
        >
          <IconButton
            size="small"
            onClick={copy}
            aria-label={t("miner.error.copy")}
          >
            {copied ? (
              <CheckIcon fontSize="small" sx={{ color: "success.main" }} />
            ) : (
              <ContentCopyIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};

export const MinerPools = ({ miner }: { miner: Miner }) => {
  const { t } = useTranslation();
  const active: Slot =
    miner.isUsingFallbackStratum === 1 ? "fallback" : "primary";
  const [selected, setSelected] = useState<Slot>(active);
  const user =
    selected === "fallback" ? miner.fallbackStratumUser : miner.stratumUser;
  const label = (slot: Slot) =>
    slot === "primary" ? t("miner.mainPool") : t("miner.fallbackPool");

  return (
    <DrawerSection icon="pools" title={t("dashboard.drawer.pools")}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            sm: "repeat(2, minmax(0, 1fr))",
          },
          gap: 1.5,
        }}
      >
        <PoolCard
          label={label("primary")}
          active={active === "primary"}
          selected={selected === "primary"}
          onSelect={() => setSelected("primary")}
          url={miner.stratumURL}
          port={miner.stratumPort}
          dashboardUrl={miner.stratumDashboardURL}
        />
        <PoolCard
          label={label("fallback")}
          active={active === "fallback"}
          selected={selected === "fallback"}
          onSelect={() => setSelected("fallback")}
          url={miner.fallbackStratumURL}
          port={miner.fallbackStratumPort}
          dashboardUrl={miner.fallbackStratumDashboardURL}
        />
      </Box>
      <PoolUser user={user} />
    </DrawerSection>
  );
};
