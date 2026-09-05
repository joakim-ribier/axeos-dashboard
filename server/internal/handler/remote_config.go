// internal/handler/remote_config.go
package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
)

// boardConfigDir returns the directory hashboard writes a board's pushed
// miners/settings config into (see hashboard's storage.WriteConfig) --
// alongside boardDataRoot's per-miner bitaxes/ directory, not inside it.
func boardConfigDir(dataDir, boardID string) string {
	return filepath.Join(dataDir, boardID, "config")
}

// RemoteMinersConfig handles GET /api/{boardId}/config/miners -- serves the
// managed miners list the feeder last pushed (see
// cmd/feeder.pushMinersConfigToRemote), shaped identically to dashboard-api's
// own GET /api/config/miners so the same React table renders unchanged for a
// remote board.
//
// @Summary List a remote board's configured miners (read-only)
// @Description Returns the managed miners list last pushed to hashboard for this board.
// @Tags remote-dashboard-api
// @Produce json
// @Param boardId path string true "hashboard board ID"
// @Success 200 {object} handler.bitaxesResponse
// @Failure 404 {object} handler.ErrorResponse "no miners config ever pushed for this board"
// @Router /api/{boardId}/config/miners [get]
func RemoteMinersConfig(cfg config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		boardID := chi.URLParam(r, "boardId")
		path := filepath.Join(boardConfigDir(cfg.Storage.ResolveBoardsDir(), boardID), "miners.json")

		var pushed struct {
			Bitaxes []config.Bitaxe `json:"bitaxes"`
		}
		lastUpdated, err := readBoardConfigFile(path, &pushed)
		if err != nil {
			writeErrorResponse(w, fmt.Sprintf("no miners config pushed yet for board '%s'", boardID), http.StatusNotFound)
			return
		}

		writeBitaxesResponse(w, pushed.Bitaxes, lastUpdated)
	}
}

// RemoteAppSettings handles GET /api/{boardId}/config/settings -- serves the
// app settings the feeder last pushed (see
// cmd/feeder.pushSettingsConfigToRemote), shaped identically to
// dashboard-api's own GET /api/config/settings so the same React form
// renders unchanged for a remote board. Remote is always returned redacted
// ("", ""): the feeder never sends push credentials in the first place (see
// cmd/feeder.configSettingsPush), and a read-only remote view has no
// business editing/seeing them even if it somehow did. Of ReadOnly's
// process-launch settings, only FirmwareCacheCheckedAt is ever populated --
// the feeder pushes that one value alongside settings (see
// cmd/feeder.configSettingsPush) as a minimal "is the source Pi's feeder
// still alive" signal; the interval/TTL settings themselves describe the
// source deployment's own dashboard.yml, which a remote board has no access
// to at all -- left blank rather than invented.
//
// @Summary Get a remote board's app settings (read-only)
// @Description Returns the app settings last pushed to hashboard for this board, with remote push credentials always redacted.
// @Tags remote-dashboard-api
// @Produce json
// @Param boardId path string true "hashboard board ID"
// @Success 200 {object} handler.appSettingsResponse
// @Failure 404 {object} handler.ErrorResponse "no settings ever pushed for this board"
// @Router /api/{boardId}/config/settings [get]
func RemoteAppSettings(cfg config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		boardID := chi.URLParam(r, "boardId")
		path := filepath.Join(boardConfigDir(cfg.Storage.ResolveBoardsDir(), boardID), "settings.json")

		var pushed struct {
			Electricity            config.ElectricityConfig   `json:"electricity"`
			Pools                  config.PoolsConfig         `json:"pools"`
			Firmware               config.AppSettingsFirmware `json:"firmware"`
			FirmwareCacheCheckedAt string                     `json:"firmwareCacheCheckedAt"`
		}
		lastUpdated, err := readBoardConfigFile(path, &pushed)
		if err != nil {
			writeErrorResponse(w, fmt.Sprintf("no settings pushed yet for board '%s'", boardID), http.StatusNotFound)
			return
		}

		settings := config.AppSettingsFile{
			Electricity: pushed.Electricity,
			Pools:       pushed.Pools,
			Firmware:    pushed.Firmware,
		}
		if settings.Pools.Dashboards == nil {
			settings.Pools.Dashboards = map[string]string{}
		}
		if settings.Firmware.Repos == nil {
			settings.Firmware.Repos = map[config.Model]string{}
		}

		resp := appSettingsResponse{
			AppSettingsFile: settings,
			Defaults:        defaultAppSettings(),
			ReadOnly:        appSettingsReadOnly{FirmwareCacheCheckedAt: pushed.FirmwareCacheCheckedAt},
			LastUpdated:     lastUpdated,
		}
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(resp); err != nil {
			http.Error(w, "failed to encode response", http.StatusInternalServerError)
		}
	}
}

// readBoardConfigFile decodes path's JSON content into v and returns the
// file's mtime as RFC3339 (UTC) -- the shared read side of boardConfigDir,
// used by both RemoteMinersConfig and RemoteAppSettings.
func readBoardConfigFile(path string, v any) (string, error) {
	info, err := os.Stat(path)
	if err != nil {
		return "", err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	if err := json.Unmarshal(data, v); err != nil {
		return "", err
	}
	return info.ModTime().UTC().Format(time.RFC3339), nil
}
