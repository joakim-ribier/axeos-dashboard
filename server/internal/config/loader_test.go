package config

import (
	"os"
	"path/filepath"
	"testing"
)

func writeFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("failed to write fixture %s: %v", path, err)
	}
}

func TestLoadConfig_LoadConfig(t *testing.T) {
	dir := t.TempDir()
	configPath := filepath.Join(dir, "config.yml")
	writeFile(t, configPath, `
global:
  env: dev
server:
  port: "8080"
storage:
  dataDir: `+dir+`
`)

	got, err := NewLoaderConfig(configPath).LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig() unexpected error: %v", err)
	}

	if got.Global.Env != "dev" {
		t.Errorf("Global.Env = %q, want %q", got.Global.Env, "dev")
	}
	if got.Storage.DataDir != dir {
		t.Errorf("Storage.DataDir = %q, want %q (absolute, cleaned)", got.Storage.DataDir, dir)
	}
}

func TestLoadConfig_LoadConfig_missingFile(t *testing.T) {
	_, err := NewLoaderConfig("/does/not/exist.yml").LoadConfig()
	if err == nil {
		t.Fatal("LoadConfig() error = nil, want error for missing file")
	}
}

func TestLoadConfig_LoadConfig_invalidYaml(t *testing.T) {
	dir := t.TempDir()
	configPath := filepath.Join(dir, "config.yml")
	writeFile(t, configPath, `not: [valid: yaml`)

	_, err := NewLoaderConfig(configPath).LoadConfig()
	if err == nil {
		t.Fatal("LoadConfig() error = nil, want error for invalid yaml")
	}
}

func TestLoadConfig_inlineBitaxesIsIgnored(t *testing.T) {
	// A miners.yml-style bitaxes: block hand-written directly in the main
	// config is no longer read from -- the managed miners file (default:
	// sibling miners.yml, none exists here) is always the source of truth,
	// so this must come back empty rather than picking up the inline list.
	dir := t.TempDir()
	configPath := filepath.Join(dir, "config.yml")
	writeFile(t, configPath, `
storage:
  dataDir: `+dir+`
bitaxes:
  - ip: 10.0.0.1
    enabled: true
`)

	got, err := NewLoaderConfig(configPath).LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig() unexpected error: %v", err)
	}
	if len(got.Bitaxes) != 0 {
		t.Errorf("Bitaxes = %+v, want empty -- inline bitaxes: must be ignored", got.Bitaxes)
	}
}

func TestLoadConfig_minersFile_defaultsToSiblingOfConfig(t *testing.T) {
	dir := t.TempDir()
	configPath := filepath.Join(dir, "config.yml")
	writeFile(t, configPath, `
storage:
  dataDir: `+dir+`
`)
	// "miners.yml" right next to config.yml must be picked up
	// automatically, no flag/key needed.
	writeFile(t, filepath.Join(dir, "miners.yml"), `
bitaxes:
  - ip: 10.0.0.99
    enabled: true
  - ip: 10.0.0.100
    enabled: false
`)

	got, err := NewLoaderConfig(configPath).LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig() unexpected error: %v", err)
	}

	if len(got.Bitaxes) != 2 {
		t.Fatalf("Bitaxes = %+v, want the 2 miners from the sibling miners.yml", got.Bitaxes)
	}
	if got.Bitaxes[0].Ip != "10.0.0.99" {
		t.Errorf("Bitaxes[0].Ip = %q, want %q", got.Bitaxes[0].Ip, "10.0.0.99")
	}
	if want := filepath.Join(dir, "miners.yml"); got.MinersFilePath != want {
		t.Errorf("MinersFilePath = %q, want %q", got.MinersFilePath, want)
	}
}

func TestLoadConfig_minersFile_missingSiblingYieldsEmptyNotError(t *testing.T) {
	// A fresh install before ever adding a miner through the
	// network-discovery UI: no miners.yml exists next to config.yml yet.
	dir := t.TempDir()
	configPath := filepath.Join(dir, "config.yml")
	writeFile(t, configPath, `
storage:
  dataDir: `+dir+`
`)

	got, err := NewLoaderConfig(configPath).LoadConfig()
	if err != nil {
		t.Fatalf("LoadConfig() unexpected error: %v", err)
	}
	if len(got.Bitaxes) != 0 {
		t.Errorf("Bitaxes = %+v, want empty", got.Bitaxes)
	}
}

func TestLoadConfig_minersFile_invalidYaml(t *testing.T) {
	// Unlike a missing file, a *malformed existing* miners file is still a
	// real mistake worth surfacing as an error.
	dir := t.TempDir()
	configPath := filepath.Join(dir, "config.yml")
	writeFile(t, configPath, `
storage:
  dataDir: `+dir+`
`)
	writeFile(t, filepath.Join(dir, "miners.yml"), `not: [valid: yaml`)

	_, err := NewLoaderConfig(configPath).LoadConfig()
	if err == nil {
		t.Fatal("LoadConfig() error = nil, want error for invalid miners yaml")
	}
}

func TestLoadConfig_resolvePath(t *testing.T) {
	tests := []struct {
		name  string
		input string
		setup func(t *testing.T) string // returns expected absolute path
	}{
		{
			name:  "relative path is made absolute",
			input: "relative/data",
			setup: func(t *testing.T) string {
				wd, err := os.Getwd()
				if err != nil {
					t.Fatal(err)
				}
				return filepath.Clean(filepath.Join(wd, "relative/data"))
			},
		},
		{
			name:  "tilde is expanded to $HOME",
			input: "~/data",
			setup: func(t *testing.T) string {
				home := t.TempDir()
				t.Setenv("HOME", home)
				return filepath.Join(home, "data")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			want := tt.setup(t)

			got, err := LoadConfig{}.resolvePath(tt.input)
			if err != nil {
				t.Fatalf("resolvePath(%q) unexpected error: %v", tt.input, err)
			}
			if got != want {
				t.Errorf("resolvePath(%q) = %q, want %q", tt.input, got, want)
			}
		})
	}
}
