package axeos

import (
	"fmt"
	"log/slog"
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
	client := bitaxe.NewClient(a.logger, a.cfg.Endpoints.System, a.cfg.Endpoints.Timeout)

	settings, err := miner.GetPoolsSettings(poolType)
	if err != nil {
		a.logger.Error("Failed to get pool settings.", "ip", miner.Ip, "error", err)
		return fmt.Errorf("switch pool for %s: %w", miner.Ip, err)
	}

	if err := client.UpdateSystemStratumSettings(miner.Ip, *settings); err != nil {
		a.logger.Error("Failed to update config.", "ip", miner.Ip, "error", err)
		return fmt.Errorf("switch pool for %s: %w", miner.Ip, err)
	}

	a.logger.Info("Pool enabled!", "ip", miner.Ip, "pool", poolType)

	if err := a.Restart(miner); err != nil {
		return fmt.Errorf("switch pool for %s: %w", miner.Ip, err)
	}
	return nil
}
