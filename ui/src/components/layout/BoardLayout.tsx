// src/components/layout/BoardLayout.tsx
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, Outlet, useParams } from "react-router-dom";
import { Box } from "@mui/material";
import { useQuery } from "@tanstack/react-query";

import { fetchInfo } from "@/api/info";
import { BoardLockedPage } from "@/components/ui/BoardLockedPage";
import { ModeProvider } from "@/contexts/ModeContext";
import { useRefreshSettings } from "@/contexts/RefreshSettingsContext";
import { useAppInfo } from "@/hooks/useMiners";

import { AppVersion, BoardChip } from "./Sidebar";

/** The home page, or the request-access screen of a private board --
 * then, faded at the bottom, the board's line (its ID, public or private,
 * the hashboard account), with the version it runs, as in the sidebar. */
const Board = () => {
  const { boardId = "" } = useParams<{ boardId: string }>();
  const {
    hashboardUrl,
    isPublic,
    boardNotFound,
    boardBlocked,
    buildSHA,
    versionStatus,
    releaseUrl,
  } = useAppInfo();
  // Nothing behind this board: "/" sends the visitor on to hashboard (see
  // AppLayout).
  if (boardNotFound) return <Navigate to="/" replace />;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", p: 2 }}>
      <Box component="main">
        {boardBlocked ? (
          <BoardLockedPage boardId={boardId} hashboardUrl={hashboardUrl} />
        ) : (
          <Outlet />
        )}
      </Box>
      <Box
        component="footer"
        sx={{
          // The board's line centered, the version at the far left, as in the
          // sidebar; stacked and centered on a phone.
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr auto 1fr" },
          justifyItems: { xs: "center", sm: "normal" },
          alignItems: "center",
          gap: 1,
          mt: 3,
          pb: 2,
          opacity: 0.6,
          "&:hover": { opacity: 1 },
        }}
      >
        <Box sx={{ justifySelf: { sm: "start" }, order: { xs: 2, sm: 0 } }}>
          <AppVersion
            compact
            buildSHA={buildSHA}
            versionStatus={versionStatus}
            releaseUrl={releaseUrl}
          />
        </Box>
        <BoardChip
          board={{ id: boardId, url: `/${boardId}`, isPublic, hashboardUrl }}
        />
      </Box>
    </Box>
  );
};

/**
 * A hashboard board (/:boardId, see App.tsx): its miners' stats and
 * nothing else -- the home page alone, no sidebar nor top bar. Every
 * board-only concern lives here; the pages themselves don't know they're on
 * a board, they just read their API paths from ModeContext.
 */
export const BoardLayout = () => {
  const { i18n } = useTranslation();
  const { setAutoRefreshEnabled } = useRefreshSettings();
  // A board speaks its visitor's browser language and always refreshes,
  // whatever was picked here before: the old board had a language menu and
  // an auto-refresh switch, this one has neither.
  useEffect(() => {
    void i18n.changeLanguage(navigator.language);
    setAutoRefreshEnabled(true);
  }, [i18n, setAutoRefreshEnabled]);

  const infoQuery = useQuery({
    queryKey: ["info"],
    queryFn: fetchInfo,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });
  if (infoQuery.isLoading) return null;
  // Not remote-dashboard-api: there are no boards here.
  if (infoQuery.data?.remote === false) return <Navigate to="/" replace />;

  return (
    <ModeProvider mode="remote">
      <Board />
    </ModeProvider>
  );
};
