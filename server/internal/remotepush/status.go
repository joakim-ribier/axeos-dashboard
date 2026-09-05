// internal/remotepush/status.go
package remotepush

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"
)

const statusFile = "remote_push_status.json"

// Status is the feeder's own record of its last attempt to push to
// hashboard -- read back by dashboard-api's GET /api/config/settings so
// the Settings page can show whether pushing to hashboard is actually
// working right now, not just configured. The feeder is a separate OS
// process from dashboard-api, so this file (not memory) is the only way
// the two agree on it -- same principle as internal/firmware's cache.
type Status struct {
	LastAttemptAt time.Time `json:"lastAttemptAt"`
	LastSuccessAt time.Time `json:"lastSuccessAt"`
	LastError     string    `json:"lastError,omitempty"`
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
