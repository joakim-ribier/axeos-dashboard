package scheduler

import (
	"io"
	"log/slog"
	"path/filepath"
	"testing"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
)

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func TestNewScheduler_registersJobsForEnabledMinersOnly(t *testing.T) {
	cfg := config.Config{
		Bitaxes: []config.Bitaxe{
			{
				Ip: "10.0.0.1", Enabled: true,
				Schedule: []config.CronSchedule{
					{Cron: "0 0 0 * * SAT", Action: config.ActionSwitchFallback},
					{Cron: "0 0 0 * * MON", Action: config.ActionSwitchPrimary},
				},
			},
			{
				Ip: "10.0.0.2", Enabled: true,
				Schedule: []config.CronSchedule{
					{Cron: "0 30 12 * * *", Action: config.ActionRestart},
				},
			},
			{
				// Disabled miners are filtered out by config.GetMiners() and must not get any job.
				Ip: "10.0.0.3", Enabled: false,
				Schedule: []config.CronSchedule{
					{Cron: "0 0 0 * * SAT", Action: config.ActionSwitchFallback},
				},
			},
		},
	}

	s := NewScheduler(testLogger(), cfg)

	if got, want := len(s.cron.Entries()), 3; got != want {
		t.Errorf("registered cron entries = %d, want %d", got, want)
	}
}

func TestNewScheduler_invalidCronExpressionIsSkipped(t *testing.T) {
	cfg := config.Config{
		Bitaxes: []config.Bitaxe{
			{
				Ip: "10.0.0.1", Enabled: true,
				Schedule: []config.CronSchedule{
					{Cron: "not a valid cron expression", Action: config.ActionSwitchFallback},
					{Cron: "0 0 0 * * SAT", Action: config.ActionSwitchPrimary},
				},
			},
		},
	}

	s := NewScheduler(testLogger(), cfg)

	if got, want := len(s.cron.Entries()), 1; got != want {
		t.Errorf("registered cron entries = %d, want %d (the invalid expression must be skipped, not crash)", got, want)
	}
}

func TestScheduler_startAndStopDoNotPanic(t *testing.T) {
	cfg := config.Config{Bitaxes: []config.Bitaxe{
		{Ip: "10.0.0.1", Enabled: true, Schedule: []config.CronSchedule{
			{Cron: "0 0 0 * * SAT", Action: config.ActionSwitchFallback},
		}},
	}}

	s := NewScheduler(testLogger(), cfg)
	s.Start()
	s.Stop()
}

// entryCount reads the current cron entry count under the scheduler's own
// mutex -- needed because Start() runs a background reload goroutine that
// can reassign s.cron concurrently (see rebuild); reading s.cron directly
// from a test without this would race under `go test -race`.
func (s *Scheduler) entryCount() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.cron.Entries())
}

func TestScheduler_reloadRebuildsJobsWhenScheduleChangesOnDisk(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "miners.yml")

	initial := []config.Bitaxe{{Ip: "10.0.0.1", Enabled: true}}
	if err := config.SaveMiners(path, initial); err != nil {
		t.Fatalf("seed miners file: %v", err)
	}

	store := config.NewMinersStore(path, initial)
	cfg := config.Config{
		Bitaxes:     initial,
		HealthCheck: config.HealthCheckConfig{Interval: 10 * time.Millisecond},
	}

	s := NewScheduler(testLogger(), cfg).WithMinersStore(store)
	s.Start()
	defer s.Stop()

	if got := s.entryCount(); got != 0 {
		t.Fatalf("initial entries = %d, want 0 (no schedule configured yet)", got)
	}

	// Give the mtime a chance to actually move forward before rewriting --
	// some filesystems have coarse (1s) mtime resolution, and Reload()
	// only re-reads when mtime changes.
	time.Sleep(1100 * time.Millisecond)
	updated := []config.Bitaxe{{Ip: "10.0.0.1", Enabled: true, Schedule: []config.CronSchedule{
		{Cron: "0 0 0 * * SAT", Action: config.ActionSwitchFallback},
	}}}
	if err := config.SaveMiners(path, updated); err != nil {
		t.Fatalf("save updated miners file: %v", err)
	}

	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		if s.entryCount() == 1 {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("entries after reload = %d, want 1 within the deadline", s.entryCount())
}

func TestScheduler_reloadDoesNotDuplicateJobsWhenNothingChanged(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "miners.yml")

	bitaxes := []config.Bitaxe{{Ip: "10.0.0.1", Enabled: true, Schedule: []config.CronSchedule{
		{Cron: "0 0 0 * * SAT", Action: config.ActionSwitchFallback},
	}}}
	if err := config.SaveMiners(path, bitaxes); err != nil {
		t.Fatalf("seed miners file: %v", err)
	}

	store := config.NewMinersStore(path, bitaxes)
	cfg := config.Config{
		Bitaxes:     bitaxes,
		HealthCheck: config.HealthCheckConfig{Interval: 5 * time.Millisecond},
	}

	s := NewScheduler(testLogger(), cfg).WithMinersStore(store)
	s.Start()
	defer s.Stop()

	// Nothing on disk changes across many reload ticks -- the registered
	// job count must stay exactly 1 throughout, never grow (this is the
	// scenario a naive "always rebuild on reload, appending instead of
	// replacing" bug would fail).
	deadline := time.Now().Add(200 * time.Millisecond)
	for time.Now().Before(deadline) {
		if got := s.entryCount(); got != 1 {
			t.Fatalf("entries = %d, want exactly 1 (no duplicate registration across reload ticks)", got)
		}
		time.Sleep(10 * time.Millisecond)
	}
}
