// cmd/dashboard-api/healthcheck/watcher.go
package healtcheck

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/joakim-ribier/go-utils/pkg/jsonsutil"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/bitaxe"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
)

type HealthStatus struct {
	Alive     bool
	CheckedAt time.Time
}

type Watcher struct {
	logger *slog.Logger

	config   config.Config
	ctx      context.Context
	cancel   context.CancelFunc
	statuses sync.Map // map[string]HealthStatus
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

func (f *Watcher) Start(wg *sync.WaitGroup) {
	wg.Add(1)
	go func() {
		defer wg.Done()

		ticker := time.NewTicker(f.config.HealthCheck.Interval)
		defer ticker.Stop()

		f.watch()

		for {
			select {
			case <-ticker.C:
				f.watch()
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

// watch pings all enabled miners and stores the result.
func (f *Watcher) watch() {
	f.logger.Info("Health check running...")

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

		f.logger.Info("Ping!", "ip", addr, "data", raw.ToAxeOs())
		f.statuses.Store(addr, HealthStatus{Alive: true, CheckedAt: now})
	}

	f.logger.Info("Health check completed!")
}

func parseAxeOsDeviceResponse(response []byte, model string) (AxeOsModel, error) {
	switch model {
	case "bitaxe":
		return jsonsutil.Unmarshal[Bitaxe](response)
	default:
		return jsonsutil.Unmarshal[Nerdaxe](response)
	}
}
