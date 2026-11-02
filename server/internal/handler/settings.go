// internal/handler/settings.go
package handler

import (
	"context"
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

// SwitchPool switches the given miner(s) to the primary or fallback pool
// they hold -- as each device holds it right now, not miners.yml -- and
// restarts each to apply it. Returns each miner's audit entry.
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
	var entries []audit.Entry
	for _, miner := range cfg.GetMinersFilterBy(r.URL.Query().Get("miner")) {
		was, now, err := axeOs.ActivateSlot(r.Context(), miner, poolTarget)
		entries = append(entries, audit.PoolSwitched(switchTypes[poolTarget], miner.Ip, was, now, http.StatusNoContent, err))
		if err != nil {
			errs = append(errs, err)
		}
	}
	if len(errs) > 0 {
		writeErrorResponse(w, errors.Join(errs...).Error(), http.StatusBadGateway)
		return entries
	}
	w.WriteHeader(http.StatusNoContent)
	return entries
}

// switchTypes is the audit type of a switch to each slot.
var switchTypes = map[config.PoolTarget]string{
	config.Primary:  audit.TypeSwitchPrimary,
	config.Fallback: audit.TypeSwitchFallback,
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
	pool := config.Pool{URL: r.URL.Query().Get("url"), Port: port}
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
			results[i], entries[i] = switchMinerToPool(r.Context(), axeOs, miner, pool)
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

// switchMinerToPool is what switching miner to pool did, and its audit
// entry -- nil when nothing was sent to it.
func switchMinerToPool(ctx context.Context, axeOs axeos.AxeOs, miner config.Bitaxe, pool config.Pool) (PoolSwitchResult, *audit.Entry) {
	was, switched, err := axeOs.SwitchToPool(ctx, miner, pool)
	entry := audit.PoolSwitched(audit.TypeSwitchPool, miner.Ip, was, pool, http.StatusOK, err)
	switch {
	case errors.Is(err, config.ErrPoolNotHeld):
		return PoolSwitchResult{Ip: miner.Ip, Status: "missing"}, nil
	case err != nil:
		return PoolSwitchResult{Ip: miner.Ip, Status: "failed", Error: err.Error()}, &entry
	case !switched:
		return PoolSwitchResult{Ip: miner.Ip, Status: "already"}, nil
	}
	return PoolSwitchResult{Ip: miner.Ip, Status: "switched"}, &entry
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
