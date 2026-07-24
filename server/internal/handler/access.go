package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/hashboardaccess"
)

// sessionCookieName matches hashboard's storage.CookieName() — the two
// backends never import each other's Go module, only this cookie name (and
// the account/session file shapes in hashboardaccess) as a documented
// cross-repo contract.
const sessionCookieName = "hb_session"

// RequireBoardAccess gates every /api/{boardId}/* route: public boards pass
// through unconditionally, private boards require a valid hb_session cookie
// (set by hashboard after a successful magic-link click) that resolves to
// this exact board. hashboardURL is echoed on the 403 body (see
// ErrorResponse.HashboardURL) so the frontend can still build its
// "request access" link/form.
func RequireBoardAccess(checker *hashboardaccess.Checker, hashboardURL string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			boardID := chi.URLParam(r, "boardId")

			var sessionToken string
			if cookie, err := r.Cookie(sessionCookieName); err == nil {
				sessionToken = cookie.Value
			}

			allowed, err := checker.IsAllowed(boardID, sessionToken)
			if err != nil {
				writeErrorResponse(w, "failed to check board access", http.StatusInternalServerError)
				return
			}
			if !allowed {
				writeErrorResponseWithHashboardURL(w, "this board is private", http.StatusForbidden, hashboardURL)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
