// internal/handler/remote_board.go
package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/remotepush"
)

// RemoteBoardResponse feeds the UI's board line, the home page's link to the
// board and Configuration › Remote. NotSent recomputes the feeder's
// remotepush.Split, so it names the miners the feeder actually holds back.
type RemoteBoardResponse struct {
	remotepush.Board
	NotSent []string `json:"notSent,omitempty"`
	// State is the link to hashboard (remotepush.StateOf): ok, or why the
	// board couldn't be read -- the API key refused above all. Empty when
	// remote push isn't configured.
	State string `json:"state,omitempty"`
}

// RemoteBoard handles GET /api/remote/board.
//
// @Summary Remote board info
// @Description Returns what hashboard knows about the board this instance pushes to: the link to its remote dashboard, when hashboard last received a sample for it, its miner limit, the enabled miners the feeder doesn't push past that limit -- and the state of the link (ok, unauthorized: the API key is refused, refused, unreachable). Empty when remote push isn't configured, or hashboard can't be reached. Cached for one feeder interval.
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
		resp.State = remotepush.StateOf(err)
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
