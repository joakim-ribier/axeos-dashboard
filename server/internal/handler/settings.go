// internal/handler/settings.go
package handler

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"sync"

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

// PoolSwitchResult is what a switch of the fleet to a pool did on one
// miner: switched, already (on it), missing (it doesn't have it), or failed.
type PoolSwitchResult struct {
	Ip     string `json:"ip"`
	Status string `json:"status"`
	Error  string `json:"error,omitempty"`
}

type PoolSwitchResponse struct {
	Miners []PoolSwitchResult `json:"miners"`
}

// SwitchToPool switches every enabled miner that has the pool, in either
// slot, to it -- all at once, each switch restarting its miner. Returns
// the audit entry of each miner it sent something to.
//
// @Summary Switch every miner to a pool
// @Description Switches every enabled miner holding this pool (in either slot) to it, then restarts it. A miner already on it, or without it, is left as it is.
// @Tags Miner actions
// @Param url query string true "The pool's URL"
// @Param port query int true "The pool's port"
// @Success 200 {object} handler.PoolSwitchResponse "what was done on each miner"
// @Failure 400 {object} handler.ErrorResponse "url or port missing"
// @Router /api/miners/pool/switch [put]
func SwitchToPool(logger *slog.Logger, cfg config.Config, w http.ResponseWriter, r *http.Request) []audit.Entry {
	port, err := strconv.Atoi(r.URL.Query().Get("port"))
	pool := axeos.Pool{URL: r.URL.Query().Get("url"), Port: port}
	if pool.URL == "" || err != nil || port <= 0 {
		writeErrorResponse(w, "url and port are required", http.StatusBadRequest)
		return nil
	}

	axeOs := axeos.NewAxeOs(logger, cfg)
	miners := cfg.GetMiners()
	results := make([]PoolSwitchResult, len(miners))
	entries := make([]*audit.Entry, len(miners))
	var wg sync.WaitGroup
	for i, miner := range miners {
		wg.Add(1)
		go func() {
			defer wg.Done()
			was, switched, err := axeOs.SwitchToPool(r.Context(), miner, pool)
			result := PoolSwitchResult{Ip: miner.Ip}
			switch {
			case errors.Is(err, axeos.ErrPoolNotHeld):
				result.Status = "missing"
			case err != nil:
				result.Status, result.Error = "failed", err.Error()
				entries[i] = &audit.Entry{Type: audit.TypeSwitchPool, Target: miner.Ip, Status: http.StatusBadGateway, Error: err.Error()}
			case switched:
				result.Status = "switched"
				entries[i] = &audit.Entry{
					Type: audit.TypeSwitchPool, Target: miner.Ip, Status: http.StatusOK,
					Changes: []audit.Change{{Field: "pool", Kind: audit.ChangeChanged, Before: was.String(), After: pool.String()}},
				}
			default:
				result.Status = "already"
			}
			results[i] = result
		}()
	}
	wg.Wait()

	writeJSON(w, PoolSwitchResponse{Miners: results})
	var recorded []audit.Entry
	for _, e := range entries {
		if e != nil {
			recorded = append(recorded, *e)
		}
	}
	return recorded
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
