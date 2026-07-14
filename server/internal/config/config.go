// internal/config/config.go
package config

import (
	"fmt"
	"path/filepath"
	"time"

	"github.com/joakim-ribier/go-utils/pkg/slicesutil"
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
}

func (c Config) GetMiners() []Bitaxe {
	return slicesutil.FilterT(c.Bitaxes, func(b Bitaxe) bool { return b.Enabled })
}

func (c Config) GetMinersFilterBy(hostnameOrIp string) []Bitaxe {
	miners := c.GetMiners()
	if len(hostnameOrIp) > 0 {
		miners = slicesutil.FilterT(miners, func(b Bitaxe) bool {
			return b.Hostname == hostnameOrIp || b.Ip == hostnameOrIp
		})
	}
	return miners
}

type Bitaxe struct {
	Ip       string `yaml:"ip"`
	Hostname string `yaml:"hostname"`

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
