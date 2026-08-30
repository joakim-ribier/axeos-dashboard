// internal/config/cron.go
package config

import (
	"strings"

	"github.com/robfig/cron/v3"
)

// cronParser mirrors the field spec scheduler.NewScheduler configures via
// cron.WithSeconds() -- kept in sync deliberately, so that a schedule
// accepted here (at save time) can never be rejected by the scheduler
// itself at run time, or vice versa.
var cronParser = cron.NewParser(
	cron.Second | cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow | cron.Descriptor,
)

// ValidateCronSchedule reports whether expr parses as a valid cron
// expression under the scheduler's field spec (seconds field included,
// e.g. "59 59 23 * * FRI"). Used to reject a bad schedule entry at
// save time instead of only failing silently when the scheduler tries to
// register it.
func ValidateCronSchedule(expr string) error {
	_, err := cronParser.Parse(expr)
	return err
}

// NormalizeCronExpression collapses runs of whitespace and lowercases a
// cron expression, so two expressions that only differ by spacing or by
// day/month name casing (e.g. "FRI" vs "fri") compare equal -- used to
// detect a duplicate schedule entry for the same miner.
func NormalizeCronExpression(expr string) string {
	return strings.ToLower(strings.Join(strings.Fields(expr), " "))
}
