package alerts

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"time"
)

const seenFile = "seen.json"

// seenMu serializes MarkSeen: two browsers marking at once must not move
// it back.
var seenMu sync.Mutex

type seen struct {
	SeenAt time.Time `json:"seenAt"`
}

// SeenAt is up to when the alerts have been read -- shared by every
// browser, so reading them on one marks them read on all. Zero when never.
func (l *Log) SeenAt() (time.Time, error) {
	data, err := os.ReadFile(filepath.Join(l.dir, seenFile))
	if errors.Is(err, os.ErrNotExist) {
		return time.Time{}, nil
	}
	if err != nil {
		return time.Time{}, err
	}
	var s seen
	return s.SeenAt, json.Unmarshal(data, &s)
}

// MarkSeen moves SeenAt forward to t -- never back -- and returns it.
func (l *Log) MarkSeen(t time.Time) (time.Time, error) {
	seenMu.Lock()
	defer seenMu.Unlock()

	current, err := l.SeenAt()
	if err != nil {
		return time.Time{}, err
	}
	if !t.After(current) {
		return current, nil
	}

	data, err := json.Marshal(seen{SeenAt: t.UTC()})
	if err != nil {
		return time.Time{}, err
	}
	if err := os.MkdirAll(l.dir, 0o755); err != nil {
		return time.Time{}, err
	}
	path := filepath.Join(l.dir, seenFile)
	if err := os.WriteFile(path+".tmp", data, 0o644); err != nil {
		return time.Time{}, err
	}
	return t.UTC(), os.Rename(path+".tmp", path)
}
