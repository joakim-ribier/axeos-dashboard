// internal/handler/remote_board.go
package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/remotepush"
)

// RemoteBoardResponse is the board, and the enabled miners the feeder
// doesn't push to it, past its miner limit (remotepush.Split, the
// feeder's own choice) -- by the name the UI shows them by.
type RemoteBoardResponse struct {
	remotepush.Board
	NotSent []string `json:"notSent,omitempty"`
}

// RemoteBoard handles GET /api/remote/board.
//
// @Summary Remote board info
// @Description Returns what hashboard knows about the board this instance pushes to: the link to its remote dashboard, when hashboard last received a sample for it, its miner limit -- and the enabled miners the feeder doesn't push past that limit. Empty when remote push isn't configured, or hashboard can't be reached. Cached for one feeder interval.
// @Tags Remote push
// @Produce json
// @Success 200 {object} RemoteBoardResponse
// @Router /api/remote/board [get]
func RemoteBoard(cfg config.Config, cache *remotepush.BoardCache, logger *slog.Logger, w http.ResponseWriter, _ *http.Request) {
	var resp RemoteBoardResponse
	if cfg.Remote.Enabled() {
		var err error
		if resp.Board, err = cache.Get(cfg.Remote.PushURL, cfg.Remote.APIKey, cfg.Feeder.Interval); err != nil {
			logger.Warn("remote: failed to fetch board info", "error", err)
		}
		_, held := remotepush.Split(cfg.GetMiners(), resp.Board)
		for _, m := range held {
			resp.NotSent = append(resp.NotSent, m.DisplayName())
		}
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		writeErrorResponse(w, "failed to encode response", http.StatusInternalServerError)
	}
}
