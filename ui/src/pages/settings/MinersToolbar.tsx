// src/pages/settings/MinersToolbar.tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import {
  Alert,
  alpha,
  Box,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import axios from "axios";

import { ActionButton } from "@/components/ui/ActionButton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Writable } from "@/components/ui/Writable";
import { useUiFeatures } from "@/hooks/useMiners";
import { type MinerConfig, normalizeMac } from "@/schemas/minerConfigSchema";
import type { Miner } from "@/schemas/minerSchema";
import { extractErrorMessage } from "@/utils/apiError";
import { displayName } from "@/utils/minerDisplay";

import { type MinersSync, MinersSyncDialog } from "./MinersSyncDialog";

interface PoolChoice {
  url: string;
  port: number;
  active: number; // miners mining on it right now
  held: number; // miners holding it in either slot
}

interface PoolSwitchResult {
  ip: string;
  status: "switched" | "already" | "missing" | "failed";
  error?: string;
}

const poolKey = (url: string, port: number) => `${url}:${port}`;

/** One action of the panel: its icon, name and what it does on the left,
 * its controls on the right -- under them, full width, on a phone. */
export const ActionRow = ({
  icon: Icon,
  color = "primary",
  title,
  description,
  children,
}: {
  icon: typeof SwapHorizIcon;
  color?: "primary" | "error";
  title: string;
  description: string;
  children: React.ReactNode;
}) => {
  const theme = useTheme();
  const tint = theme.palette[color].main;
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        alignItems: { xs: "stretch", sm: "center" },
        gap: 1.5,
        py: 1.5,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          flex: 1,
          minWidth: 0,
        }}
      >
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: 2,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: tint,
            bgcolor: alpha(tint, 0.12),
          }}
        >
          <Icon sx={{ fontSize: 18 }} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600}>
            {title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {description}
          </Typography>
        </Box>
      </Box>
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          gap: 1,
          flexShrink: 0,
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

// The pools the miners hold right now -- what their devices report, not
// miners.yml, which may lag behind a change made on a device.
const poolChoices = (live: Miner[]): PoolChoice[] => {
  const pools = new Map<string, PoolChoice>();
  for (const m of live) {
    const slots = [
      {
        url: m.stratumURL,
        port: m.stratumPort,
        active: m.isUsingFallbackStratum !== 1,
      },
      {
        url: m.fallbackStratumURL,
        port: m.fallbackStratumPort,
        active: m.isUsingFallbackStratum === 1,
      },
    ];
    // A miner counts once per pool, even with the same pool in both slots.
    const held = new Map<string, PoolChoice>();
    for (const { url, port, active } of slots) {
      if (!url || !port) continue;
      const key = poolKey(url, port);
      const pool = held.get(key);
      held.set(key, {
        url,
        port,
        active: pool?.active || active ? 1 : 0,
        held: 1,
      });
    }
    for (const [key, own] of held) {
      const pool = pools.get(key) ?? { ...own, active: 0, held: 0 };
      pool.held += 1;
      pool.active += own.active;
      pools.set(key, pool);
    }
  }
  return [...pools.values()].sort(
    (a, b) => b.active - a.active || b.held - a.held,
  );
};

/** Actions on every configured miner at once, in the panel their table's
 * Actions button unfolds -- children (another action) end the row. */
export const MinersToolbar = ({
  miners,
  liveMinersByMac,
  saveMiners,
  readOnly,
  onSaved,
  children,
}: {
  miners: MinerConfig[];
  liveMinersByMac: Map<string, Miner>;
  saveMiners: (miners: MinerConfig[]) => Promise<MinerConfig[]>;
  readOnly: boolean;
  onSaved: (message: string) => void;
  children?: React.ReactNode;
}) => {
  const { t } = useTranslation();
  const { ui } = useUiFeatures();
  const enabled = miners.filter((m) => m.enabled);
  const liveOf = (m: MinerConfig) => liveMinersByMac.get(normalizeMac(m.mac));
  const live = enabled.flatMap((m) => liveOf(m) ?? []);
  const nameOf = (ip: string) => {
    const m = miners.find((c) => c.ip === ip);
    return (m && displayName(m)) || ip;
  };

  const pools = poolChoices(live);
  const [selectedKey, setSelectedKey] = useState("");
  const selected = pools.find((p) => poolKey(p.url, p.port) === selectedKey);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  // The miners a switch couldn't switch -- the rest only needs the summary.
  const [failures, setFailures] = useState<PoolSwitchResult[]>([]);
  const [switchError, setSwitchError] = useState<string | null>(null);

  const [sync, setSync] = useState<MinersSync | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const poolSwitch = ui.action.minerPoolSwitch;
  const switchReadOnly = poolSwitch === "readonly";

  const handleSwitch = async () => {
    if (!selected || isSwitching) return;
    setIsSwitching(true);
    setSwitchError(null);
    setFailures([]);
    try {
      const { data } = await axios.put<{ miners: PoolSwitchResult[] }>(
        "/api/miners/pool/switch",
        null,
        { params: { url: selected.url, port: selected.port } },
      );
      const count = (status: PoolSwitchResult["status"]) =>
        data.miners.filter((r) => r.status === status).length;
      onSaved(
        t("settingsPage.toolbar.switchResult", {
          switched: count("switched"),
          already: count("already"),
          missing: count("missing"),
          failed: count("failed"),
        }),
      );
      setFailures(data.miners.filter((r) => r.status === "failed"));
    } catch (err: unknown) {
      setSwitchError(extractErrorMessage(err));
    } finally {
      setIsSwitching(false);
      setSwitchOpen(false);
    }
  };

  const handleCompare = async () => {
    setIsComparing(true);
    setSyncError(null);
    try {
      const { data } = await axios.get<MinersSync>("/api/config/miners/sync");
      setSync(data);
    } catch (err: unknown) {
      setSyncError(extractErrorMessage(err));
    } finally {
      setIsComparing(false);
    }
  };

  const handleSync = async () => {
    if (!sync || isSyncing) return;
    setIsSyncing(true);
    try {
      await saveMiners(sync.bitaxes);
      onSaved(
        t("settingsPage.toolbar.syncSuccess", { count: sync.bitaxes.length }),
      );
      setSync(null);
    } catch {
      // saveError from useMinersConfig already surfaces the message.
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Box
      sx={{
        mb: 2,
        px: 2,
        py: 0.5,
        borderRadius: 2,
        border: 1,
        borderColor: "divider",
        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
      }}
    >
      <Box sx={{ "& > * + *": { borderTop: 1, borderColor: "divider" } }}>
        {poolSwitch !== "hidden" && (
          <ActionRow
            icon={SwapHorizIcon}
            title={t("settingsPage.toolbar.switchRow")}
            description={t("settingsPage.toolbar.switchHint")}
          >
            <Tooltip
              title={switchReadOnly ? t("miner.actions.disabledHint") : ""}
            >
              <TextField
                select
                size="small"
                label={t("settingsPage.toolbar.pool")}
                value={selected ? selectedKey : ""}
                onChange={(e) => setSelectedKey(e.target.value)}
                disabled={switchReadOnly || pools.length === 0}
                sx={{ minWidth: { sm: 260 } }}
              >
                {pools.map((p) => (
                  <MenuItem
                    key={poolKey(p.url, p.port)}
                    value={poolKey(p.url, p.port)}
                  >
                    {t("settingsPage.toolbar.poolOption", {
                      pool: poolKey(p.url, p.port),
                      active: p.active,
                      held: p.held,
                    })}
                  </MenuItem>
                ))}
              </TextField>
            </Tooltip>
            <ActionButton
              icon={<SwapHorizIcon fontSize="small" />}
              disabled={
                switchReadOnly || !selected || selected.active === selected.held
              }
              loading={isSwitching}
              onClick={() => setSwitchOpen(true)}
            >
              {t("settingsPage.toolbar.switchButton")}
            </ActionButton>
          </ActionRow>
        )}
        <Writable readOnly={readOnly}>
          <ActionRow
            icon={FactCheckIcon}
            title={t("settingsPage.toolbar.syncRow")}
            description={t("settingsPage.toolbar.syncHint")}
          >
            <ActionButton
              icon={<FactCheckIcon fontSize="small" />}
              loading={isComparing}
              onClick={() => void handleCompare()}
            >
              {t("settingsPage.toolbar.sync")}
            </ActionButton>
          </ActionRow>
        </Writable>
        {children}
      </Box>

      {syncError && (
        <Alert
          severity="error"
          sx={{ my: 1.5 }}
          onClose={() => setSyncError(null)}
        >
          {syncError}
        </Alert>
      )}

      {switchError && (
        <Alert
          severity="error"
          sx={{ my: 1.5 }}
          onClose={() => setSwitchError(null)}
        >
          {switchError}
        </Alert>
      )}
      {failures.length > 0 && (
        <Alert
          severity="error"
          sx={{ my: 1.5 }}
          onClose={() => setFailures([])}
        >
          {failures.map((f) => (
            <Box key={f.ip} component="div">
              {nameOf(f.ip)} : {f.error}
            </Box>
          ))}
        </Alert>
      )}

      <ConfirmDialog
        open={switchOpen}
        onClose={() => setSwitchOpen(false)}
        onConfirm={() => void handleSwitch()}
        title={t("settingsPage.toolbar.switchTitle", {
          pool: selected ? poolKey(selected.url, selected.port) : "",
        })}
        description={t("settingsPage.toolbar.switchDescription", {
          count: selected ? selected.held - selected.active : 0,
        })}
        actionLabel={
          isSwitching
            ? t("settingsPage.toolbar.switching")
            : t("settingsPage.toolbar.switch")
        }
        actionColor="warning"
      />
      <MinersSyncDialog
        sync={sync}
        miners={miners}
        isSyncing={isSyncing}
        onClose={() => setSync(null)}
        onSync={() => void handleSync()}
      />
    </Box>
  );
};
