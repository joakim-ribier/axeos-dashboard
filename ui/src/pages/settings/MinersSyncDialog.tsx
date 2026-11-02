// src/pages/settings/MinersSyncDialog.tsx
import { useTranslation } from "react-i18next";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeveloperBoardIcon from "@mui/icons-material/DeveloperBoard";
import SyncIcon from "@mui/icons-material/Sync";
import {
  alpha,
  Box,
  Button,
  Chip,
  Dialog,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";

import { ActionButton } from "@/components/ui/ActionButton";
import type { MinerConfig } from "@/schemas/minerConfigSchema";

interface DevicePools {
  stratumURL: string;
  stratumPort: number;
  stratumUser: string;
  fallbackStratumURL: string;
  fallbackStratumPort: number;
  fallbackStratumUser: string;
}

interface Change {
  field: string;
  before?: string;
  after?: string;
}

/** GET /api/config/miners/sync: what was read off each enabled miner just
 * now, how miners.yml differs, and the entries to save to sync it. */
export interface MinersSync {
  bitaxes: MinerConfig[];
  miners: {
    ip: string;
    mac: string;
    device?: DevicePools; // unless it couldn't be read
    changes?: Change[];
    error?: string;
  }[];
}

type MinerState = "ok" | "drift" | "unread";

const STATE_PALETTE = {
  ok: "success",
  drift: "warning",
  unread: "error",
} as const;

// What the check compares on each miner, slot by slot.
const SLOTS = [
  {
    label: "settingsPage.configured.pool.primary",
    fields: ["url", "port", "user"],
    read: (d: DevicePools) => ({
      url: d.stratumURL,
      port: d.stratumPort,
      user: d.stratumUser,
    }),
  },
  {
    label: "settingsPage.configured.pool.fallback",
    fields: ["fallbackUrl", "fallbackPort", "fallbackUser"],
    read: (d: DevicePools) => ({
      url: d.fallbackStratumURL,
      port: d.fallbackStratumPort,
      user: d.fallbackStratumUser,
    }),
  },
];

const stateOf = (m: MinersSync["miners"][number]): MinerState =>
  m.error || !m.device ? "unread" : m.changes?.length ? "drift" : "ok";

/** One slot of a miner: ✅ when miners.yml has what the device holds, ❌
 * with each field that differs otherwise. */
const SlotLine = ({
  label,
  pool,
  changes,
}: {
  label: string;
  pool: { url: string; port: number; user: string };
  changes: Change[];
}) => {
  const { t } = useTranslation();
  const ok = changes.length === 0;
  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
      {ok ? (
        <CheckCircleIcon color="success" sx={{ fontSize: 16, mt: 0.25 }} />
      ) : (
        <CancelIcon color="warning" sx={{ fontSize: 16, mt: 0.25 }} />
      )}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          variant="caption"
          component="div"
          sx={{ wordBreak: "break-all" }}
        >
          <Box component="span" sx={{ color: "text.secondary" }}>
            {label}
          </Box>{" "}
          {pool.url}:{pool.port}
          <Box component="span" sx={{ color: "text.secondary" }}>
            {" · "}
            {pool.user}
          </Box>
        </Typography>
        {changes.map((c) => (
          <Typography
            key={c.field}
            variant="caption"
            color="text.secondary"
            component="div"
            sx={{ wordBreak: "break-all" }}
          >
            {t(`auditPage.fields.${c.field}`, { defaultValue: c.field })} :{" "}
            <Box
              component="span"
              sx={{ textDecoration: "line-through", color: "text.disabled" }}
            >
              {c.before || "—"}
            </Box>{" "}
            →{" "}
            <Box component="span" sx={{ color: "text.primary" }}>
              {c.after || "—"}
            </Box>
          </Typography>
        ))}
      </Box>
    </Box>
  );
};

/** The check's report: every enabled miner, slot by slot, then a sync of
 * miners.yml when something differs. */
export const MinersSyncDialog = ({
  sync,
  miners,
  isSyncing,
  onClose,
  onSync,
}: {
  sync: MinersSync | null;
  miners: MinerConfig[];
  isSyncing: boolean;
  onClose: () => void;
  onSync: () => void;
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const colorOf = (state: MinerState) =>
    theme.palette[STATE_PALETTE[state]].main;

  const rows = (sync?.miners ?? []).map((m) => ({ ...m, state: stateOf(m) }));
  const count = (state: MinerState) =>
    rows.filter((r) => r.state === state).length;
  const worst: MinerState = count("unread")
    ? "unread"
    : count("drift")
      ? "drift"
      : "ok";
  const toSync = sync?.bitaxes.length ?? 0;

  // "hostname · alias", or the hostname alone.
  const nameOf = (ip: string) => {
    const m = miners.find((c) => c.ip === ip);
    if (!m) return ip;
    return m.alias ? `${m.hostname} · ${m.alias}` : m.hostname;
  };

  return (
    <Dialog
      open={sync !== null}
      onClose={onClose}
      aria-labelledby="miners-sync-title"
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 3, overflow: "hidden" } } }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1.25,
          px: 2.5,
          py: 1.75,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            bgcolor: colorOf(worst),
            boxShadow:
              worst === "ok"
                ? "none"
                : `0 0 0 3px ${alpha(colorOf(worst), 0.25)}`,
          }}
        />
        <Typography id="miners-sync-title" variant="subtitle2" fontWeight={700}>
          {t("settingsPage.toolbar.syncTitle")}
        </Typography>
        <Stack direction="row" spacing={0.75} sx={{ ml: "auto" }}>
          {(["ok", "drift", "unread"] as const).map((state) => (
            <Chip
              key={state}
              size="small"
              label={t(`settingsPage.toolbar.syncStates.${state}`, {
                count: count(state),
              })}
              sx={{
                height: 22,
                fontSize: "0.72rem",
                fontWeight: 600,
                color: count(state) ? colorOf(state) : "text.disabled",
                bgcolor: alpha(
                  count(state) ? colorOf(state) : theme.palette.text.disabled,
                  0.12,
                ),
              }}
            />
          ))}
        </Stack>
      </Box>

      <Stack
        sx={{
          px: 2.5,
          py: 0.5,
          maxHeight: "60vh",
          overflowY: "auto",
          "& > * + *": { borderTop: 1, borderColor: "divider" },
        }}
      >
        {rows.map((m) => {
          const color = colorOf(m.state);
          return (
            <Box key={m.ip} sx={{ display: "flex", gap: 1.5, py: 1.5 }}>
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: 2,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color,
                  bgcolor: alpha(color, 0.12),
                }}
              >
                <DeveloperBoardIcon sx={{ fontSize: 18 }} />
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      sx={{ wordBreak: "break-all" }}
                    >
                      {nameOf(m.ip)}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      component="div"
                    >
                      {m.ip} · {m.mac}
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    label={t(`settingsPage.toolbar.syncState.${m.state}`)}
                    sx={{
                      height: 22,
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      color,
                      bgcolor: alpha(color, 0.12),
                    }}
                  />
                </Box>
                <Stack spacing={0.5} sx={{ mt: 1 }}>
                  {m.state === "unread" ? (
                    <Typography
                      variant="caption"
                      color="error.main"
                      sx={{ wordBreak: "break-all" }}
                    >
                      {m.error}
                    </Typography>
                  ) : (
                    SLOTS.map((slot) => (
                      <SlotLine
                        key={slot.label}
                        label={t(slot.label)}
                        pool={slot.read(m.device!)}
                        changes={(m.changes ?? []).filter((c) =>
                          slot.fields.includes(c.field),
                        )}
                      />
                    ))
                  )}
                </Stack>
              </Box>
            </Box>
          );
        })}
      </Stack>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1,
          px: 2.5,
          py: 1.5,
          borderTop: 1,
          borderColor: "divider",
        }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ flex: "1 1 200px" }}
        >
          {toSync > 0 &&
            t("settingsPage.toolbar.syncDescription", { count: toSync })}
        </Typography>
        <Button
          color="inherit"
          onClick={onClose}
          sx={{ color: "text.secondary" }}
        >
          {t("dialog.actions.cancel.label")}
        </Button>
        {toSync > 0 && (
          <ActionButton
            icon={<SyncIcon fontSize="small" />}
            loading={isSyncing}
            onClick={onSync}
          >
            {t("settingsPage.toolbar.syncConfirm")}
          </ActionButton>
        )}
      </Box>
    </Dialog>
  );
};
