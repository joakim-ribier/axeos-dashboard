// src/components/layout/BoardLayout.tsx
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, Outlet, useParams } from "react-router-dom";
import { Box } from "@mui/material";
import { useQuery } from "@tanstack/react-query";

import { fetchInfo } from "@/api/info";
import { BoardLockedPage } from "@/components/ui/BoardLockedPage";
import { ModeProvider } from "@/contexts/ModeContext";
import { useRefreshSettings } from "@/contexts/RefreshSettingsContext";
import { useAppInfo } from "@/hooks/useMiners";

import { BoardPanel, BoardPanelContext } from "./BoardPanel";

/** The home page, or the request-access screen of a private board -- and
 * the board's own details (BoardPanel), opened from the page's icon
 * (BoardPanelButton). */
const Board = () => {
  const { boardId = "" } = useParams<{ boardId: string }>();
  const { hashboardUrl, boardNotFound, boardBlocked } = useAppInfo();
  const [panelOpen, setPanelOpen] = useState(false);
  const openPanel = useCallback(() => setPanelOpen(true), []);
  // Nothing behind this board: "/" sends the visitor on to hashboard (see
  // AppLayout).
  if (boardNotFound) return <Navigate to="/" replace />;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", p: 2 }}>
      <Box component="main">
        {boardBlocked ? (
          <BoardLockedPage boardId={boardId} hashboardUrl={hashboardUrl} />
        ) : (
          <BoardPanelContext.Provider value={openPanel}>
            <Outlet />
          </BoardPanelContext.Provider>
        )}
      </Box>
      <BoardPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        boardId={boardId}
      />
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
