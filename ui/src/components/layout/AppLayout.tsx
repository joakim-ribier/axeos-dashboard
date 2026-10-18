// src/components/layout/AppLayout.tsx
import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Box } from "@mui/material";
import { useQuery } from "@tanstack/react-query";

import { fetchInfo } from "@/api/info";
import { ModeProvider } from "@/contexts/ModeContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";

import { PageTitleSlotContext } from "./pageTitleSlot";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

/**
 * The route element for every page of the local dashboard ("/", see
 * App.tsx): the sidebar, the top bar, the page. A hashboard board has its
 * own, much barer one (BoardLayout). Served by remote-dashboard-api
 * instead, the local pages have nothing behind them: off to hashboard.
 */
export const AppLayout: React.FC = () => {
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
  const leaveForHashboard = infoQuery.data?.remote === true && !!hashboardUrl;
  useEffect(() => {
    if (leaveForHashboard) window.location.replace(`${hashboardUrl}/me`);
  }, [leaveForHashboard, hashboardUrl]);
  if (infoQuery.isLoading || leaveForHashboard) return null;

  return (
    <ModeProvider mode="local">
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
