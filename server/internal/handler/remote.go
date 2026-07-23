package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/appversion"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/model"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/version"
)

// boardDataRoot returns the bitaxes directory for a given boardId.
func boardDataRoot(dataDir, boardID string) string {
	return filepath.Join(dataDir, boardID, "bitaxes")
}

// ListRemoteMiners handles GET /api/{boardId}/miners/ for the remote-api.
// It auto-discovers miners by scanning the board's bitaxes directory.
// Miner metadata (IP, hostname, model) is read from the file itself (PushSample fields).
//
// @Summary List miners pushed to a hashboard board (read-only)
// @Description Auto-discovers miners from the board's bitaxes directory — no local config needed, data comes from whatever the feeder already pushed to hashboard.live.
// @Tags remote-dashboard-api
// @Produce json
// @Param boardId path string true "hashboard board ID"
// @Success 200 {object} model.MinersResponse
// @Failure 404 {object} handler.ErrorResponse "board not found"
// @Router /api/{boardId}/miners [get]
func ListRemoteMiners(cfg config.Config, versionChecker *appversion.Checker) http.HandlerFunc {
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

		versionCheck := versionChecker.Result()
		resp := model.MinersResponse{
			Miners:               make([]model.MinerInfo, 0),
			BuildSHA:             version.GitSHA,
			AppVersionStatus:     versionCheck.Status,
			AppVersionReleaseURL: versionCheck.ReleaseURL,
		}

		for _, entry := range entries {
			if !entry.IsDir() {
				continue
			}

			path := filepath.Join(root, entry.Name(), "latest.json")
			raw, err := decodeLatestJSON(path)
			if err != nil {
				log.Printf("remote: skipping %s: %v", entry.Name(), err)
				continue
			}

			miner := syntheticBitaxe(raw, entry.Name())
			info := toMinerInfo(raw, miner, raw.LatestFirmware, cfg.Firmware.Repos[miner.Model], cfg.Pools.Dashboards)
			info.Alive, info.AliveCheckedAt = aliveFromTimestamp(raw.Timestamp)
			resp.Miners = append(resp.Miners, info)
		}

		resp.Configured = len(resp.Miners)
		resp.Total = len(resp.Miners)

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(resp); err != nil {
			http.Error(w, "failed to encode response", http.StatusInternalServerError)
		}
	}
}

// RemoteStats handles GET /api/{boardId}/{ip}/stats for the remote-api.
//
// @Summary Get today's stats for one remote miner (read-only)
// @Description Returns today's JSONL entries pushed to hashboard.live for a single miner in the board.
// @Tags remote-dashboard-api
// @Produce json
// @Param boardId path string true "hashboard board ID"
// @Param ip path string true "Miner IP"
// @Success 200 {object} handler.StatsResponse
// @Failure 500 {object} handler.ErrorResponse "data file missing or unreadable"
// @Router /api/{boardId}/{ip}/stats [get]
func RemoteStats(cfg config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		boardID := chi.URLParam(r, "boardId")
		ip := chi.URLParam(r, "ip")
		if ip == "" {
			writeErrorResponse(w, "missing ip", http.StatusBadRequest)
			return
		}

		root := boardDataRoot(cfg.Storage.ResolveBoardsDir(), boardID)
		today := time.Now().UTC().Format("2006-01-02")
		path := filepath.Join(root, ip, fmt.Sprintf("%s.jsonl", today))

		entries, err := decodeJSONL(path)
		if err != nil {
			writeErrorResponse(w, fmt.Sprintf("failed to read data file: %v", err), http.StatusInternalServerError)
			return
		}

		stats := make([]model.MinerInfo, 0, len(entries))
		for _, raw := range entries {
			stats = append(stats, toMinerInfo(raw, syntheticBitaxe(raw, ip), "", "", nil))
		}

		writeStatsResponse(w, stats)
	}
}

// aliveFromTimestamp returns alive=true if the timestamp is within the last 10 minutes.
// Used in remote mode where no real-time watcher runs.
func aliveFromTimestamp(ts string) (bool, string) {
	t, err := time.Parse(time.RFC3339, ts)
	if err != nil {
		return false, ts
	}
	return time.Since(t) < 10*time.Minute, ts
}

// syntheticBitaxe builds a config.Bitaxe from fields embedded in the PushSample file.
// Falls back to dirName for IP when the file field is empty (backward compatibility).
func syntheticBitaxe(raw latestFileStructure, dirName string) config.Bitaxe {
	ip := raw.IP
	if ip == "" {
		ip = dirName
	}
	return config.Bitaxe{
		Ip:       ip,
		Hostname: raw.Hostname,
		Model:    raw.Model,
		Enabled:  true,
	}
}
