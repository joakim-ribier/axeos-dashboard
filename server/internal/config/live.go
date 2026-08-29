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

// AppSettingsStore keeps the operational subset of config (electricity
// rate, pool dashboard links, remote push credentials, firmware repos --
// see AppSettingsFile) in sync with its backing settings.yml file, the
// same live-reload principle as MinersStore. The one deliberate
// difference: a *missing* file is never treated as "these settings are
// now empty" -- Reload() just keeps serving whatever this store was
// constructed with (dashboard.yml's own values at startup, see
// LoadConfig.applyAppSettings) until a save through /settings actually
// creates the file. Safe for concurrent use.
type AppSettingsStore struct {
	path string

	mu       sync.Mutex
	settings AppSettingsFile
	modTime  time.Time
}

func NewAppSettingsStore(path string, initial AppSettingsFile) *AppSettingsStore {
	return &AppSettingsStore{path: path, settings: initial}
}

// Reload returns the current settings, re-reading the file first if its
// mtime has moved since the last read. On a read/parse error, or if the
// file doesn't exist (yet), it keeps serving the last-known settings
// rather than an error/empty value.
func (s *AppSettingsStore) Reload() (AppSettingsFile, error) {
	if s.path == "" {
		return s.snapshot(), nil
	}

	info, err := os.Stat(s.path)
	if os.IsNotExist(err) {
		return s.snapshot(), nil
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
	var settings AppSettingsFile
	if err := yaml.Unmarshal(data, &settings); err != nil {
		return s.snapshot(), err
	}

	s.mu.Lock()
	s.settings = settings
	s.modTime = info.ModTime()
	s.mu.Unlock()

	return s.snapshot(), nil
}

// Set replaces the in-memory settings immediately -- used right after this
// same process writes path itself (see handler.SaveAppSettings), mirroring
// MinersStore.Set.
func (s *AppSettingsStore) Set(settings AppSettingsFile) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.settings = settings
	if s.path != "" {
		if info, err := os.Stat(s.path); err == nil {
			s.modTime = info.ModTime()
		}
	}
}

// snapshot returns the current settings by value. Unlike MinersStore's
// snapshot, this doesn't deep-copy the maps nested inside (Pools.Dashboards,
// Firmware.Repos) -- every caller either only reads them, or replaces the
// whole AppSettingsFile wholesale (Reload/Set always assign a freshly
// unmarshaled/decoded value, never mutate a shared one in place), so
// aliasing them here is safe.
func (s *AppSettingsStore) snapshot() AppSettingsFile {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.settings
}
