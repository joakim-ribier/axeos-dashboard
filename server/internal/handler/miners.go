// internal/handler/miners.go
package handler

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"path/filepath"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/firmware"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/healtcheck"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/model"
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
	}

	for _, miner := range miners {
		key := miner.StorageKey()
		if key == "" {
			// Already logged loudly once at startup (config.MissingMacWarnings) --
			// this endpoint can be hit every few seconds by the UI's auto-refresh,
			// so logging here too would just spam the same message forever.
			continue
		}

		status, hasStatus := watcher.GetStatus(miner.Ip)

		path := filepath.Join(root, key, "latest.json")
		raw, err := decodeLatestJSON(path)
		if err != nil {
			if hasStatus && status.MacMismatch {
				// The feeder has refused every single poll since this mac
				// was configured (wrong mac from the start, or swapped with
				// another miner's) -- latest.json never got written, but the
				// miner must still surface as an error, not vanish silently.
				resp.Miners = append(resp.Miners, model.MinerInfo{
					IP:             miner.Ip,
					Hostname:       miner.Hostname,
					DeviceModel:    string(miner.Model),
					Alive:          status.Alive,
					AliveCheckedAt: status.CheckedAt.UTC().Format("2006-01-02T15:04:05Z"),
					Error:          fmt.Sprintf("configured mac %s doesn't match the device's reported %s", key, status.ReportedMac),
				})
				continue
			}
			log.Printf("ERROR: skipping miner %s: %v", miner.Ip, err)
			continue
		}

		latestVersion := fwCache.Models[string(miner.Model)].Version
		info := toMinerInfo(raw, miner, latestVersion, cfg.Firmware.Repos[string(miner.Model)], cfg.Pools.Dashboards)

		if totals, err := decodeTotalsJSON(filepath.Join(root, key, "totals.json")); err == nil {
			info.TotalUptimeSeconds = totals.TotalUptimeSeconds
			info.TotalSharesAccepted = totals.TotalSharesAccepted
			info.TotalSharesRejected = totals.TotalSharesRejected
		}

		if hasStatus {
			info.Alive = status.Alive
			info.AliveCheckedAt = status.CheckedAt.UTC().Format("2006-01-02T15:04:05Z")
			if status.MacMismatch {
				info.Error = fmt.Sprintf("configured mac %s doesn't match the device's reported %s", key, status.ReportedMac)
			}
		}

		resp.Miners = append(resp.Miners, info)
	}
	resp.Total = len(resp.Miners)

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		http.Error(w, "failed to encode response", http.StatusInternalServerError)
	}
}
