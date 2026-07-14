// internal/config/loader.go
package config

import (
	"os"
	"path/filepath"
	"strings"

	"go.yaml.in/yaml/v3"
)

type LoadConfig struct {
	path       string
	minersPath string
}

func NewLoaderConfig(path string) LoadConfig {
	return LoadConfig{path: path}
}

func (cfg LoadConfig) WithMiners(minersPath string) LoadConfig {
	cfg.minersPath = minersPath
	return cfg
}

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

	if cfg.minersPath != "" {
		miners, err := cfg.loadMiners()
		if err != nil {
			return Config{}, err
		}
		config.Bitaxes = miners
	}

	return config, nil
}

type MinersConfig struct {
	Bitaxes []Bitaxe `yaml:"bitaxes"`
}

func (cfg LoadConfig) loadMiners() ([]Bitaxe, error) {
	data, err := os.ReadFile(cfg.minersPath)
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
