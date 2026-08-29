package axeos

import (
	"log/slog"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/bitaxe"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
)

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

func (a AxeOs) Restart(miner config.Bitaxe) {
	client := bitaxe.NewClient(a.logger, a.cfg.Endpoints.Restart, a.cfg.Endpoints.Timeout)

	a.logger.Info("Restarting miner...", "ip", miner.Ip)
	if err := client.Restart(miner.Ip); err != nil {
		a.logger.Error("Failed to restart miner.", "ip", miner.Ip, "error", err)
	}
}

func (a AxeOs) SwitchPool(miner config.Bitaxe, poolType config.PoolTarget) {
	client := bitaxe.NewClient(a.logger, a.cfg.Endpoints.System, a.cfg.Endpoints.Timeout)

	settings, err := miner.GetPoolsSettings(poolType)
	if err != nil {
		a.logger.Error("Failed to get pool settings.", "ip", miner.Ip, "error", err)
		return
	}

	if err := client.UpdateSystemStratumSettings(miner.Ip, *settings); err != nil {
		a.logger.Error("Failed to update config.", "ip", miner.Ip, "error", err)
		return
	}

	a.logger.Info("Pool enabled!", "ip", miner.Ip, "pool", poolType)

	a.Restart(miner)
}

func (a AxeOs) SetWifi(miner config.Bitaxe) {
	client := bitaxe.NewClient(a.logger, a.cfg.Endpoints.System, a.cfg.Endpoints.Timeout)

	bitaxeWifiSettings := miner.GetWifiSettings(a.cfg.Wifi)
	if err := client.UpdateSystemWifiSettings(miner.Ip, bitaxeWifiSettings); err != nil {
		a.logger.Error("Failed to update wifi settings.", "ip", miner.Ip, "error", err)
		return
	}
	a.logger.Info("Wifi settings updated successfully.", "ip", miner.Ip)

	a.Restart(miner)
}
