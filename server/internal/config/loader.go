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
// pass on the command line: it's always "miners.yml" sitting right next to
// path -- one less flag to keep in sync between dashboard-api and feeder,
// and one less way for the two to end up pointed at different files.
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

	minersPath, err := cfg.resolveMinersPath()
	if err != nil {
		return Config{}, err
	}
	miners, err := loadMinersFile(minersPath)
	if err != nil {
		return Config{}, err
	}
	config.Bitaxes = miners
	config.MinersFilePath = minersPath

	appSettingsPath, err := cfg.resolveSiblingPath(config.AppSettingsFile, "settings.yml")
	if err != nil {
		return Config{}, err
	}
	config.AppSettingsFilePath = appSettingsPath
	if settings, ok, err := loadAppSettingsFile(appSettingsPath); err != nil {
		return Config{}, err
	} else if ok {
		// Electricity/Remote only replaced when the file actually exists --
		// a fresh install with no file yet keeps whatever dashboard.yml
		// itself had for those two. Pools.Dashboards/Firmware.Repos are
		// always a defaults+overrides merge either way (see ApplyTo).
		settings.ApplyTo(&config)
	} else {
		config.Pools.Dashboards = mergePoolDashboards(nil)
		config.Firmware.Repos = mergeFirmwareRepos(nil)
	}

	return config, nil
}

// resolveMinersPath returns where the managed miners file lives: a
// "miners.yml" sibling of the main config file. No override -- unlike
// resolveSiblingPath's other callers, there's no real use case for
// pointing it elsewhere (see PR #3).
func (cfg LoadConfig) resolveMinersPath() (string, error) {
	return cfg.resolveSiblingPath("", "miners.yml")
}

// resolveSiblingPath returns override (resolved the same way as any other
// path in this config, so "~" and relative paths work) if set, otherwise
// defaultName as a sibling of the main config file -- the shared
// resolution rule behind every managed file this config knows about
// (miners.yml, settings.yml, ...), so a new one is always found next
// to -config with no extra flag required.
func (cfg LoadConfig) resolveSiblingPath(override, defaultName string) (string, error) {
	if override != "" {
		return cfg.resolvePath(override)
	}

	configDir, err := cfg.resolvePath(filepath.Dir(cfg.path))
	if err != nil {
		return "", err
	}
	return filepath.Join(configDir, defaultName), nil
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

// loadAppSettingsFile reads the managed app-settings file at path. Unlike
// miners (where "missing" is a legitimate "nothing configured yet" state),
// a missing app-settings file must never be treated as "these settings are
// now empty" -- the second return value tells the caller whether the file
// existed at all, so it can leave whatever dashboard.yml itself already
// had for these fields untouched when it didn't (see Config.applyAppSettings).
func loadAppSettingsFile(path string) (AppSettingsFile, bool, error) {
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return AppSettingsFile{}, false, nil
	}
	if err != nil {
		return AppSettingsFile{}, false, err
	}
	var settings AppSettingsFile
	if err := yaml.Unmarshal(data, &settings); err != nil {
		return AppSettingsFile{}, false, err
	}
	return settings, true, nil
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
