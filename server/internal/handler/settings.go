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

// SwitchPool switches the given miner(s) to the primary or fallback stratum
// pool and restarts each affected device to apply the change.
//
// @Summary Switch stratum pool
// @Description Switches miner(s) to the primary or fallback pool and restarts them to apply it.
// @Tags dashboard-api
// @Param miner query string false "Miner IP or hostname — omit to apply to all configured miners"
// @Success 204 "No Content"
// @Router /api/miners/pool/primary/enable [put]
// @Router /api/miners/pool/fallback/enable [put]
func SwitchPool(logger *slog.Logger, cfg config.Config, poolTarget config.PoolTarget, w http.ResponseWriter, r *http.Request) {
	axeOs := axeos.NewAxeOs(logger, cfg)
	for _, miner := range cfg.GetMinersFilterBy(r.URL.Query().Get("miner")) {
		axeOs.SwitchPool(miner, poolTarget)
	}
	w.WriteHeader(204)
}

// SetWifi pushes new WiFi credentials to the given miner(s) and restarts them.
// Disabled (405) unless wifi.on is true in config.
//
// @Summary Update WiFi credentials
// @Description Pushes the configured WiFi SSID/password to miner(s) and restarts them. Disabled unless wifi.on is set in config.
// @Tags dashboard-api
// @Param miner query string false "Miner IP or hostname — omit to apply to all configured miners"
// @Success 204 "No Content"
// @Failure 405 {object} handler.ErrorResponse "WiFi updates disabled by config"
// @Router /api/miners/set/wifi [put]
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

// Restart sends a restart command to the given device via its AxeOs restart endpoint.
//
// @Summary Restart a miner
// @Description Restarts the device via its AxeOs restart endpoint.
// @Tags dashboard-api
// @Param hostnameOrIp path string true "Miner IP or configured hostname"
// @Success 204 "No Content"
// @Failure 404 {object} handler.ErrorResponse "miner not found"
// @Router /api/miners/{hostnameOrIp}/restart [post]
func Restart(miner config.Bitaxe, logger *slog.Logger, cfg config.Config, w http.ResponseWriter) {
	axeos.NewAxeOs(logger, cfg).Restart(miner)
	w.WriteHeader(http.StatusNoContent)
}
