// src/components/ui/RequireSettingsEnabled.tsx
import { Box, CircularProgress } from "@mui/material";

import { useUiFeatures } from "@/hooks/useMiners";

import { OopsPage } from "./OopsPage";

/**
 * Gates the /settings route behind ui.page.settings (see config.UIConfig)
 * instead of the frontend hardcoding "this is a local-only page" -- an
 * operator flips it to "hidden" in dashboard.yml/remote-dashboard.yml to
 * pull it out of a deployment entirely.
 *
 * This matters even though there's no /:boardId/settings route: the same
 * built SPA can be served by dashboard-api or remote-dashboard-api, and
 * React Router doesn't know which one -- visiting /settings directly
 * against a remote-dashboard-api deployment would otherwise still render
 * this page (its API calls would just 404, since remote-dashboard-api
 * never exposes /api/config/*, but the page itself would still show).
 * Renders as a plain 404: from the outside "hidden" should be
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
