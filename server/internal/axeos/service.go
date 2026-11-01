package axeos

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/bitaxe"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
)

// RestartDelay is paused before every restart. The device's settings-update
// HTTP 200 only means the new settings were received, not that ESP-Miner
// has finished persisting them to flash (that write appears to happen
// asynchronously after the response) -- restarting immediately can race
// that write and reboot the miner back into its old pool settings. Var, not
// const, so tests can zero it out.
var RestartDelay = 2 * time.Second

type AxeOs struct {
	logger *slog.Logger
	cfg    config.Config
}

func NewAxeOs(logger *slog.Logger, config config.Config) AxeOs {
	return AxeOs{
		logger: logger,
		cfg:    config,
	}
}

// Restart sends a restart command to the device and reports whether it
// succeeded -- callers (the restart handler, and SwitchPool below) decide
// what to do with a failure; this only logs and returns it.
func (a AxeOs) Restart(miner config.Bitaxe) error {
	client := bitaxe.NewClient(a.logger, a.cfg.Endpoints.Restart, a.cfg.Endpoints.Timeout)

	// Let any just-sent settings update actually reach flash first (see
	// RestartDelay's doc comment) before rebooting the device.
	time.Sleep(RestartDelay)

	a.logger.Info("Restarting miner...", "ip", miner.Ip)
	if err := client.Restart(miner.Ip); err != nil {
		a.logger.Error("Failed to restart miner.", "ip", miner.Ip, "error", err)
		return fmt.Errorf("restart %s: %w", miner.Ip, err)
	}
	return nil
}

func (a AxeOs) SwitchPool(miner config.Bitaxe, poolType config.PoolTarget) error {
	settings, err := miner.GetPoolsSettings(poolType)
	if err != nil {
		a.logger.Error("Failed to get pool settings.", "ip", miner.Ip, "error", err)
		return fmt.Errorf("switch pool for %s: %w", miner.Ip, err)
	}

	return a.applyPools(miner, *settings, string(poolType))
}

// SwapPools swaps the two pools a non-Bitaxe holds right now, read from the
// device itself -- its pool switch from the UI. Its slots aren't always in
// miners.yml's order (a pool changed on the device, or a previous switch),
// and the device reports no flag the UI could tell its active pool from: a
// switch built from miners.yml could then send the very pool it's already
// on. Scheduled switches keep SwitchPool, whose target is explicit.
// Returns the device's slots before and after, for the audit.
func (a AxeOs) SwapPools(ctx context.Context, miner config.Bitaxe) (before, after config.BitaxeServerSettings, err error) {
	info, err := bitaxe.NewClient(a.logger, a.cfg.Endpoints.Info, a.cfg.Endpoints.Timeout).FetchSystemInfo(ctx, miner.Ip)
	if err != nil {
		return before, after, fmt.Errorf("swap pools for %s: %w", miner.Ip, err)
	}
	if err := json.Unmarshal(info, &before); err != nil {
		return before, after, fmt.Errorf("swap pools for %s: %w", miner.Ip, err)
	}
	if before.Url == "" || before.FallbackURL == "" {
		return before, after, fmt.Errorf("swap pools for %s: the device doesn't report two pools", miner.Ip)
	}

	after = config.BitaxeServerSettings{
		Url:          before.FallbackURL,
		Port:         before.FallbackPort,
		User:         before.FallbackUser,
		FallbackURL:  before.Url,
		FallbackPort: before.Port,
		FallbackUser: before.User,
	}
	return before, after, a.applyPools(miner, after, "swapped")
}

func (a AxeOs) applyPools(miner config.Bitaxe, settings config.BitaxeServerSettings, pool string) error {
	client := bitaxe.NewClient(a.logger, a.cfg.Endpoints.System, a.cfg.Endpoints.Timeout)
	if err := client.UpdateSystemStratumSettings(miner.Ip, settings); err != nil {
		a.logger.Error("Failed to update config.", "ip", miner.Ip, "error", err)
		return fmt.Errorf("switch pool for %s: %w", miner.Ip, err)
	}

	a.logger.Info("Pool enabled!", "ip", miner.Ip, "pool", pool)

	// The device took the new pools: a restart left unanswered then means
	// it's already rebooting (a nerdaxe reconnects to its new pool straight
	// away and can be too busy to answer), not that the switch failed.
	if err := a.Restart(miner); err != nil {
		var netErr net.Error
		if !errors.As(err, &netErr) || !netErr.Timeout() {
			return fmt.Errorf("switch pool for %s: %w", miner.Ip, err)
		}
		a.logger.Warn("No answer to the restart, the miner is likely rebooting already.", "ip", miner.Ip, "error", err)
	}
	return nil
}
