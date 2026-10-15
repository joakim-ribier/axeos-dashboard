// src/components/layout/AppLayout.tsx
import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { Box } from "@mui/material";
import { useQuery } from "@tanstack/react-query";

import { fetchInfo } from "@/api/info";
import { ModeProvider } from "@/contexts/ModeContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";

import { PageTitleSlotContext } from "./pageTitleSlot";
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
  const [titleSlot, setTitleSlot] = useState<HTMLElement | null>(null);

  // Each backend only serves one of the two branches: dashboard-api has no
  // boards, so a board-shaped path there ("/typo") is just a dead link and
  // lands on the local home; remote-dashboard-api has no local pages, so
  // "/", "/alerts"... send the visitor to hashboard's own account page
  // (which itself falls back to its landing page without a session).
  // Nothing renders until /api/info has answered, so the wrong branch never
  // flashes before leaving.
  const infoQuery = useQuery({
    queryKey: ["info"],
    queryFn: fetchInfo,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const hashboardUrl = infoQuery.data?.hashboardUrl;
  const leaveForHashboard =
    mode === "local" && infoQuery.data?.remote === true && !!hashboardUrl;
  useEffect(() => {
    if (leaveForHashboard) window.location.replace(`${hashboardUrl}/me`);
  }, [leaveForHashboard, hashboardUrl]);
  if (infoQuery.isLoading || leaveForHashboard) return null;
  if (mode === "remote" && infoQuery.data?.remote === false) {
    return <Navigate to="/" replace />;
  }

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
            <TopBar
              onMenuClick={() => setMobileNavOpen(true)}
              titleSlotRef={setTitleSlot}
            />

            <Box component="main" sx={{ flexGrow: 1, p: 2 }}>
              <PageTitleSlotContext.Provider value={titleSlot}>
                <Outlet />
              </PageTitleSlotContext.Provider>
            </Box>
          </Box>
        </Box>
      </NotificationsProvider>
    </ModeProvider>
  );
};
