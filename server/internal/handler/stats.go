// internal/handler/stats.go
package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/model"
)

// ---------------------------------------------------------------------------
// HTTP handlers
// ---------------------------------------------------------------------------

// rollingWindow is how far back every chart looks: the last 24 hours rather
// than the current day, which the storage splits on UTC midnight -- a "day"
// that would start at some arbitrary local hour and restart almost empty
// right after it.
const rollingWindow = 24 * time.Hour

// StatsResponse wraps the last 24h of stats for a single miner.
type StatsResponse struct {
	Total int               `json:"total"`
	Data  []model.MinerInfo `json:"data"`
}

// Stats handles GET /api/miners/{miner}/stats.
//
// @Summary Get the last 24h of stats for one miner
// @Description Returns every JSONL entry (one per poll cycle) of the last 24 hours for a single miner, oldest first, used by the miner panel's history chart. An empty array when nothing was recorded in that time.
// @Tags dashboard-api
// @Produce json
// @Param hostnameOrIp path string true "Miner IP or configured hostname"
// @Success 200 {object} handler.StatsResponse
// @Failure 404 {object} handler.ErrorResponse "miner not found"
// @Router /api/miners/{hostnameOrIp}/stats [get]
func Stats(miner config.Bitaxe, cfg config.Config, w http.ResponseWriter, r *http.Request) {
	key := miner.StorageKey()
	if key == "" {
		writeErrorResponse(w, "no mac configured for this miner", http.StatusNotFound)
		return
	}

	now := time.Now()
	entries, err := readWindow(filepath.Join(getDataRoot(cfg.Storage), key), now.Add(-rollingWindow), now)
	if err != nil {
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

// readWindow returns the lines of dir's daily files (named by UTC date)
// timestamped within [from, to). A day with no file yet -- the feeder hasn't
// polled since midnight, or wasn't running -- simply contributes nothing.
func readWindow(dir string, from, to time.Time) ([]latestFileStructure, error) {
	var lines []latestFileStructure
	for day := from.UTC().Truncate(24 * time.Hour); day.Before(to); day = day.Add(24 * time.Hour) {
		entries, err := decodeJSONL(filepath.Join(dir, day.Format("2006-01-02")+".jsonl"))
		if err != nil && !errors.Is(err, os.ErrNotExist) {
			return lines, err
		}
		for _, entry := range entries {
			ts, err := time.Parse(time.RFC3339, entry.Timestamp)
			if err == nil && !ts.Before(from) && ts.Before(to) {
				lines = append(lines, entry)
			}
		}
	}
	return lines, nil
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
