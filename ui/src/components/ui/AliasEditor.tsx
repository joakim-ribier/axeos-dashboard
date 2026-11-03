// src/components/ui/AliasEditor.tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import SaveIcon from "@mui/icons-material/Save";
import { Alert, TextField } from "@mui/material";

import { ActionButton } from "@/components/ui/ActionButton";
import { SectionActions, SectionStack } from "@/components/ui/SectionLayout";
import { Writable } from "@/components/ui/Writable";
import { type MinerConfig } from "@/schemas/minerConfigSchema";
import { extractErrorMessage } from "@/utils/apiError";

interface AliasEditorProps {
  miner: MinerConfig;
  saveMiners: (miners: MinerConfig[]) => Promise<MinerConfig[]>;
  readOnly?: boolean;
}

/** Per-miner display-name override: an optional alias shown everywhere the
 * hostname otherwise would be (the dashboard, notifications, this same table's
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
    <SectionStack>
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
        <SectionActions>
          <ActionButton
            icon={<SaveIcon fontSize="small" />}
            loading={isSaving}
            disabled={!isDirty}
            onClick={() => void handleSave()}
          >
            {isSaving
              ? t("settingsPage.configured.alias.saving")
              : t("settingsPage.configured.alias.save")}
          </ActionButton>
        </SectionActions>
      </Writable>

      <Writable readOnly={readOnly}>
        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
      </Writable>
    </SectionStack>
  );
};
