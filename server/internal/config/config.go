// internal/config/config.go
package config

import (
	"fmt"
	"path/filepath"
	"strings"
	"time"
)

type PoolTarget string

const (
	Primary  PoolTarget = "primary"
	Fallback PoolTarget = "fallback"
)

type Config struct {
	Global      GlobalConfig      `yaml:"global"`
	Server      ServerConfig      `yaml:"server"`
	Feeder      FeederConfig      `yaml:"feeder"`
	HealthCheck HealthCheckConfig `yaml:"healthCheck"`
	Bitaxes     []Bitaxe          `yaml:"bitaxes"`
	Storage     StorageConfig     `yaml:"storage"`
	Wifi        Wifi              `yaml:"wifi"`
	Endpoints   EndpointConfig    `yaml:"endpoints"`
	Firmware    FirmwareConfig    `yaml:"firmware"`
	Pools       PoolsConfig       `yaml:"pools"`
	Electricity ElectricityConfig `yaml:"electricity"`
	Remote      RemoteConfig      `yaml:"remote"`

	// HashboardURL is the base URL of the hashboard instance backing this
	// remote-dashboard-api (remote-dashboard-api only): where the "private
	// board" access-request form posts to, and where the board owner's
	// account-management link points. Not configured by default -- set your
	// own deployment's URL (e.g. "http://localhost:8090" for local dev).
	HashboardURL string `yaml:"hashboardURL"`
}

func (c Config) GetMiners() []Bitaxe {
	var out []Bitaxe
	for _, b := range c.Bitaxes {
		if b.Enabled {
			out = append(out, b)
		}
	}
	return out
}

// MissingMacWarnings returns one message per enabled miner with no mac:
// configured -- storage is keyed by MAC, so these devices won't be tracked
// (feeder skips them, dashboard-api can't find their data) until it's set.
// Meant to be logged loudly at startup, not discovered only once someone
// happens to hit an API endpoint that touches storage.
func (c Config) MissingMacWarnings() []string {
	var warnings []string
	for _, b := range c.GetMiners() {
		if b.StorageKey() == "" {
			warnings = append(warnings, fmt.Sprintf(
				"miner %s (%s) has no mac: configured in dashboard.yml -- it will be skipped until you set one",
				b.Ip, b.Hostname))
		}
	}
	return warnings
}

func (c Config) GetMinersFilterBy(hostnameOrIp string) []Bitaxe {
	miners := c.GetMiners()
	if len(hostnameOrIp) == 0 {
		return miners
	}

	var filtered []Bitaxe
	for _, b := range miners {
		if b.Hostname == hostnameOrIp || b.Ip == hostnameOrIp {
			filtered = append(filtered, b)
		}
	}
	return filtered
}

type Bitaxe struct {
	Ip       string `yaml:"ip"`
	Hostname string `yaml:"hostname"`

	// Mac is the device's MAC address (colons/hyphens optional, normalized
	// by StorageKey) -- the storage-directory key, stable across IP/
	// location changes unlike Ip. Manually configured, same as Ip/Hostname/
	// Model -- there's no separate auto-discovery mechanism, so it stays in
	// sync with whatever the operator already knows to rename data
	// directories by.
	Mac string `yaml:"mac"`

	Model string `yaml:"model"`

	Enabled            bool `yaml:"enabled"`
	RestartAfterUpdate bool `yaml:"restartAfterUpdate"`

	Url  string `yaml:"url"`
	Port int    `yaml:"port"`
	User string `yaml:"user"`

	FallbackURL  string `yaml:"fallbackUrl"`
	FallbackPort int    `yaml:"fallbackPort"`
	FallbackUser string `yaml:"fallbackUser"`

	PoolSchedule []CronSchedule `yaml:"poolSchedule,omitempty"`
}

type CronSchedule struct {
	Cron   string     `yaml:"cron"`
	Target PoolTarget `yaml:"target"`
}

type Wifi struct {
	On   bool   `yaml:"on"`
	Name string `yaml:"ssid"`
	Pwd  string `yaml:"pwd"`
}

type BitaxeServerSettings struct {
	Url          string `json:"stratumURL"`
	Port         int    `json:"stratumPort"`
	User         string `json:"stratumUser"`
	FallbackURL  string `json:"fallbackStratumURL"`
	FallbackPort int    `json:"fallbackStratumPort"`
	FallbackUser string `json:"fallbackStratumUser"`
}

type BitaxeWifiSettings struct {
	Name     string `json:"ssid"`
	Pwd      string `json:"wifiPass"`
	Hostname string `json:"hostname"`
}

func (b Bitaxe) GetPoolsSettings(target PoolTarget) (*BitaxeServerSettings, error) {
	switch target {
	case Primary:
		return &BitaxeServerSettings{
			Url:          b.Url,
			Port:         b.Port,
			User:         b.User,
			FallbackURL:  b.FallbackURL,
			FallbackPort: b.FallbackPort,
			FallbackUser: b.FallbackUser,
		}, nil
	case Fallback:
		return &BitaxeServerSettings{
			Url:          b.FallbackURL,
			Port:         b.FallbackPort,
			User:         b.FallbackUser,
			FallbackURL:  b.Url,
			FallbackPort: b.Port,
			FallbackUser: b.User,
		}, nil
	default:
		return nil, fmt.Errorf("pool type '%v' not managed", target)
	}
}

// macSeparators strips the colon/hyphen separators a MAC address is
// conventionally written with -- the stored/pushed form is bare hex (e.g.
// "aabbccddeeff"), simpler and more portable as a directory name than
// "aa:bb:cc:dd:ee:ff" (no tool/filesystem quirks to worry about around ':').
var macSeparators = strings.NewReplacer(":", "", "-", "")

// NormalizeMac strips separators and lowercases a MAC address -- the
// canonical form used both as the storage key and to compare a configured
// mac against what a device actually reports.
func NormalizeMac(mac string) string {
	return strings.ToLower(macSeparators.Replace(mac))
}

// StorageKey is the directory name a miner's data lives under -- its
// (normalized) MAC address, required and manually configured (mac:), same
// as Ip/Hostname/Model. Empty if not yet configured -- callers must treat
// that as "this device isn't set up for storage yet", not fall back to Ip.
func (b Bitaxe) StorageKey() string {
	return NormalizeMac(b.Mac)
}

func (b Bitaxe) GetWifiSettings(wifi Wifi) BitaxeWifiSettings {
	return BitaxeWifiSettings{
		Name:     wifi.Name,
		Pwd:      wifi.Pwd,
		Hostname: b.Hostname,
	}
}

type GlobalConfig struct {
	Env string `yaml:"env"`
}

type ServerConfig struct {
	Port string `yaml:"port"`
}

type FeederConfig struct {
	Interval time.Duration `yaml:"interval"`
}

type HealthCheckConfig struct {
	Interval time.Duration `yaml:"interval"`
}

type StorageConfig struct {
	DataDir   string `yaml:"dataDir"`
	BoardsDir string `yaml:"boardsDir"` // explicit boards path for remote-dashboard-api; defaults to {dataDir}/data/boards
}

// BitaxesDir returns the directory that holds per-miner data folders.
func (s StorageConfig) BitaxesDir() string {
	return filepath.Join(s.DataDir, "data", "bitaxes")
}

// ResolveBoardsDir returns the boards root directory.
// Uses boardsDir from config if set; falls back to {dataDir}/data/boards.
func (s StorageConfig) ResolveBoardsDir() string {
	if s.BoardsDir != "" {
		return s.BoardsDir
	}
	return filepath.Join(s.DataDir, "data", "boards")
}

// ResolveHashboardDataDir returns hashboard's shared data root — the parent
// of boards/, alongside its accounts/ and sessions/ directories (see
// hashboard/server/internal/storage.Store) — used to check a board's
// public/private flag and validate session cookies. No separate config key:
// boards/ is always a direct child of this same root.
func (s StorageConfig) ResolveHashboardDataDir() string {
	return filepath.Dir(s.ResolveBoardsDir())
}

type EndpointConfig struct {
	Timeout time.Duration `yaml:"timeout"`
	Info    string        `yaml:"info"`    // Get system information
	System  string        `yaml:"system"`  // Update system settings
	Restart string        `yaml:"restart"` // Restart the miner
}

type FirmwareConfig struct {
	CacheTTL time.Duration     `yaml:"cacheTTL"`
	Repos    map[string]string `yaml:"repos"`
}

type PoolsConfig struct {
	// Dashboards maps a stratum pool hostname to its web dashboard URL template.
	// Use {user} as placeholder — replaced by the account part of the stratum user (before the first dot).
	// Example: "stratum.braiins.com" -> "https://pool.braiins.com/mining/overview/{user}"
	Dashboards map[string]string `yaml:"dashboards"`
}

type ElectricityConfig struct {
	// RatePerKwh is the electricity cost in euros per kilowatt-hour (e.g. 0.1915 for 19.15 cts/kWh).
	RatePerKwh float64 `yaml:"ratePerKwh"`
}

type RemoteConfig struct {
	PushURL string `yaml:"pushURL"`
	APIKey  string `yaml:"apiKey"`
}
