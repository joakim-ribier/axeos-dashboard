// internal/storage/totals.go
package storage

import (
	"encoding/json"
	"errors"
	"log"
	"os"
	"path/filepath"
	"time"
)

// Totals holds per-miner cumulative counters that survive device reboots --
// unlike the raw uptimeSeconds/sharesAccepted/sharesRejected reported by the
// device (which reset to ~0 whenever the miner itself restarts), these keep
// growing for as long as the miner has been tracked, and are stored on disk
// so they also survive feeder/dashboard-api restarts.
type Totals struct {
	TotalUptimeSeconds  int64 `json:"totalUptimeSeconds"`
	TotalSharesAccepted int64 `json:"totalSharesAccepted"`
	TotalSharesRejected int64 `json:"totalSharesRejected"`

	// Last* are the raw device counters as of the previous update -- kept
	// only to detect a device reboot (a raw value lower than its
	// predecessor) on the next call, never read by anything else.
	LastUptimeSeconds  int64 `json:"lastUptimeSeconds"`
	LastSharesAccepted int64 `json:"lastSharesAccepted"`
	LastSharesRejected int64 `json:"lastSharesRejected"`

	UpdatedAt time.Time `json:"updatedAt"`
}

// TotalsPath returns the path to a miner's totals.json, alongside its
// latest.json in the same storage directory.
func TotalsPath(baseDir, bitaxeAddr string) string {
	return filepath.Join(baseDir, bitaxeAddr, "totals.json")
}

// ReadTotals reads totals.json at path, returning a zero Totals if the file
// doesn't exist yet or is corrupted (logged, not fatal -- same tolerance as
// the JSONL reading in internal/handler).
func ReadTotals(path string) Totals {
	data, err := os.ReadFile(path)
	if err != nil {
		if !errors.Is(err, os.ErrNotExist) {
			log.Printf("warning: failed to read %s, starting totals from zero: %v", path, err)
		}
		return Totals{}
	}

	var t Totals
	if err := json.Unmarshal(data, &t); err != nil {
		log.Printf("warning: corrupted %s, starting totals from zero: %v", path, err)
		return Totals{}
	}
	return t
}

// WriteTotals overwrites totals.json at path with t. Written atomically (via
// a temp file + rename) so a crash mid-write can never leave a half-written,
// corrupted totals.json behind -- ReadTotals would otherwise silently reset
// a corrupted file's totals back to zero on the next read.
func WriteTotals(path string, t Totals) error {
	data, err := json.Marshal(t)
	if err != nil {
		return err
	}

	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

// accumulate adds the delta between the last known raw counter value and the
// current one to total. A current value lower than last means the device
// rebooted and its own counter reset to ~0 -- in that case the new segment's
// current value (its progress since the reboot) is added directly instead of
// a negative delta.
func accumulate(total, last, current int64) int64 {
	if current >= last {
		return total + (current - last)
	}
	return total + current
}

// ApplyPoll folds one poll's raw device payload into t, returning the
// updated totals. Pure and file-IO-free so it can replay a miner's whole
// JSONL history from Totals{} (see cmd/rebuild-totals) using the exact same
// logic as the live path (RawStorage.Append, one poll at a time).
func ApplyPoll(t Totals, now time.Time, payload []byte) (Totals, error) {
	var counters struct {
		UptimeSeconds  int64 `json:"uptimeSeconds"`
		SharesAccepted int64 `json:"sharesAccepted"`
		SharesRejected int64 `json:"sharesRejected"`
	}
	if err := json.Unmarshal(payload, &counters); err != nil {
		return t, err
	}

	t.TotalUptimeSeconds = accumulate(t.TotalUptimeSeconds, t.LastUptimeSeconds, counters.UptimeSeconds)
	t.TotalSharesAccepted = accumulate(t.TotalSharesAccepted, t.LastSharesAccepted, counters.SharesAccepted)
	t.TotalSharesRejected = accumulate(t.TotalSharesRejected, t.LastSharesRejected, counters.SharesRejected)
	t.LastUptimeSeconds = counters.UptimeSeconds
	t.LastSharesAccepted = counters.SharesAccepted
	t.LastSharesRejected = counters.SharesRejected
	t.UpdatedAt = now.UTC().Truncate(time.Second)

	return t, nil
}

// updateTotals folds one poll's raw payload into the miner's persistent
// totals.json.
func (s *RawStorage) updateTotals(now time.Time, bitaxeAddr string, payload []byte) error {
	path := TotalsPath(s.baseDir, bitaxeAddr)

	updated, err := ApplyPoll(ReadTotals(path), now, payload)
	if err != nil {
		return err
	}
	return WriteTotals(path, updated)
}
