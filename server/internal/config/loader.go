// internal/config/loader.go
package config

import (
	"os"
	"path/filepath"
	"strings"

	"go.yaml.in/yaml/v3"
)

type LoadConfig struct {
	path string
}

func NewLoaderConfig(path string) LoadConfig {
	return LoadConfig{path: path}
}

// LoadConfig reads the main config file and the managed miners file
// alongside it. The miners file's location is never something you have to
// pass on the command line: it defaults to "miners.yml" sitting right next
// to path, and can only be moved by setting minersFile: in the main config
// itself (see Config.MinersFile) -- one less flag to keep in sync between
// dashboard-api and feeder, and one less way for the two to end up pointed
// at different files.
func (cfg LoadConfig) LoadConfig() (Config, error) {
	data, err := os.ReadFile(cfg.path)
	if err != nil {
		return Config{}, err
	}

	var config Config
	if err := yaml.Unmarshal(data, &config); err != nil {
		return Config{}, err
	}

	dataDir, err := cfg.resolvePath(config.Storage.DataDir)
	if err != nil {
		return Config{}, err
	}
	config.Storage.DataDir = dataDir

	minersPath, err := cfg.resolveMinersPath(config.MinersFile)
	if err != nil {
		return Config{}, err
	}
	miners, err := loadMinersFile(minersPath)
	if err != nil {
		return Config{}, err
	}
	config.Bitaxes = miners
	config.MinersFilePath = minersPath

	return config, nil
}

// resolveMinersPath returns where the managed miners file lives: override
// (resolved the same way as any other path in this config, so "~" and
// relative paths work) if set, otherwise a "miners.yml" sibling of the
// main config file.
func (cfg LoadConfig) resolveMinersPath(override string) (string, error) {
	if override != "" {
		return cfg.resolvePath(override)
	}

	configDir, err := cfg.resolvePath(filepath.Dir(cfg.path))
	if err != nil {
		return "", err
	}
	return filepath.Join(configDir, "miners.yml"), nil
}

type MinersConfig struct {
	Bitaxes []Bitaxe `yaml:"bitaxes"`
}

// loadMinersFile reads the managed miners file at path. A missing file is
// not an error -- it just means no miner has been configured yet (e.g. a
// fresh install before ever using the network-discovery UI, see
// internal/discovery), so it yields an empty list rather than refusing to
// start. A malformed existing file still errors: that's a real mistake
// worth surfacing, not "not set up yet".
func loadMinersFile(path string) ([]Bitaxe, error) {
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var mc MinersConfig
	if err := yaml.Unmarshal(data, &mc); err != nil {
		return nil, err
	}
	return mc.Bitaxes, nil
}

func (cfg LoadConfig) resolvePath(p string) (string, error) {
	if strings.HasPrefix(p, "~") {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		p = filepath.Join(home, strings.TrimPrefix(p, "~"))
	}

	p, err := filepath.Abs(p)
	if err != nil {
		return "", err
	}

	return filepath.Clean(p), nil
}
