// src/utils/boardId.ts

// Top-level path segments that belong to a *local*-mode page, not a
// remote board id -- must be kept in sync with App.tsx's local-mode
// routes ("/", "/alerts", ...). Without this, a bare "/alerts" would be
// indistinguishable from a remote board literally named "alerts": both
// are a single path segment, and boardIdFromPathname has no access to
// which <Route> actually matched (it runs in components mounted above the
// routing tree -- see below).
const LOCAL_ONLY_ROUTES = new Set(["alerts"]);

/**
 * Extracts the boardId from a URL pathname -- just the first path segment,
 * so it stays correct for a nested remote route too (e.g. "/demo/alerts"
 * still resolves to "demo", not "demo/alerts"). Returns undefined for the
 * local-mode root ("/") and for any other local-only top-level route (see
 * LOCAL_ONLY_ROUTES).
 *
 * Used by everything that derives boardId directly from useLocation()
 * rather than ModeContext -- TopBar, Sidebar, NotificationsContext -- all
 * mounted above the routing tree (see App.tsx), so they can't rely on
 * useParams()/useMode() the way page-level components can.
 */
export const boardIdFromPathname = (pathname: string): string | undefined => {
  const first = pathname.split("/")[1];
  if (!first || LOCAL_ONLY_ROUTES.has(first)) return undefined;
  return first;
};
