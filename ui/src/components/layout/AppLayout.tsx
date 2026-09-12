// src/components/layout/AppLayout.tsx
import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Box } from "@mui/material";

import { ModeProvider } from "@/contexts/ModeContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";

import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

interface AppLayoutProps {
  mode: "local" | "remote";
}

/**
 * The route element for every local ("/") and every remote ("/:boardId")
 * page -- see App.tsx. Mounting ModeProvider here, one level above
 * Sidebar/TopBar, is the whole point of this component: both of them (and
 * everything they render, e.g. the notification bell, the board chip) can
 * now read mode/boardId straight from useMode() instead of each
 * re-deriving it from the raw URL on their own (the previous source of a
 * class of local/remote bugs -- see boardIdFromPathname's history).
 * useParams() inside ModeProvider only ever sees :boardId once a <Route>
 * above it in the tree has actually matched it -- this component's own
 * <Route> (in App.tsx) is that match.
 */
export const AppLayout: React.FC<AppLayoutProps> = ({ mode }) => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <ModeProvider mode={mode}>
      <NotificationsProvider>
        <Box sx={{ display: "flex", minHeight: "100vh" }}>
          <Sidebar
            mobileOpen={mobileNavOpen}
            onClose={() => setMobileNavOpen(false)}
          />

          <Box
            sx={{
              flexGrow: 1,
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
            }}
          >
            <TopBar onMenuClick={() => setMobileNavOpen(true)} />

            <Box component="main" sx={{ flexGrow: 1, p: 2 }}>
              <Outlet />
            </Box>
          </Box>
        </Box>
      </NotificationsProvider>
    </ModeProvider>
  );
};
