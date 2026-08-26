// cmd/dashboard-api/healthcheck/watcher.go
package healtcheck

import (
	"context"
	"encoding/json"
	"log/slog"
	"sync"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/bitaxe"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
)

type HealthStatus struct {
	Alive     bool
	CheckedAt time.Time

	// MacMismatch is true when the device actually responding at this IP
	// reports a MAC different from the one configured (mac:) -- a wrong
	// device at this address, or a config typo. ReportedMac is what it
	// actually said, for the error message.
	MacMismatch bool
	ReportedMac string
}

type Watcher struct {
	logger *slog.Logger

	config      config.Config
	minersStore *config.MinersStore
	ctx         context.Context
	cancel      context.CancelFunc
	statuses    sync.Map // map[string]HealthStatus
}

func NewWatcher(logger *slog.Logger, config config.Config) *Watcher {
	ctx, cancel := context.WithCancel(context.Background())

	return &Watcher{
		logger: logger.With("namespace", "HealthCheck"),
		config: config,
		ctx:    ctx,
		cancel: cancel,
	}
}

// WithMinersStore attaches the shared miners store this Watcher reloads
// config.Bitaxes from at the start of every Watch() cycle -- so a miner
// saved through the Settings UI starts getting health-checked on the next
// tick, without a restart. Optional: without one, Watch() just keeps using
// whatever Bitaxes it was constructed with, same as before this feature
// existed.
func (f *Watcher) WithMinersStore(store *config.MinersStore) *Watcher {
	f.minersStore = store
	return f
}

func (f *Watcher) Start(wg *sync.WaitGroup) {
	wg.Add(1)
	go func() {
		defer wg.Done()

		ticker := time.NewTicker(f.config.HealthCheck.Interval)
		defer ticker.Stop()

		f.Watch()

		for {
			select {
			case <-ticker.C:
				f.Watch()
			case <-f.ctx.Done():
				f.logger.Info("Health check stopped!")
				return
			}
		}
	}()
}

func (f *Watcher) Stop() {
	f.cancel()
}

// GetStatus returns the latest health status for a given miner IP.
func (f *Watcher) GetStatus(ip string) (HealthStatus, bool) {
	v, ok := f.statuses.Load(ip)
	if !ok {
		return HealthStatus{}, false
	}
	return v.(HealthStatus), true
}

// Watch pings all enabled miners once and stores each result -- exported
// so it can also be triggered synchronously (tests, or a manual refresh),
// not just via the background ticker started by Start().
func (f *Watcher) Watch() {
	f.logger.Info("Health check running...")

	if f.minersStore != nil {
		bitaxes, err := f.minersStore.Reload()
		if err != nil {
			f.logger.Error("failed to reload miners config", "error", err)
		}
		f.config.Bitaxes = bitaxes
	}

	client := bitaxe.NewClient(f.logger, f.config.Endpoints.Info, f.config.Endpoints.Timeout)

	for _, miner := range f.config.GetMiners() {
		addr := miner.Ip
		now := time.Now()

		response, err := client.FetchSystemInfo(f.ctx, addr)
		if err != nil {
			f.logger.Error("Ping failed!", "ip", addr, "error", err)
			f.statuses.Store(addr, HealthStatus{Alive: false, CheckedAt: now})
			continue
		}

		raw, err := parseAxeOsDeviceResponse(response, miner.Model)
		if err != nil {
			f.logger.Error("Parse response failed!", "ip", addr, "error", err, "data", response)
			f.statuses.Store(addr, HealthStatus{Alive: false, CheckedAt: now})
			continue
		}

		configuredMac := miner.StorageKey()
		reportedMac := config.NormalizeMac(raw.ToAxeOs().MacAddr)
		mismatch := configuredMac != "" && reportedMac != "" && reportedMac != configuredMac
		if mismatch {
			f.logger.Error("mac mismatch! wrong device at this ip, or a config typo?",
				"ip", addr, "configuredMac", configuredMac, "reportedMac", reportedMac)
		}

		f.logger.Info("Ping!", "ip", addr, "data", raw.ToAxeOs())
		f.statuses.Store(addr, HealthStatus{
			Alive: true, CheckedAt: now,
			MacMismatch: mismatch, ReportedMac: reportedMac,
		})
	}

	f.logger.Info("Health check completed!")
}

func parseAxeOsDeviceResponse(response []byte, model string) (AxeOsModel, error) {
	switch model {
	case "bitaxe":
		var v Bitaxe
		err := json.Unmarshal(response, &v)
		return v, err
	default:
		var v Nerdaxe
		err := json.Unmarshal(response, &v)
		return v, err
	}
}
