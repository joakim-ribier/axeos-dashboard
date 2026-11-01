// internal/handler/settings.go
package handler

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/audit"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/axeos"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
)

// ---------------------------------------------------------------------------
// HTTP handlers
// ---------------------------------------------------------------------------

// SwitchPool switches the given miner(s) to the primary or fallback stratum
// pool and restarts each affected device to apply the change. Returns the
// audit entry of each non-Bitaxe whose slots were swapped.
//
// @Summary Switch stratum pool
// @Description Switches miner(s) to the primary or fallback pool and restarts them to apply it.
// @Tags Miner actions
// @Param miner query string false "Miner IP or hostname — omit to apply to all configured miners"
// @Success 204 "No Content"
// @Failure 502 {object} handler.ErrorResponse "one or more miners didn't apply the change (unreachable, or rejected the request)"
// @Router /api/miners/pool/primary/enable [put]
// @Router /api/miners/pool/fallback/enable [put]
func SwitchPool(logger *slog.Logger, cfg config.Config, poolTarget config.PoolTarget, w http.ResponseWriter, r *http.Request) []audit.Entry {
	axeOs := axeos.NewAxeOs(logger, cfg)
	var errs []error
	var swaps []audit.Entry
	for _, miner := range cfg.GetMinersFilterBy(r.URL.Query().Get("miner")) {
		// The UI offers a non-Bitaxe a switch to its fallback only (it never
		// reports using it), which means swapping its two slots.
		var err error
		if miner.Model != config.ModelBitaxe && poolTarget == config.Fallback {
			var before, after config.BitaxeServerSettings
			before, after, err = axeOs.SwapPools(r.Context(), miner)
			if err == nil {
				swaps = append(swaps, audit.PoolSwap(miner, before, after))
			}
		} else {
			err = axeOs.SwitchPool(miner, poolTarget)
		}
		if err != nil {
			errs = append(errs, err)
		}
	}
	if len(errs) > 0 {
		writeErrorResponse(w, errors.Join(errs...).Error(), http.StatusBadGateway)
		return swaps
	}
	w.WriteHeader(204)
	return swaps
}

// Restart sends a restart command to the given device via its AxeOs restart endpoint.
//
// @Summary Restart a miner
// @Description Restarts the device via its AxeOs restart endpoint.
// @Tags Miner actions
// @Param hostnameOrIp path string true "Miner IP or configured hostname"
// @Success 204 "No Content"
// @Failure 404 {object} handler.ErrorResponse "miner not found"
// @Failure 502 {object} handler.ErrorResponse "the miner is unreachable or rejected the restart request"
// @Router /api/miners/{hostnameOrIp}/restart [post]
func Restart(miner config.Bitaxe, logger *slog.Logger, cfg config.Config, w http.ResponseWriter) {
	if err := axeos.NewAxeOs(logger, cfg).Restart(miner); err != nil {
		writeErrorResponse(w, err.Error(), http.StatusBadGateway)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
