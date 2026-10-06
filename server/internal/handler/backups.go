// internal/handler/backups.go
package handler

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"slices"
	"strings"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/backup"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
)

type BackupsResponse struct {
	Data []backup.Info `json:"data"`
}

// ListBackups handles GET /api/backups.
//
// @Summary List monthly backups
// @Description Returns the monthly backup archives, most recent first. The feeder adds each completed (UTC) day to its month's archive, so the current month's archive is complete up to yesterday.
// @Tags dashboard-api
// @Produce json
// @Success 200 {object} handler.BackupsResponse
// @Router /api/backups [get]
func ListBackups(cfg config.Config, w http.ResponseWriter, _ *http.Request) {
	backups, err := backup.List(cfg.Storage.BackupsDir())
	if err != nil {
		writeErrorResponse(w, fmt.Sprintf("failed to list backups: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(BackupsResponse{Data: backups}); err != nil {
		writeErrorResponse(w, "failed to encode response", http.StatusInternalServerError)
	}
}

// DownloadBackups handles GET /api/backups/download?months=YYYY-MM,YYYY-MM.
//
// @Summary Download monthly backups
// @Description Returns one zip holding the given months' archives (up to yesterday for the current month): every miner's daily JSONL files under data/bitaxes/ -- unzip into storage.dataDir to restore.
// @Tags dashboard-api
// @Produce application/zip
// @Param months query string true "Comma-separated months, YYYY-MM"
// @Success 200 {file} file
// @Failure 400 {object} handler.ErrorResponse "invalid or missing months"
// @Failure 404 {object} handler.ErrorResponse "no backup for one of the months"
// @Router /api/backups/download [get]
func DownloadBackups(logger *slog.Logger, cfg config.Config, w http.ResponseWriter, r *http.Request) {
	months := strings.Split(r.URL.Query().Get("months"), ",")
	slices.Sort(months)
	months = slices.Compact(months)
	backupsDir := cfg.Storage.BackupsDir()
	for _, month := range months {
		if !backup.ValidMonth(month) {
			writeErrorResponse(w, "months must be a comma-separated list of YYYY-MM", http.StatusBadRequest)
			return
		}
		// Checked upfront: once Merge starts streaming, the status is
		// already sent and a missing month could only truncate the zip.
		if _, err := os.Stat(backup.Path(backupsDir, month)); err != nil {
			writeErrorResponse(w, fmt.Sprintf("no backup for %s", month), http.StatusNotFound)
			return
		}
	}

	name := fmt.Sprintf("axeos-backup-%s.zip", months[0])
	if len(months) > 1 {
		name = fmt.Sprintf("axeos-backup-%s_%s.zip", months[0], months[len(months)-1])
	}
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", name))
	if err := backup.Merge(w, backupsDir, months); err != nil {
		logger.Error("failed to stream merged backup", "error", err)
	}
}
