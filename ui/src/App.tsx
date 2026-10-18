// src/App.tsx
import { useMemo } from "react";
import { I18nextProvider } from "react-i18next";
import { Navigate, Outlet, Route, Routes, useParams } from "react-router-dom";
import { CssBaseline } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AppLayout } from "@/components/layout/AppLayout";
import { BoardLayout } from "@/components/layout/BoardLayout";
import { RequireMinersConfigured } from "@/components/ui/RequireMinersConfigured";
import { RequirePageEnabled } from "@/components/ui/RequirePageEnabled";
import { RefreshSettingsProvider } from "@/contexts/RefreshSettingsContext";
import { SearchProvider } from "@/contexts/SearchContext";
import i18n from "@/i18n";
import { Alerts } from "@/pages/Alerts";
import { Audit } from "@/pages/Audit";
import { Backups } from "@/pages/Backups";
import { Home } from "@/pages/Home";
import { Settings } from "@/pages/settings/Settings";
import { getTheme } from "@/theme";

/**
 * An unknown sub-path under a board (e.g. "/demo/typo") lands on that
 * board's home rather than a dead end -- Home then decides what the visitor
 * actually gets to see (the board, or the same request-access page a
 * private or nonexistent board shows).
 */
const BoardHomeRedirect: React.FC = () => {
  const { boardId } = useParams();
  return <Navigate to={`/${boardId}`} replace />;
};

/**
 * Configuration, under "/settings": "/settings" itself lands on the Miners
 * section, and Settings sends any unknown section there too.
 */
const settingsRoute = (
  <Route
    path="settings"
    element={
      <RequirePageEnabled page="settings">
        <Outlet />
      </RequirePageEnabled>
    }
  >
    <Route index element={<Navigate to="miners" replace />} />
    <Route path=":section" element={<Settings />} />
  </Route>
);

export const App: React.FC = () => {
  const theme = useMemo(() => getTheme("dark"), []);

  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider theme={theme}>
          <CssBaseline />

          <RefreshSettingsProvider>
            <SearchProvider>
              <Routes>
                {/* Local mode: this server's own configured miners --
                    exactly these paths (plus Configuration's sections,
                    see settingsRoute), nothing else. A
                    static route always outranks the board branch's dynamic
                    :boardId below, so e.g. plain "/alerts" stays local even
                    though "alerts" could in principle be a boardId too. Anything that isn't one of these
                    paths -- including "/alerts/foo" -- falls to the
                    board branch's own catch-all instead of a local one:
                    there's no such thing as a bare local 404 here, only
                    "board X wasn't found" for whatever the first path
                    segment happened to be. */}
                <Route element={<AppLayout />}>
                  <Route
                    index
                    element={
                      <RequireMinersConfigured>
                        <Home />
                      </RequireMinersConfigured>
                    }
                  />
                  <Route
                    path="alerts"
                    element={
                      <RequireMinersConfigured>
                        <Alerts />
                      </RequireMinersConfigured>
                    }
                  />
                  {settingsRoute}
                  <Route
                    path="backups"
                    element={
                      <RequirePageEnabled page="backups">
                        <Backups />
                      </RequirePageEnabled>
                    }
                  />
                  <Route
                    path="audit"
                    element={
                      <RequirePageEnabled page="audit">
                        <Audit />
                      </RequirePageEnabled>
                    }
                  />
                </Route>

                {/* A hashboard board: any path that isn't one of the local
                    ones above resolves here, :boardId capturing its first
                    segment. A board is its miners' stats, nothing else:
                    its home page, every deeper path sent back to it.
                    Whether :boardId is a real, reachable board is a server
                    question, not a routing one. */}
                <Route path=":boardId" element={<BoardLayout />}>
                  <Route index element={<Home />} />
                  <Route path="*" element={<BoardHomeRedirect />} />
                </Route>
              </Routes>
            </SearchProvider>
          </RefreshSettingsProvider>
        </ThemeProvider>
      </I18nextProvider>
    </QueryClientProvider>
  );
};
