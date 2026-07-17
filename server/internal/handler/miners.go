// internal/handler/miners.go
package handler

import (
	"encoding/json"
	"log"
	"net/http"
	"path/filepath"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/firmware"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/healtcheck"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/model"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/version"
)

// ---------------------------------------------------------------------------
// HTTP handlers
// ---------------------------------------------------------------------------

// ListMiners handles GET /api/miners.
// It walks through every `<dataRoot>/<ip>/latest.json` file, extracts the
// required fields, converts the hash rate to TH/s, calculates energy consumption
// in J/TH, and builds the JSON response.
//
// @Summary List all configured miners
// @Description Returns every enabled miner with its latest snapshot (hashrate, temp, shares, pool, uptime...).
// @Tags dashboard-api
// @Produce json
// @Success 200 {object} model.MinersResponse
// @Router /api/miners [get]
func ListMiners(cfg config.Config, watcher *healtcheck.Watcher, w http.ResponseWriter, r *http.Request) {
	root := getDataRoot(cfg.Storage)
	miners := cfg.GetMiners()
	fwCache := firmware.LoadCache(root)

	resp := model.MinersResponse{
		Configured: len(miners),
		Miners:     make([]model.MinerInfo, 0, len(miners)),
		BuildSHA:   version.GitSHA,
	}

	for _, miner := range miners {
		path := filepath.Join(root, miner.Ip, "latest.json")

		raw, err := decodeLatestJSON(path)
		if err != nil {
			log.Printf("ERROR: skipping miner %s: %v", miner.Ip, err)
			continue
		}

		latestVersion := fwCache.Models[miner.Model].Version
		info := toMinerInfo(raw, miner, latestVersion, cfg.Firmware.Repos[miner.Model], cfg.Pools.Dashboards)

		if status, ok := watcher.GetStatus(miner.Ip); ok {
			info.Alive = status.Alive
			info.AliveCheckedAt = status.CheckedAt.UTC().Format("2006-01-02T15:04:05Z")
		}

		resp.Miners = append(resp.Miners, info)
	}
	resp.Total = len(resp.Miners)

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		http.Error(w, "failed to encode response", http.StatusInternalServerError)
	}
}
