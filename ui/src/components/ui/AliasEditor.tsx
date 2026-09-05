// src/components/ui/AliasEditor.tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import BadgeIcon from "@mui/icons-material/Badge";
import SaveIcon from "@mui/icons-material/Save";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { Writable } from "@/components/ui/Writable";
import { type MinerConfig } from "@/schemas/minerConfigSchema";
import { extractErrorMessage } from "@/utils/apiError";

interface AliasEditorProps {
  miner: MinerConfig;
  saveMiners: (miners: MinerConfig[]) => Promise<MinerConfig[]>;
  readOnly?: boolean;
}

/** Per-miner display-name override: an optional alias shown everywhere the
 * hostname otherwise would be (MinerCard, notifications, this same table's
 * Name column...) -- defaults to the hostname when left empty. Unlike
 * hostname, an alias is never touched by a network discovery refresh (see
 * the "select an already-configured device" flow in Settings.tsx), so it's
 * the one place a custom name survives that refresh. Persists via
 * saveMiners, same pattern as PoolEditor/ScheduleEditor.
 */
export const AliasEditor = ({
  miner,
  saveMiners,
  readOnly = false,
}: AliasEditorProps) => {
  const { t } = useTranslation();
  const saved = miner.alias ?? "";

  const [alias, setAlias] = useState(saved);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty = alias.trim() !== saved;

  const handleSave = async () => {
    if (!isDirty) return;
    setIsSaving(true);
    setError(null);
    try {
      await saveMiners([{ ...miner, alias: alias.trim() }]);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, py: 1 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <BadgeIcon fontSize="small" sx={{ color: "text.secondary" }} />
        <Typography variant="subtitle2" fontWeight={700}>
          {t("settingsPage.configured.alias.title")}
        </Typography>
      </Box>
      <Stack
        direction="row"
        spacing={1.5}
        alignItems="flex-start"
        sx={{ width: "100%" }}
      >
        <TextField
          size="small"
          fullWidth
          label={t("settingsPage.configured.alias.label")}
          placeholder={miner.hostname}
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          disabled={readOnly}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <Writable readOnly={readOnly}>
          <Button
            variant="contained"
            size="small"
            disabled={!isDirty || isSaving}
            onClick={() => void handleSave()}
            startIcon={
              isSaving ? (
                <CircularProgress size={14} color="inherit" />
              ) : (
                <SaveIcon fontSize="small" />
              )
            }
            sx={{ flexShrink: 0, height: 40 }}
          >
            {isSaving
              ? t("settingsPage.configured.alias.saving")
              : t("settingsPage.configured.alias.save")}
          </Button>
        </Writable>
      </Stack>

      <Writable readOnly={readOnly}>
        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
      </Writable>
    </Box>
  );
};
