// src/components/ui/RequireSettingsEnabled.tsx
import { Box, CircularProgress } from "@mui/material";

import { useUiFeatures } from "@/hooks/useMiners";

import { OopsPage } from "./OopsPage";

/**
 * Gates /settings and /:boardId/settings behind ui.page.settings (see
 * config.UIConfig) instead of the frontend hardcoding what each mode shows
 * -- an operator flips it to "hidden" in dashboard.yml/remote-dashboard.yml
 * to pull the page out of a deployment entirely, or "readonly" to show it
 * without any write action (remote-dashboard.yml's default). Renders as a
 * plain 404 when hidden: from the outside "hidden" should be
 * indistinguishable from "this route doesn't exist".
 *
 * Waits for the flag to actually resolve (spinner, like
 * RequireMinersConfigured) instead of rendering the "enabled" fallback
 * while GET /api/info is still in flight -- otherwise a "hidden" instance
 * would flash the real page for a moment on every load.
 */
export const RequireSettingsEnabled: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { ui, isLoading } = useUiFeatures();

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (ui.page.settings === "hidden") {
    return (
      <OopsPage
        titleKey="oops.notFound.title"
        messageKey="oops.notFound.message"
      />
    );
  }

  return <>{children}</>;
};
