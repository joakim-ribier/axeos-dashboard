// src/components/ui/RequireMinersConfigured.tsx
import { Navigate } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";

import { useMinersConfig } from "@/hooks/useMinersConfig";

/**
 * Gates a local-mode page behind "at least one miner is configured" --
 * redirects to /settings otherwise, so a fresh install (empty miners.yml,
 * no -miners file provided) lands straight on the onboarding flow instead
 * of an empty dashboard. Local-only: never wrap a remote (/:boardId) route,
 * whose miners come from data pushed to hashboard, not this server's own
 * config.
 *
 * Deliberately never renders children while the config check is still
 * loading (a bare spinner instead) -- rendering Home early would mount
 * useMiners() against a config that might still be empty, and that empty
 * result would stick around forever in its cache (staleTime: Infinity),
 * showing a blank dashboard even after miners get configured later in the
 * same session until a hard page reload.
 */
export const RequireMinersConfigured: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { data, isLoading } = useMinersConfig();

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (data && data.length === 0) {
    return <Navigate to="/settings" replace />;
  }

  return <>{children}</>;
};
