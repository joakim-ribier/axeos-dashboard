// internal/handler/stats.go
package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"path/filepath"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/model"
)

// ---------------------------------------------------------------------------
// HTTP handlers
// ---------------------------------------------------------------------------

// StatsResponse wraps the daily stats for a single miner.
type StatsResponse struct {
	Total int               `json:"total"`
	Data  []model.MinerInfo `json:"data"`
}

// Stats handles GET /api/miners/{miner}/stats.
// It retrieves the daily JSONL file for the specified miner (e.g. 2026-05-04.jsonl)
// and returns all entries for the day. Returns an empty array when no data is
// available yet for today.
//
// @Summary Get today's stats for one miner
// @Description Returns today's JSONL entries (one per poll cycle) for a single miner, used by the "Today's History" chart.
// @Tags dashboard-api
// @Produce json
// @Param hostnameOrIp path string true "Miner IP or configured hostname"
// @Success 200 {object} handler.StatsResponse
// @Failure 404 {object} handler.ErrorResponse "miner not found"
// @Router /api/miners/{hostnameOrIp}/stats [get]
func Stats(miner config.Bitaxe, cfg config.Config, w http.ResponseWriter, r *http.Request) {
	// Build the path to today's JSONL file: <dataRoot>/<ip>/YYYY-MM-DD.jsonl
	root := getDataRoot(cfg.Storage)
	today := time.Now().UTC().Format("2006-01-02")
	path := filepath.Join(root, miner.Ip, fmt.Sprintf("%s.jsonl", today))

	entries, err := decodeJSONL(path)
	if err != nil {
		/*if errors.Is(err, os.ErrNotExist) {
			// File does not exist yet today — return empty result, not 404
			writeStatsResponse(w, []model.MinerInfo{})
			return
		}*/
		writeErrorResponse(w, fmt.Sprintf("failed to read data file: %v", err), http.StatusInternalServerError)
		return
	}

	// Transform every entry into the API model
	stats := make([]model.MinerInfo, 0, len(entries))
	for _, entry := range entries {
		stats = append(stats, toMinerInfo(entry, miner, "", "", nil))
	}

	writeStatsResponse(w, stats)
}

// writeStatsResponse encodes the stats response as JSON.
// Ensures "data" is serialized as [] instead of null when empty.
func writeStatsResponse(w http.ResponseWriter, data []model.MinerInfo) {
	resp := StatsResponse{
		Total: len(data),
		Data:  data,
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		writeErrorResponse(w, "failed to encode response", http.StatusInternalServerError)
	}
}
