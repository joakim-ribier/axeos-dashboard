// internal/config/writer.go
package config

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"go.yaml.in/yaml/v3"
)

// SaveMiners writes miners as the managed miners.yml file at path --
// atomically (temp file + rename, so a reader or a concurrent process
// never observes a half-written file), backing up whatever was there
// before under a timestamped name. Creates the parent directory if needed
// (a fresh install may not have one yet).
func SaveMiners(path string, miners []Bitaxe) error {
	if miners == nil {
		miners = []Bitaxe{}
	}

	data, err := yaml.Marshal(MinersConfig{Bitaxes: miners})
	if err != nil {
		return fmt.Errorf("marshal miners: %w", err)
	}
	header := fmt.Sprintf("# Last updated: %s\n", time.Now().UTC().Format(time.RFC3339))
	data = append([]byte(header), data...)

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("create miners dir: %w", err)
	}

	if err := backupIfExists(path); err != nil {
		return fmt.Errorf("backup existing miners file: %w", err)
	}

	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return fmt.Errorf("write temp miners file: %w", err)
	}
	if err := os.Rename(tmp, path); err != nil {
		return fmt.Errorf("replace miners file: %w", err)
	}
	return nil
}

// backupIfExists copies an existing file at path to path + a UTC timestamp
// suffix before it gets overwritten. A no-op if nothing exists there yet
// (e.g. the very first save on a fresh install).
func backupIfExists(path string) error {
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}

	backupPath := fmt.Sprintf("%s.bak-%s", path, time.Now().UTC().Format("20060102T150405Z"))
	return os.WriteFile(backupPath, data, 0o644)
}
