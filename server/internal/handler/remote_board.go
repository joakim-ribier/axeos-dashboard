// internal/handler/remote_board.go
package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/remotepush"
)

// RemoteBoard handles GET /api/remote/board.
//
// @Summary Remote board info
// @Description Returns what hashboard knows about the board this instance pushes to: the link to its remote dashboard, and when hashboard last received a sample for it. Empty when remote push isn't configured, or hashboard can't be reached. Cached for one feeder interval.
// @Tags Remote push
// @Produce json
// @Success 200 {object} remotepush.Board
// @Router /api/remote/board [get]
func RemoteBoard(cfg config.Config, cache *remotepush.BoardCache, logger *slog.Logger, w http.ResponseWriter, _ *http.Request) {
	var board remotepush.Board
	if cfg.Remote.Enabled() {
		var err error
		if board, err = cache.Get(cfg.Remote.PushURL, cfg.Remote.APIKey, cfg.Feeder.Interval); err != nil {
			logger.Warn("remote: failed to fetch board info", "error", err)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(board); err != nil {
		writeErrorResponse(w, "failed to encode response", http.StatusInternalServerError)
	}
}
