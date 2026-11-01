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
	device, err := a.ReadPools(ctx, miner)
	if err != nil {
		return before, after, fmt.Errorf("swap pools for %s: %w", miner.Ip, err)
	}
	before = device.Settings()
	if before.Url == "" || before.FallbackURL == "" {
		return before, after, fmt.Errorf("swap pools for %s: the device doesn't report two pools", miner.Ip)
	}

	after = swapped(before)
	return before, after, a.applyPools(miner, after, "swapped")
}

func swapped(s config.BitaxeServerSettings) config.BitaxeServerSettings {
	return config.BitaxeServerSettings{
		Url:          s.FallbackURL,
		Port:         s.FallbackPort,
		User:         s.FallbackUser,
		FallbackURL:  s.Url,
		FallbackPort: s.Port,
		FallbackUser: s.User,
	}
}

// Pool is a stratum pool, as a miner's slots hold it -- each miner keeps
// its own user on it.
type Pool struct {
	URL  string `json:"url"`
	Port int    `json:"port"`
}

func (p Pool) String() string {
	return fmt.Sprintf("%s:%d", p.URL, p.Port)
}

// ErrPoolNotHeld is a miner holding the pool asked for in neither slot.
var ErrPoolNotHeld = errors.New("the miner doesn't have this pool")

// ReadPools reads miner's pools off its device, now.
func (a AxeOs) ReadPools(ctx context.Context, miner config.Bitaxe) (config.DevicePools, error) {
	var device config.DevicePools
	info, err := bitaxe.NewClient(a.logger, a.cfg.Endpoints.Info, a.cfg.Endpoints.Timeout).FetchSystemInfo(ctx, miner.Ip)
	if err != nil {
		return device, err
	}
	err = json.Unmarshal(info, &device)
	return device, err
}

// SwitchToPool makes pool the one miner mines on, in whichever slot the
// device holds it: a switch of the whole fleet picks a pool, not a slot,
// since the slots needn't be in the same order on every miner. A bitaxe
// selects it with useFallbackStratum, a nerdaxe gets it in its primary
// slot. Returns the pool it was on, and whether anything was sent --
// nothing is to a miner already on pool, nor to one that doesn't have it
// (ErrPoolNotHeld).
func (a AxeOs) SwitchToPool(ctx context.Context, miner config.Bitaxe, pool Pool) (was Pool, switched bool, err error) {
	device, err := a.ReadPools(ctx, miner)
	if err != nil {
		return was, false, fmt.Errorf("switch %s to %s: %w", miner.Ip, pool, err)
	}

	slots := device.Settings()
	primary := Pool{URL: slots.Url, Port: slots.Port}
	fallback := Pool{URL: slots.FallbackURL, Port: slots.FallbackPort}
	onFallback := device.Stratum.UsingFallback
	if miner.Model == config.ModelBitaxe {
		onFallback = device.IsUsingFallbackStratum == 1
	}
	was = primary
	if onFallback {
		was = fallback
	}
	if was == pool {
		return was, false, nil
	}

	switch {
	case pool == primary:
		// A nerdaxe gets the same slots: the restart brings it back to its
		// primary one.
		slots.UseFallbackStratum = false
	case pool == fallback && miner.Model == config.ModelBitaxe:
		slots.UseFallbackStratum = true
	case pool == fallback:
		slots = swapped(slots)
	default:
		return was, false, ErrPoolNotHeld
	}
	return was, true, a.applyPools(miner, slots, pool.String())
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
