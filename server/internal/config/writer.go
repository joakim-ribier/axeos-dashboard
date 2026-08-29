// internal/config/writer.go
package config

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"go.yaml.in/yaml/v3"
)

// SaveMiners writes miners as the managed miners.yml file at path -- see
// saveYAMLAtomic for the write semantics (atomic, single backup).
func SaveMiners(path string, miners []Bitaxe) error {
	if miners == nil {
		miners = []Bitaxe{}
	}
	return saveYAMLAtomic(path, MinersConfig{Bitaxes: miners})
}

// SaveAppSettings writes settings as the managed settings.yml file at
// path -- see saveYAMLAtomic for the write semantics (atomic, single
// backup).
func SaveAppSettings(path string, settings AppSettingsFile) error {
	return saveYAMLAtomic(path, settings)
}

// saveYAMLAtomic marshals v as YAML and writes it to path -- atomically
// (temp file + rename, so a reader or a concurrent process never observes
// a half-written file), backing up whatever was there before to a single
// sibling ".bak" file (overwritten on every save -- only the
// immediately-previous version is ever kept, not a full history, so
// repeated saves don't pile up one backup file per save). Creates the
// parent directory if needed (a fresh install may not have one yet).
// Shared by every managed file this package writes (miners.yml,
// settings.yml, ...).
func saveYAMLAtomic(path string, v any) error {
	data, err := yaml.Marshal(v)
	if err != nil {
		return fmt.Errorf("marshal %s: %w", filepath.Base(path), err)
	}
	header := fmt.Sprintf("# Last updated: %s\n", time.Now().UTC().Format(time.RFC3339))
	data = append([]byte(header), data...)

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("create dir for %s: %w", filepath.Base(path), err)
	}

	if err := backupIfExists(path); err != nil {
		return fmt.Errorf("backup existing %s: %w", filepath.Base(path), err)
	}

	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return fmt.Errorf("write temp %s: %w", filepath.Base(path), err)
	}
	if err := os.Rename(tmp, path); err != nil {
		return fmt.Errorf("replace %s: %w", filepath.Base(path), err)
	}
	return nil
}

// backupIfExists copies an existing file at path to a single sibling
// "path.bak" before it gets overwritten, replacing whatever backup was
// already there -- only the immediately-previous version is ever kept.
// A no-op if nothing exists there yet (e.g. the very first save on a
// fresh install).
func backupIfExists(path string) error {
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}

	return os.WriteFile(path+".bak", data, 0o644)
}
