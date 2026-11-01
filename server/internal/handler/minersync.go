// internal/handler/minersync.go
package handler

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"sync"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/audit"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/axeos"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
)

// MinerSync is what the sync checked on one miner: the pools its device
// holds right now, and how miners.yml differs from them -- or why it
// couldn't be read.
type MinerSync struct {
	Ip      string              `json:"ip"`
	Mac     string              `json:"mac"`
	Device  *config.DevicePools `json:"device,omitempty"`
	Changes []audit.Change      `json:"changes,omitempty"`
	Error   string              `json:"error,omitempty"`
}

type minersSyncResponse struct {
	// Bitaxes is each miners.yml entry that differs, with its device's
	// pools -- what a POST /api/config/miners would save to sync it.
	Bitaxes []config.Bitaxe `json:"bitaxes"`
	Miners  []MinerSync     `json:"miners"`
}

// MinersSync reads every enabled miner's pools off its device, now, and
// returns how miners.yml differs from them -- nothing is written: saving
// the returned entries is what syncs the file.
//
// @Summary Compare miners.yml with the miners
// @Description Reads every enabled miner's pools from the device itself and returns, for each, the pools read and how miners.yml differs -- with the entries to save to sync it. Writes nothing.
// @Tags Configuration
// @Produce json
// @Success 200 {object} handler.minersSyncResponse
// @Router /api/config/miners/sync [get]
func MinersSync(logger *slog.Logger, cfg config.Config, w http.ResponseWriter, r *http.Request) {
	axeOs := axeos.NewAxeOs(logger, cfg)
	miners := cfg.GetMiners()
	synced := make([]*config.Bitaxe, len(miners))
	results := make([]MinerSync, len(miners))
	var wg sync.WaitGroup
	for i, miner := range miners {
		wg.Add(1)
		go func() {
			defer wg.Done()
			results[i], synced[i] = checkMiner(r.Context(), axeOs, miner)
		}()
	}
	wg.Wait()

	resp := minersSyncResponse{Bitaxes: []config.Bitaxe{}, Miners: results}
	for _, b := range synced {
		if b != nil {
			resp.Bitaxes = append(resp.Bitaxes, *b)
		}
	}
	writeJSON(w, resp)
}

// checkMiner is how miner's pools in miners.yml differ from its device's,
// and its entry to save to sync it -- nil when there's nothing to.
func checkMiner(ctx context.Context, axeOs axeos.AxeOs, miner config.Bitaxe) (MinerSync, *config.Bitaxe) {
	device, err := axeOs.ReadPools(ctx, miner)
	if err != nil {
		return MinerSync{Ip: miner.Ip, Mac: miner.Mac, Error: err.Error()}, nil
	}
	pools := device.Pools()
	// Another device at this IP: its pools aren't this miner's.
	if config.NormalizeMac(pools.MacAddr) != config.NormalizeMac(miner.Mac) {
		err := fmt.Errorf("the device at %s reports MAC %s, not %s", miner.Ip, pools.MacAddr, miner.Mac)
		return MinerSync{Ip: miner.Ip, Mac: miner.Mac, Error: err.Error()}, nil
	}

	changes := audit.PoolChanges(miner.Slots(), pools.Slots())
	result := MinerSync{Ip: miner.Ip, Mac: miner.Mac, Device: &pools, Changes: changes}
	if len(changes) == 0 {
		return result, nil
	}
	synced := miner.WithSlots(pools.Slots())
	return result, &synced
}
