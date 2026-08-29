// internal/config/live.go
package config

import (
	"os"
	"sync"
	"time"

	"go.yaml.in/yaml/v3"
)

// MinersStore keeps a miners list in sync with its backing file on disk,
// so a change lands in every consumer without a restart -- whether that
// change came from this same process (a save via POST
// /api/config/miners, see Set) or from anywhere else (another process,
// hand-editing the file). Reload is cheap when nothing changed (one
// os.Stat), so callers can call it at the start of every request/tick
// without needing to track "did something change" themselves. Safe for
// concurrent use.
type MinersStore struct {
	path string

	mu      sync.Mutex
	bitaxes []Bitaxe
	modTime time.Time
}

// NewMinersStore wraps a miners list already loaded (typically the one
// LoadConfig produced at startup) with live-reload. path is the -miners
// file this store watches; an empty path (no -miners given) makes Reload
// a no-op that just keeps returning initial forever -- there's nothing on
// disk to watch, same as before this feature existed.
//
// modTime deliberately starts zero rather than being pre-stat'd here: it
// only ever gets set as the result of an actual read (see Reload/Set), so
// the very first Reload() call always re-reads path instead of trusting a
// coincidental mtime match against initial -- initial could in principle
// predate whatever is on disk right now (e.g. the file changed between
// LoadConfig() at startup and this call).
func NewMinersStore(path string, initial []Bitaxe) *MinersStore {
	return &MinersStore{path: path, bitaxes: initial}
}

// Reload returns the current miners list, re-reading the file first if its
// mtime has moved since the last read. On a read/parse error it logs
// nothing itself (callers decide how) and keeps serving the last-known-good
// list rather than going empty -- a transient error (e.g. caught mid-write
// by another process) must not blank out every configured miner for one
// tick.
func (s *MinersStore) Reload() ([]Bitaxe, error) {
	if s.path == "" {
		return s.snapshot(), nil
	}

	info, err := os.Stat(s.path)
	if os.IsNotExist(err) {
		// Removed out from under us -- same as a fresh install with
		// nothing configured yet, not an error.
		s.mu.Lock()
		s.bitaxes = nil
		s.modTime = time.Time{}
		s.mu.Unlock()
		return nil, nil
	}
	if err != nil {
		return s.snapshot(), err
	}

	s.mu.Lock()
	unchanged := info.ModTime().Equal(s.modTime)
	s.mu.Unlock()
	if unchanged {
		return s.snapshot(), nil
	}

	data, err := os.ReadFile(s.path)
	if err != nil {
		return s.snapshot(), err
	}
	var mc MinersConfig
	if err := yaml.Unmarshal(data, &mc); err != nil {
		return s.snapshot(), err
	}

	s.mu.Lock()
	s.bitaxes = mc.Bitaxes
	s.modTime = info.ModTime()
	s.mu.Unlock()

	return s.snapshot(), nil
}

// Set replaces the in-memory list immediately -- used right after this
// same process writes path itself (see handler.SaveMinersConfig), so a
// request handled a moment later doesn't have to wait for its own write to
// show up in a Reload(). Also records the file's current mtime so the next
// Reload() sees no change (it already has the latest content).
func (s *MinersStore) Set(bitaxes []Bitaxe) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.bitaxes = bitaxes
	if s.path != "" {
		if info, err := os.Stat(s.path); err == nil {
			s.modTime = info.ModTime()
		}
	}
}

func (s *MinersStore) snapshot() []Bitaxe {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]Bitaxe, len(s.bitaxes))
	copy(out, s.bitaxes)
	return out
}
