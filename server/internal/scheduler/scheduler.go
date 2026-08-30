// cmd/dashboard-api/scheduler/scheduler.go
package scheduler

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/axeos"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/robfig/cron/v3"
)

type Scheduler struct {
	logger *slog.Logger
	config config.Config

	minersStore *config.MinersStore
	ctx         context.Context
	cancel      context.CancelFunc

	mu      sync.Mutex
	cron    *cron.Cron
	running bool

	// fingerprint is a condensed string of every enabled miner's
	// schedule (see the fingerprint() function below), captured each
	// time the cron jobs are (re)built. Comparing it against a freshly
	// computed one on each reload tick is how the scheduler tells "the
	// config actually changed, rebuild the jobs" apart from "nothing
	// changed, this tick is a no-op" -- without it, every tick would stop
	// and restart the cron for nothing.
	fingerprint string
}

func NewScheduler(logger *slog.Logger, config config.Config) *Scheduler {
	ctx, cancel := context.WithCancel(context.Background())

	s := &Scheduler{
		logger: logger.With("namespace", "Scheduler"),
		config: config,
		ctx:    ctx,
		cancel: cancel,
	}

	s.rebuild(config.GetMiners())

	return s
}

// WithMinersStore attaches the shared miners store this Scheduler reloads
// from on every reload tick (see Start) -- so a schedule saved through the
// Settings UI takes effect without a dashboard-api restart, the same way
// the healthcheck watcher already picks up miners.yml changes.
// Optional: without one, the scheduler just keeps running the jobs it was
// built with at construction time, same as before this feature existed.
func (s *Scheduler) WithMinersStore(store *config.MinersStore) *Scheduler {
	s.minersStore = store
	return s
}

// execute runs the one action a scheduled entry can trigger. Both
// SwitchPool and Restart already log internally on failure, so a caller
// looping over jobs (rebuild below) only needs the error to decide whether
// to log the (rare) "unknown action" case.
func execute(axeOs axeos.AxeOs, miner config.Bitaxe, action config.ScheduleAction) error {
	switch action {
	case config.ActionSwitchPrimary:
		return axeOs.SwitchPool(miner, config.Primary)
	case config.ActionSwitchFallback:
		return axeOs.SwitchPool(miner, config.Fallback)
	case config.ActionRestart:
		return axeOs.Restart(miner)
	default:
		return fmt.Errorf("unknown schedule action %q", action)
	}
}

// rebuild stops whatever cron instance is currently running (if any),
// builds a fresh one from bitaxes, and starts it if the scheduler had
// already been started -- safe to call both before the first Start() (at
// construction time) and later, after a reload noticed a change.
func (s *Scheduler) rebuild(bitaxes []config.Bitaxe) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.cron != nil {
		s.cron.Stop()
	}

	s.cron = cron.New(cron.WithSeconds(), cron.WithLocation(time.Local))
	axeOs := axeos.NewAxeOs(s.logger, s.config)

	s.logger.Info("Scheduler configure...")
	for _, miner := range bitaxes {
		for _, schedule := range miner.Schedule {
			s.logger.Info("New job scheduled!", "ip", miner.Ip, "cron", schedule.Cron, "action", schedule.Action)

			_, err := s.cron.AddFunc(schedule.Cron, func() {
				s.logger.Info("Running scheduled action!", "ip", miner.Ip, "action", schedule.Action)

				if err := execute(axeOs, miner, schedule.Action); err != nil {
					s.logger.Error("Scheduled action failed!", "ip", miner.Ip, "action", schedule.Action, "error", err)
				}
			})

			if err != nil {
				s.logger.Error("Failed to add new scheduled job!", "ip", miner.Ip, "cron", schedule.Cron, "action", schedule.Action, "error", err)
				continue
			}
		}
	}
	s.logger.Info("Scheduler completed.")

	s.fingerprint = fingerprint(bitaxes)
	if s.running {
		s.cron.Start()
	}
}

// fingerprint condenses every enabled miner's schedule into a string --
// cheap to compare between reload ticks, so a reload that found no actual
// change to schedule (the common case: nothing changed on disk, or an
// unrelated field like ip/hostname changed) doesn't stop and restart the
// cron for nothing.
func fingerprint(bitaxes []config.Bitaxe) string {
	var b strings.Builder
	for _, miner := range bitaxes {
		for _, schedule := range miner.Schedule {
			b.WriteString(miner.Ip)
			b.WriteByte('|')
			b.WriteString(schedule.Cron)
			b.WriteByte('|')
			b.WriteString(string(schedule.Action))
			b.WriteByte(';')
		}
	}
	return b.String()
}

func (s *Scheduler) Start() {
	s.logger.Info("Scheduler running...")

	s.mu.Lock()
	s.running = true
	s.cron.Start()
	s.mu.Unlock()

	if s.minersStore == nil {
		return
	}

	go func() {
		ticker := time.NewTicker(s.config.HealthCheck.Interval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				s.reload()
			case <-s.ctx.Done():
				return
			}
		}
	}()
}

// reload re-reads miners.yml via the shared store and rebuilds the cron
// jobs only if a miner's schedule actually changed -- cheap to call every
// tick (MinersStore.Reload itself is a no-op past one os.Stat when the
// file's mtime hasn't moved).
func (s *Scheduler) reload() {
	bitaxes, err := s.minersStore.Reload()
	if err != nil {
		s.logger.Error("failed to reload miners config", "error", err)
		return
	}

	cfg := s.config
	cfg.Bitaxes = bitaxes
	enabled := cfg.GetMiners()

	s.mu.Lock()
	changed := fingerprint(enabled) != s.fingerprint
	s.mu.Unlock()
	if !changed {
		return
	}

	s.logger.Info("Schedule changed, rebuilding jobs...")
	s.rebuild(enabled)
}

func (s *Scheduler) Stop() {
	s.logger.Info("Scheduler stopped!")
	s.cancel()

	s.mu.Lock()
	defer s.mu.Unlock()
	s.running = false
	s.cron.Stop()
}
