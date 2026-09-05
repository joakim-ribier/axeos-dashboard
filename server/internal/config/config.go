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

// Model identifies which device family a miner is -- the two values this
// project actually knows how to talk to. Response parsing, field naming,
// and (see GetPoolsSettings) how a pool switch is even performed all
// differ by model.
type Model string

const (
	ModelBitaxe  Model = "bitaxe"
	ModelNerdaxe Model = "nerdaxe"
)

type Config struct {
	Global      GlobalConfig      `yaml:"global"`
	Server      ServerConfig      `yaml:"server"`
	Feeder      FeederConfig      `yaml:"feeder"`
	HealthCheck HealthCheckConfig `yaml:"healthCheck"`
	Bitaxes     []Bitaxe          `yaml:"bitaxes"`
	Storage     StorageConfig     `yaml:"storage"`
	Endpoints   EndpointConfig    `yaml:"endpoints"`
	Firmware    FirmwareConfig    `yaml:"firmware"`
	// Pools.Dashboards is computed at load time, not read from dashboard.yml
	// (see PoolsConfig.Dashboards) -- the outer field carries no yaml tag so
	// a pools: block left in dashboard.yml is silently ignored. AppSettingsFile.Pools
	// below is the one that still reads from YAML (settings.yml's own
	// pools: block, holding overrides only), since it's a distinct field
	// with its own tag even though it shares the PoolsConfig type.
	Pools       PoolsConfig       `yaml:"-"`
	Electricity ElectricityConfig `yaml:"electricity"`
	Remote      RemoteConfig      `yaml:"remote"`
	UI          UIConfig          `yaml:"ui"`

	// HashboardURL is the base URL of the hashboard instance backing this
	// remote-dashboard-api (remote-dashboard-api only): where the "private
	// board" access-request form posts to, and where the board owner's
	// account-management link points. Not configured by default -- set your
	// own deployment's URL (e.g. "http://localhost:8090" for local dev).
	HashboardURL string `yaml:"hashboardURL"`

	// MinersFilePath is the resolved path of the managed miners config: a
	// "miners.yml" file sitting right next to whatever -config file was
	// loaded (see LoadConfig). Always set after a successful load; a
	// runtime detail, never itself read from or written to dashboard.yml.
	MinersFilePath string `yaml:"-"`

	// AppSettingsFile optionally overrides where the managed app-settings
	// config lives (see the /settings page's "app settings" section).
	// Same resolution rules as MinersFile.
	AppSettingsFile string `yaml:"appSettingsFile,omitempty"`

	// AppSettingsFilePath is the actual, resolved path the managed
	// app-settings config was loaded from -- AppSettingsFile if set,
	// otherwise the default sibling "settings.yml" (see LoadConfig).
	// Always set after a successful load; a runtime detail, never itself
	// read from or written to dashboard.yml.
	AppSettingsFilePath string `yaml:"-"`
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
	Ip       string `yaml:"ip" json:"ip"`
	Hostname string `yaml:"hostname" json:"hostname"`

	// Mac is the device's MAC address (colons/hyphens optional, normalized
	// by StorageKey) -- the storage-directory key, stable across IP/
	// location changes unlike Ip. Populated either by hand or by the network
	// discovery flow (see internal/discovery), which reads it straight off
	// the device's own /api/system/info response.
	Mac string `yaml:"mac" json:"mac"`

	Model Model `yaml:"model" json:"model"`

	Enabled bool `yaml:"enabled" json:"enabled"`

	Url  string `yaml:"url" json:"url"`
	Port int    `yaml:"port" json:"port"`
	User string `yaml:"user" json:"user"`

	FallbackURL  string `yaml:"fallbackUrl" json:"fallbackUrl"`
	FallbackPort int    `yaml:"fallbackPort" json:"fallbackPort"`
	FallbackUser string `yaml:"fallbackUser" json:"fallbackUser"`

	Schedule []CronSchedule `yaml:"schedule,omitempty" json:"schedule,omitempty"`
}

// ScheduleAction is the action a scheduled job runs when its cron fires --
// either of the two pool switches a miner already supports manually, or a
// plain restart. Kept distinct from PoolTarget (which only ever means
// "which pool slot", used by the manual switch endpoint and
// GetPoolsSettings): a scheduled entry needs a third value action can take
// that a manual switch never does.
type ScheduleAction string

const (
	ActionSwitchPrimary  ScheduleAction = "switch_primary"
	ActionSwitchFallback ScheduleAction = "switch_fallback"
	ActionRestart        ScheduleAction = "restart"
)

type CronSchedule struct {
	Cron   string         `yaml:"cron" json:"cron"`
	Action ScheduleAction `yaml:"action" json:"action"`
}

type BitaxeServerSettings struct {
	Url          string `json:"stratumURL"`
	Port         int    `json:"stratumPort"`
	User         string `json:"stratumUser"`
	FallbackURL  string `json:"fallbackStratumURL"`
	FallbackPort int    `json:"fallbackStratumPort"`
	FallbackUser string `json:"fallbackStratumUser"`

	// UseFallbackStratum is the field that actually selects which pool a
	// bitaxe (ESP-Miner) device connects to -- ESP-Miner persists it in
	// NVS independently of which URL sits in the primary/fallback slots
	// (see main/http_server/http_server.c's check_settings_and_update, and
	// nvs_config.c's useFallbackStratum default). Swapping the URL fields
	// between slots without ever sending this flag looked like it worked
	// on older firmware, but stopped applying once ESP-Miner started
	// strictly honoring its own persisted value (bitaxeorg/ESP-Miner#1823,
	// shipped in v2.15.0) -- the device just kept using whichever pool
	// useFallbackStratum already pointed at. NerdQAxePlus (nerdaxe) has no
	// equivalent field -- see GetPoolsSettings.
	UseFallbackStratum bool `json:"useFallbackStratum"`
}

// GetPoolsSettings builds the PATCH /api/system payload that makes target
// the active pool -- the two supported models need genuinely different
// payloads, because they select the active pool in genuinely different
// ways:
//
//   - bitaxe (ESP-Miner firmware): primary/fallback URLs always stay in
//     their own fixed slots; UseFallbackStratum is the only thing that
//     actually switches the active pool (see its doc comment above).
//   - nerdaxe (NerdQAxePlus firmware): has no such field at all -- its
//     failover stratum manager (main/stratum/stratum_manager_fallback.cpp)
//     always tries whichever pool is in the *primary* slot first, and
//     only falls back to the secondary slot if the primary is actually
//     unreachable. The only way to make a specific pool active is to put
//     its settings in the primary slot, so target's pool is swapped into
//     Url/Port/User here and the other one into the Fallback* fields.
func (b Bitaxe) GetPoolsSettings(target PoolTarget) (*BitaxeServerSettings, error) {
	switch target {
	case Primary, Fallback:
	default:
		return nil, fmt.Errorf("pool type '%v' not managed", target)
	}

	if b.Model != ModelBitaxe {
		if target == Fallback {
			return &BitaxeServerSettings{
				Url:          b.FallbackURL,
				Port:         b.FallbackPort,
				User:         b.FallbackUser,
				FallbackURL:  b.Url,
				FallbackPort: b.Port,
				FallbackUser: b.User,
			}, nil
		}
		return &BitaxeServerSettings{
			Url:          b.Url,
			Port:         b.Port,
			User:         b.User,
			FallbackURL:  b.FallbackURL,
			FallbackPort: b.FallbackPort,
			FallbackUser: b.FallbackUser,
		}, nil
	}

	return &BitaxeServerSettings{
		Url:                b.Url,
		Port:               b.Port,
		User:               b.User,
		FallbackURL:        b.FallbackURL,
		FallbackPort:       b.FallbackPort,
		FallbackUser:       b.FallbackUser,
		UseFallbackStratum: target == Fallback,
	}, nil
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
	DataDir string `yaml:"dataDir"`
}

// BitaxesDir returns the directory that holds per-miner data folders.
func (s StorageConfig) BitaxesDir() string {
	return filepath.Join(s.DataDir, "data", "bitaxes")
}

// ResolveBoardsDir returns the boards root directory: {dataDir}/data/boards,
// the same layout hashboard itself writes to (see hashboard's
// storage.BoardBitaxesDir). remote-dashboard-api must run on the same
// machine as hashboard-api (or share its data dir) regardless -- for local
// dev against a sibling hashboard checkout, point dataDir itself at that
// checkout's own resources dir (e.g. ../hashboard/resources), not just
// this repo's own resources/.
func (s StorageConfig) ResolveBoardsDir() string {
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
	CacheTTL time.Duration `yaml:"cacheTTL"`
	// Repos is computed at load time (DefaultFirmwareRepos merged with any
	// settings.yml override, see mergeFirmwareRepos) -- no longer read
	// straight from dashboard.yml/remote-dashboard.yml, so it carries no
	// yaml tag; a firmware.repos: block left in either file is silently
	// ignored, same treatment as storage.retentionDays.
	Repos map[string]string `yaml:"-"`
}

// PoolsConfig is shared by two different roles, each populated a
// different way -- see the comments at each usage site:
//   - Config.Pools: never read from YAML (outer field has no yaml tag);
//     computed at load time as DefaultPoolDashboards merged with whatever
//     override AppSettingsFile.Pools carries (see mergePoolDashboards).
//     This is the "effective" view every consumer (toMinerInfo, etc.) reads.
//   - AppSettingsFile.Pools: read straight from settings.yml's own
//     pools: block, holding the user's custom/override entries only --
//     this is why Dashboards itself keeps its yaml tag, even though
//     Config.Pools's outer field doesn't use it.
type PoolsConfig struct {
	// Dashboards maps a stratum pool hostname to its web dashboard URL
	// template. Use {user} as placeholder — replaced by the account part
	// of the stratum user (before the first dot). Example:
	// "stratum.braiins.com" -> "https://pool.braiins.com/mining/overview/{user}"
	Dashboards map[string]string `yaml:"dashboards" json:"dashboards"`
}

type ElectricityConfig struct {
	// RatePerKwh is the electricity cost in euros per kilowatt-hour (e.g. 0.1915 for 19.15 cts/kWh).
	RatePerKwh float64 `yaml:"ratePerKwh" json:"ratePerKwh"`
}

type RemoteConfig struct {
	PushURL string `yaml:"pushURL" json:"pushURL"`
	APIKey  string `yaml:"apiKey" json:"apiKey"`
}

// Enabled reports whether the feeder has enough to push to hashboard --
// both PushURL and APIKey configured. The single source of truth for this
// check, so every call site (the feeder's per-miner push, its config push)
// stays in sync rather than repeating the same two-field comparison.
func (r RemoteConfig) Enabled() bool {
	return r.PushURL != "" && r.APIKey != ""
}

// AppSettingsFile is the shape of the managed settings.yml file --
// the operational subset of dashboard.yml's config that's editable from
// the /settings page (see readme/CONFIGURATION.md). Everything else
// (feeder.interval, healthCheck.interval, firmware.cacheTTL, server.port,
// storage.dataDir, ...) stays hand-edited-only in dashboard.yml: it's
// either process-launch config (no hot-reload exists for it) or a
// deployment-topology decision, not something an operator needs to
// change without a restart.
type AppSettingsFile struct {
	Electricity ElectricityConfig   `yaml:"electricity" json:"electricity"`
	Pools       PoolsConfig         `yaml:"pools" json:"pools"`
	Remote      RemoteConfig        `yaml:"remote" json:"remote"`
	Firmware    AppSettingsFirmware `yaml:"firmware" json:"firmware"`
}

// AppSettingsFirmware only ever carries Repos -- CacheTTL is process-launch
// config, not part of the managed/editable file (see AppSettingsFile). Keyed
// by Model (not a plain string) so an unknown model key is rejected at
// validation time rather than silently stored where nothing will ever read
// it back.
type AppSettingsFirmware struct {
	Repos map[Model]string `yaml:"repos" json:"repos"`
}

// ApplyTo overwrites cfg's operational subset with this AppSettingsFile's
// values. Electricity/Remote are a full replace, same as always.
// Pools.Dashboards/Firmware.Repos are handled differently: they're always
// recomputed as a fresh merge of the built-in defaults
// (DefaultPoolDashboards/DefaultFirmwareRepos) overlaid by whatever
// overrides this AppSettingsFile carries -- never an in-place mutation of
// cfg's existing map, so an override removed from settings.yml since
// the last reload actually disappears from the effective view instead of
// lingering in a shared map. Shared by LoadConfig (applying
// settings.yml at startup) and Router.snapshotConfig/Feeder.runOnce
// (applying a live reload on every request/tick).
func (a AppSettingsFile) ApplyTo(cfg *Config) {
	cfg.Electricity = a.Electricity
	cfg.Remote = a.Remote
	cfg.Pools.Dashboards = mergePoolDashboards(a.Pools.Dashboards)
	cfg.Firmware.Repos = mergeFirmwareRepos(a.Firmware.Repos)
}

// AppSettingsSnapshot builds an AppSettingsFile from this Config's current
// Electricity/Remote values, seeding AppSettingsStore before
// settings.yml has ever been saved (see cmd/dashboard-api/main.go,
// cmd/feeder/main.go). Pools/Firmware intentionally start with no
// overrides recorded -- the built-in defaults already cover them (merged
// in at read time by ApplyTo/GetAppSettings), and seeding this snapshot
// with the merged view instead would make GET /api/config/settings show
// the defaults as if they were user overrides, which would then get
// written into settings.yml verbatim on the very first Save.
func (c Config) AppSettingsSnapshot() AppSettingsFile {
	return AppSettingsFile{
		Electricity: c.Electricity,
		Remote:      c.Remote,
	}
}

// UIVisibility is a three-state switch for one page or action in the
// frontend: fully usable, visible but inert, or not shown at all. What
// "ReadOnly" actually means is up to whichever component reads it -- a
// page with both read-only content and a write action (e.g. Settings: the
// configured-miners table plus its save button) can show the former and
// hide the latter; a single button (e.g. restart) just renders itself
// disabled, with a hint explaining why.
type UIVisibility string

const (
	UIEnabled  UIVisibility = "enabled"
	UIReadOnly UIVisibility = "readonly"
	UIHidden   UIVisibility = "hidden"
)

// Normalized defaults the zero value (unset in dashboard.yml) to "enabled"
// -- one React codebase shows everything unless an operator opts a
// specific page/action out, rather than the frontend hardcoding what
// "local" vs "remote" means.
func (v UIVisibility) Normalized() UIVisibility {
	if v == "" {
		return UIEnabled
	}
	return v
}

// UIConfig restricts which pages/actions this instance's frontend shows,
// dashboard-api and remote-dashboard-api alike. Read by GET /api/info (see
// internal/handler/info.go) and applied client-side; not itself an
// authorization boundary on its own -- e.g. remote-dashboard-api's own
// GET /api/{boardId}/config/* endpoints (see internal/handler/remote_config.go)
// are always read-only regardless of what Page.Settings is set to, they're
// never the write endpoints /settings' Save actions call.
type UIConfig struct {
	Page   UIPageConfig   `yaml:"page"`
	Action UIActionConfig `yaml:"action"`
}

type UIPageConfig struct {
	// Settings controls the /settings page (miner discovery + config
	// editing): "enabled" (default) shows it in full, "readonly" shows it
	// without any write action, "hidden" hides the page and its nav entry
	// entirely.
	Settings UIVisibility `yaml:"settings"`
}

type UIActionConfig struct {
	// MinerRestart/MinerPoolSwitch control the per-miner "restart" and
	// "switch pool" buttons on the dashboard: "enabled" shows a working
	// button, "readonly" shows it disabled (with a hint), "hidden" doesn't
	// render it at all.
	MinerRestart    UIVisibility `yaml:"minerRestart"`
	MinerPoolSwitch UIVisibility `yaml:"minerPoolSwitch"`
}
