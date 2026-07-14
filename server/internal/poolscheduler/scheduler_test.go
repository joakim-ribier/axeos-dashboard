package poolscheduler

import (
	"io"
	"log/slog"
	"testing"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
)

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func TestNewPoolScheduler_registersJobsForEnabledMinersOnly(t *testing.T) {
	cfg := config.Config{
		Bitaxes: []config.Bitaxe{
			{
				Ip: "10.0.0.1", Enabled: true,
				PoolSchedule: []config.CronSchedule{
					{Cron: "0 0 0 * * SAT", Target: config.Fallback},
					{Cron: "0 0 0 * * MON", Target: config.Primary},
				},
			},
			{
				Ip: "10.0.0.2", Enabled: true,
				PoolSchedule: []config.CronSchedule{
					{Cron: "0 30 12 * * *", Target: config.Fallback},
				},
			},
			{
				// Disabled miners are filtered out by config.GetMiners() and must not get any job.
				Ip: "10.0.0.3", Enabled: false,
				PoolSchedule: []config.CronSchedule{
					{Cron: "0 0 0 * * SAT", Target: config.Fallback},
				},
			},
		},
	}

	s := NewPoolScheduler(testLogger(), cfg)

	if got, want := len(s.cron.Entries()), 3; got != want {
		t.Errorf("registered cron entries = %d, want %d", got, want)
	}
}

func TestNewPoolScheduler_invalidCronExpressionIsSkipped(t *testing.T) {
	cfg := config.Config{
		Bitaxes: []config.Bitaxe{
			{
				Ip: "10.0.0.1", Enabled: true,
				PoolSchedule: []config.CronSchedule{
					{Cron: "not a valid cron expression", Target: config.Fallback},
					{Cron: "0 0 0 * * SAT", Target: config.Primary},
				},
			},
		},
	}

	s := NewPoolScheduler(testLogger(), cfg)

	if got, want := len(s.cron.Entries()), 1; got != want {
		t.Errorf("registered cron entries = %d, want %d (the invalid expression must be skipped, not crash)", got, want)
	}
}

func TestScheduler_startAndStopDoNotPanic(t *testing.T) {
	cfg := config.Config{Bitaxes: []config.Bitaxe{
		{Ip: "10.0.0.1", Enabled: true, PoolSchedule: []config.CronSchedule{
			{Cron: "0 0 0 * * SAT", Target: config.Fallback},
		}},
	}}

	s := NewPoolScheduler(testLogger(), cfg)
	s.Start()
	s.Stop()
}
