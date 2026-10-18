// src/components/ui/RequirePageEnabled.tsx
import { Navigate } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";

import { useUiFeatures } from "@/hooks/useMiners";
import type { UIFeatures } from "@/types/uiFeatures";

/**
 * Gates a page behind its ui.page.* flag (see config.UIPageConfig) instead
 * of the frontend hardcoding what each mode shows -- an operator flips it to
 * "hidden" in dashboard.yml/remote-dashboard.yml to pull the page out of a
 * deployment entirely ("readonly" is left to the page itself, e.g. Settings
 * without any write action). Redirects to the home when hidden: from the
 * outside "hidden" should be indistinguishable from "this route doesn't
 * exist", which redirects the same way (see App.tsx).
 *
 * Waits for the flag to actually resolve (spinner, like
 * RequireMinersConfigured) instead of rendering the "enabled" fallback
 * while GET /api/info is still in flight -- otherwise a "hidden" instance
 * would flash the real page for a moment on every load.
 */
export const RequirePageEnabled: React.FC<{
  page: keyof UIFeatures["page"];
  children: React.ReactNode;
}> = ({ page, children }) => {
  const { ui, isLoading } = useUiFeatures();

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (ui.page[page] === "hidden") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
