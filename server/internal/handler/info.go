// internal/handler/info.go
package handler

import (
	"encoding/json"
	"net/http"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/appversion"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/model"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/version"
)

// Info handles GET /api/info — server-instance metadata (build/version
// status, and for remote-dashboard-api, the hashboard base URL). Never
// board-gated: none of this is board-specific, so it must stay reachable
// even for a visitor locked out of a private board. hashboardURL should be
// passed empty for dashboard-api (local mode), where it's not applicable.
//
// @Summary Server build/version info
// @Description Returns this binary's git SHA, whether it's up to date with the latest GitHub release, and (remote-dashboard-api only) the hashboard base URL.
// @Tags dashboard-api,remote-dashboard-api
// @Produce json
// @Success 200 {object} model.InfoResponse
// @Router /api/info [get]
func Info(versionChecker *appversion.Checker, hashboardURL string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		versionCheck := versionChecker.Result()
		resp := model.InfoResponse{
			BuildSHA:             version.GitSHA,
			AppVersionStatus:     versionCheck.Status,
			AppVersionReleaseURL: versionCheck.ReleaseURL,
			HashboardURL:         hashboardURL,
		}

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(resp); err != nil {
			http.Error(w, "failed to encode response", http.StatusInternalServerError)
		}
	}
}
