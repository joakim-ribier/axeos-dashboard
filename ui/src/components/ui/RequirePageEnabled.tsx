// src/components/ui/RequirePageEnabled.tsx
import { Box, CircularProgress } from "@mui/material";

import { useUiFeatures } from "@/hooks/useMiners";
import type { UIFeatures } from "@/types/uiFeatures";

import { OopsPage } from "./OopsPage";

/**
 * Gates a page behind its ui.page.* flag (see config.UIPageConfig) instead
 * of the frontend hardcoding what each mode shows -- an operator flips it to
 * "hidden" in dashboard.yml/remote-dashboard.yml to pull the page out of a
 * deployment entirely ("readonly" is left to the page itself, e.g. Settings
 * without any write action). Renders as a plain 404 when hidden: from the
 * outside "hidden" should be indistinguishable from "this route doesn't
 * exist".
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
    return (
      <OopsPage
        titleKey="oops.notFound.title"
        messageKey="oops.notFound.message"
      />
    );
  }

  return <>{children}</>;
};
