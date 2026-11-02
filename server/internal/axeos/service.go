package axeos

import (
	"context"
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

// ActivateSlot makes target's slot, as the miner's device holds it right
// now, the active one -- a switch from the UI, where the miner itself is
// the truth, not miners.yml: its slots needn't be in miners.yml's order (a
// pool changed on the device, a nerdaxe's previous switch). Scheduled
// switches keep SwitchPool, from miners.yml. Returns the pool it was on and
// the one it's switched to.
func (a AxeOs) ActivateSlot(ctx context.Context, miner config.Bitaxe, target config.PoolTarget) (was, now config.Pool, err error) {
	pools, active, err := a.ReadPools(ctx, miner)
	if err != nil {
		return was, now, fmt.Errorf("switch %s to its %s pool: %w", miner.Ip, target, err)
	}
	slots := pools.Slots()
	was, now = slots.Slot(active).Pool, slots.Slot(target).Pool
	if now.URL == "" {
		return was, now, fmt.Errorf("switch %s to its %s pool: the device has none", miner.Ip, target)
	}
	return was, now, a.applyPools(miner, slots.Activating(miner.Model, target), now.String())
}

// ReadPools reads miner's pools and MAC off its device, now, and the slot
// it mines on, as its model tells them.
func (a AxeOs) ReadPools(ctx context.Context, miner config.Bitaxe) (config.DevicePools, config.PoolTarget, error) {
	info, err := bitaxe.NewClient(a.logger, a.cfg.Endpoints.Info, a.cfg.Endpoints.Timeout).FetchSystemInfo(ctx, miner.Ip)
	if err != nil {
		return config.DevicePools{}, "", err
	}
	return config.ParseMinerPools(miner.Model, info)
}

// SwitchToPool makes pool the one miner mines on, in whichever slot the
// device holds it: a switch of the whole fleet picks a pool, not a slot,
// since the slots needn't be in the same order on every miner (see
// config.BitaxeServerSettings.Activating for how each model activates it).
// Returns the pool it was on, and whether anything was sent -- nothing is
// to a miner already on pool, nor to one that doesn't have it
// (config.ErrPoolNotHeld).
func (a AxeOs) SwitchToPool(ctx context.Context, miner config.Bitaxe, pool config.Pool) (was config.Pool, switched bool, err error) {
	pools, active, err := a.ReadPools(ctx, miner)
	if err != nil {
		return was, false, fmt.Errorf("switch %s to %s: %w", miner.Ip, pool, err)
	}

	slots := pools.Slots()
	was = slots.Slot(active).Pool
	if was == pool {
		return was, false, nil
	}
	target, err := slots.Holding(pool)
	if err != nil {
		return was, false, err
	}
	return was, true, a.applyPools(miner, slots.Activating(miner.Model, target), pool.String())
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
