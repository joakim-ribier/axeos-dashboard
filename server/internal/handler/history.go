package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/model"
)

// historyBucket keeps the response at 96 points per miner whatever
// feeder.interval is -- enough for a sparkline or a fleet chart, a few KB
// in total instead of every raw sample of every miner.
const (
	historyBucket  = 15 * time.Minute
	historyBuckets = int(rollingWindow / historyBucket)
)

// MinerHistory is one miner's last 24h, averaged per bucket. A poll that
// found the miner unreachable counts as 0 TH/s -- it really mined nothing.
// A bucket with no line at all (feeder not running) is null instead: what
// the miner did then is unknown, so it shows as a gap, not as a drop to
// zero.
type MinerHistory struct {
	IP       string     `json:"ip"`
	HashRate []*float64 `json:"hashRate"` // TH/s
}

// HistoryResponse is the payload of GET /api/miners/history.
type HistoryResponse struct {
	From          string         `json:"from"`
	BucketSeconds int            `json:"bucketSeconds"`
	Miners        []MinerHistory `json:"miners"`
}

// History handles GET /api/miners/history.
//
// @Summary Get the last 24h of every miner, downsampled
// @Description Hashrate of every configured miner over the last 24 hours, averaged into 15-minute buckets (96 points, oldest first). Feeds the dashboard's fleet chart and per-miner sparklines.
// @Tags dashboard-api
// @Produce json
// @Success 200 {object} handler.HistoryResponse
// @Router /api/miners/history [get]
func History(cfg config.Config, w http.ResponseWriter, r *http.Request) {
	root := getDataRoot(cfg.Storage)
	from := historyFrom(time.Now())

	miners := make([]MinerHistory, 0)
	for _, miner := range cfg.GetMiners() {
		key := miner.StorageKey()
		if key == "" {
			continue
		}
		miners = append(miners, readMinerHistory(filepath.Join(root, key), miner.Ip, from))
	}

	writeHistoryResponse(w, from, miners)
}

// RemoteHistory handles GET /api/{boardId}/miners/history for the remote-api.
//
// @Summary Get the last 24h of every remote miner, downsampled (read-only)
// @Description Same as /api/miners/history, for the miners pushed to a hashboard board.
// @Tags remote-dashboard-api
// @Produce json
// @Param boardId path string true "hashboard board ID"
// @Success 200 {object} handler.HistoryResponse
// @Failure 404 {object} handler.ErrorResponse "board not found"
// @Router /api/{boardId}/miners/history [get]
func RemoteHistory(cfg config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		boardID := chi.URLParam(r, "boardId")
		root := boardDataRoot(cfg.Storage.ResolveBoardsDir(), boardID)

		entries, err := os.ReadDir(root)
		if err != nil {
			if errors.Is(err, os.ErrNotExist) {
				writeErrorResponse(w, fmt.Sprintf("board '%s' not found", boardID), http.StatusNotFound)
				return
			}
			writeErrorResponse(w, "failed to scan data dir", http.StatusInternalServerError)
			return
		}

		from := historyFrom(time.Now())
		miners := make([]MinerHistory, 0)
		for _, entry := range entries {
			if !entry.IsDir() {
				continue
			}
			dir := filepath.Join(root, entry.Name())
			latest, err := decodeLatestJSON(filepath.Join(dir, "latest.json"))
			if err != nil {
				continue
			}
			miners = append(miners, readMinerHistory(dir, latest.IP, from))
		}

		writeHistoryResponse(w, from, miners)
	}
}

// historyFrom ends the window on the boundary after now, so the current
// (still filling) bucket is the last point and the chart reaches "now".
func historyFrom(now time.Time) time.Time {
	return now.UTC().Truncate(historyBucket).Add(historyBucket - rollingWindow)
}

// readMinerHistory leaves the buckets of a missing or unreadable file
// empty rather than failing the whole response.
func readMinerHistory(dir, ip string, from time.Time) MinerHistory {
	var sum [historyBuckets]float64
	var count [historyBuckets]int

	entries, _ := readWindow(dir, from, from.Add(rollingWindow))
	for _, entry := range entries {
		ts, _ := time.Parse(time.RFC3339, entry.Timestamp)
		i := int(ts.Sub(from) / historyBucket)
		switch {
		case entry.Payload.MacAddr != "":
			sum[i] += entry.Payload.HashRate / 1_000.0
			count[i]++
		case slices.ContainsFunc(entry.Alerts, func(a model.Alert) bool { return a.Type == model.AlertOffline }):
			count[i]++
		}
		// The only other alert-only line is a MAC mismatch: another device
		// answered, nothing is known about this miner itself.
	}

	h := MinerHistory{IP: ip, HashRate: make([]*float64, historyBuckets)}
	for i := range historyBuckets {
		if count[i] > 0 {
			hashRate := sum[i] / float64(count[i])
			h.HashRate[i] = &hashRate
		}
	}
	return h
}

func writeHistoryResponse(w http.ResponseWriter, from time.Time, miners []MinerHistory) {
	resp := HistoryResponse{
		From:          from.Format(time.RFC3339),
		BucketSeconds: int(historyBucket.Seconds()),
		Miners:        miners,
	}
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		writeErrorResponse(w, "failed to encode response", http.StatusInternalServerError)
	}
}
