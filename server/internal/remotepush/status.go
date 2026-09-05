// internal/remotepush/status.go
package remotepush

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"
)

const statusFile = "remote_push_status.json"

// Kind identifies which config push endpoint an Attempt belongs to.
type Kind int

const (
	KindMinersConfig Kind = iota
	KindSettingsConfig
)

// Attempt is the record of the most recent push attempt for one config
// push endpoint (miners or settings).
type Attempt struct {
	LastAttemptAt time.Time `json:"lastAttemptAt"`
	LastSuccessAt time.Time `json:"lastSuccessAt"`
	LastError     string    `json:"lastError,omitempty"`
}

// Status is the feeder's own record of its last attempts to push config to
// hashboard -- read back by dashboard-api's GET /api/config/settings so
// the Settings page can show whether pushing to hashboard is actually
// working right now, not just configured. The feeder is a separate OS
// process from dashboard-api, so this file (not memory) is the only way
// the two agree on it -- same principle as internal/firmware's cache.
//
// MinersConfig and SettingsConfig are tracked independently (rather than
// one shared attempt) because they're pushed at different points in the
// feeder's cycle by separate goroutines -- a shared field would let one
// endpoint's success overwrite the other's still-failing status. The
// Settings page's "Remote" section shows both, side by side.
type Status struct {
	MinersConfig   Attempt `json:"minersConfig"`
	SettingsConfig Attempt `json:"settingsConfig"`
}

// Attempt returns the current attempt recorded for kind.
func (s Status) Attempt(kind Kind) Attempt {
	if kind == KindSettingsConfig {
		return s.SettingsConfig
	}
	return s.MinersConfig
}

// SetAttempt updates the attempt recorded for kind.
func (s *Status) SetAttempt(kind Kind, a Attempt) {
	if kind == KindSettingsConfig {
		s.SettingsConfig = a
	} else {
		s.MinersConfig = a
	}
}

// Load reads the last-recorded push status, or a zero Status if none has
// ever been written yet (fresh install, or remote push never configured).
func Load(dataDir string) Status {
	data, err := os.ReadFile(filepath.Join(dataDir, statusFile))
	if err != nil {
		return Status{}
	}
	var s Status
	if err := json.Unmarshal(data, &s); err != nil {
		return Status{}
	}
	return s
}

// Save overwrites the recorded push status.
func Save(dataDir string, s Status) error {
	data, err := json.Marshal(s)
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dataDir, statusFile), data, 0o644)
}
