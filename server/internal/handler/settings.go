// internal/handler/settings.go
package handler

import (
	"fmt"
	"log/slog"
	"net/http"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/axeos"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
)

// ---------------------------------------------------------------------------
// HTTP handlers
// ---------------------------------------------------------------------------

func SwitchPool(logger *slog.Logger, cfg config.Config, poolTarget config.PoolTarget, w http.ResponseWriter, r *http.Request) {
	axeOs := axeos.NewAxeOs(logger, cfg)
	for _, miner := range cfg.GetMinersFilterBy(r.URL.Query().Get("miner")) {
		axeOs.SwitchPool(miner, poolTarget)
	}
	w.WriteHeader(204)
}

func SetWifi(logger *slog.Logger, cfg config.Config, w http.ResponseWriter, r *http.Request) {
	if !cfg.Wifi.On {
		w.WriteHeader(405)
		r := `{"error":"Update Wifi settings is disabled by the server."}`
		if _, err := w.Write([]byte(r)); err != nil {
			logger.Error(fmt.Sprintf("Error to write: %s", r), "error", err)
		}
		return
	}
	axeOs := axeos.NewAxeOs(logger, cfg)
	for _, miner := range cfg.GetMinersFilterBy(r.URL.Query().Get("miner")) {
		axeOs.SetWifi(miner)
	}
	w.WriteHeader(204)
}

func Restart(miner config.Bitaxe, logger *slog.Logger, cfg config.Config, w http.ResponseWriter) {
	axeos.NewAxeOs(logger, cfg).Restart(miner)
	w.WriteHeader(http.StatusNoContent)
}
