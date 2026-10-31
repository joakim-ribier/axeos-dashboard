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
	Mailer      MailerConfig      `yaml:"mailer"`
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
	// Notifications only ever come from settings.yml (see AppSettingsFile)
	// -- never read from dashboard.yml.
	Notifications NotificationsConfig `yaml:"-"`
	UI            UIConfig            `yaml:"ui"`

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

	// MailTemplatesDir is where the mailer's editable templates live, a
	// "mail-templates" folder next to the config file -- "" without one
	// loaded, the built-in templates then used as they are.
	MailTemplatesDir string `yaml:"-"`

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

	// Alias is an optional operator-set override for the display name shown
	// in the UI wherever Hostname would otherwise be shown (see
	// DisplayName). Unlike Hostname -- which a network discovery re-probe
	// (see internal/discovery, and the "select an already-configured
	// device" refresh flow in the Settings UI) silently overwrites with
	// whatever the device itself reports -- Alias is never touched by
	// discovery, so it's the one place a custom, human-chosen name survives
	// a refresh.
	Alias string `yaml:"alias,omitempty" json:"alias,omitempty"`

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

// DisplayName returns Alias if the operator has set one, otherwise
// Hostname -- the effective label the UI shows for this miner.
func (b Bitaxe) DisplayName() string {
	if b.Alias != "" {
		return b.Alias
	}
	return b.Hostname
}

type GlobalConfig struct {
	Env string `yaml:"env"`
}

type ServerConfig struct {
	Port string `yaml:"port"`
}

// MailerConfig is where the mailer's own API listens -- on the loopback
// only, so dashboard-api (same host, same container) is its one caller and
// every test mail goes through its audited route.
type MailerConfig struct {
	Port string `yaml:"port"`
}

// Address is the mailer API's host:port, default port 8082.
func (m MailerConfig) Address() string {
	port := m.Port
	if port == "" {
		port = "8082"
	}
	return "127.0.0.1:" + port
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

// Layout under storage.dataDir, slash-separated so the same paths also name
// a backup archive's entries (see internal/backup).
const (
	BitaxesRelDir = "data/bitaxes"
	BackupsRelDir = "data/backups"
	BoardsRelDir  = "data/boards"
	AuditRelDir   = "data/audit"
	AlertsRelDir  = "data/alerts"
	MailRelDir    = "data/mail"
	// BoardBitaxesDirName is each board's miners directory, under
	// BoardsRelDir/{boardId}.
	BoardBitaxesDirName = "bitaxes"
)

// BitaxesDir returns the directory that holds per-miner data folders.
func (s StorageConfig) BitaxesDir() string {
	return filepath.Join(s.DataDir, filepath.FromSlash(BitaxesRelDir))
}

// BackupsDir returns the directory that holds the monthly backup archives.
func (s StorageConfig) BackupsDir() string {
	return filepath.Join(s.DataDir, filepath.FromSlash(BackupsRelDir))
}

// AuditDir returns the directory that holds the daily audit logs.
func (s StorageConfig) AuditDir() string {
	return filepath.Join(s.DataDir, filepath.FromSlash(AuditRelDir))
}

// AlertsDir returns the directory that holds the daily logs of the alerts'
// changes of state.
func (s StorageConfig) AlertsDir() string {
	return filepath.Join(s.DataDir, filepath.FromSlash(AlertsRelDir))
}

// MailDir returns the directory that holds the state of the scheduled mails
// (when each last went out).
func (s StorageConfig) MailDir() string {
	return filepath.Join(s.DataDir, filepath.FromSlash(MailRelDir))
}

// ResolveBoardsDir returns the boards root directory: {dataDir}/data/boards,
// the same layout hashboard itself writes to (see hashboard's
// storage.BoardBitaxesDir). remote-dashboard-api must run on the same
// machine as hashboard-api (or share its data dir) regardless -- for local
// dev against a sibling hashboard checkout, point dataDir itself at that
// checkout's own resources dir (e.g. ../hashboard/resources), not just
// this repo's own resources/.
func (s StorageConfig) ResolveBoardsDir() string {
	return filepath.Join(s.DataDir, filepath.FromSlash(BoardsRelDir))
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

	// Devices are the non-miner power consumers (fan, router...), declared by
	// hand since nothing can poll them -- so the installation's figures
	// they feed are only ever an informative estimate, kept apart from the
	// miners' measured ones.
	Devices []PowerDevice `yaml:"devices,omitempty" json:"devices,omitempty"`
}

// PowerDevice is one non-miner power consumer, assumed always on.
type PowerDevice struct {
	Name string `yaml:"name" json:"name"`
	// Power is the device's constant draw, in watts.
	Power float64 `yaml:"power" json:"power"`
}

type RemoteConfig struct {
	PushURL string `yaml:"pushURL" json:"pushURL"`
	APIKey  string `yaml:"apiKey" json:"apiKey"`
	// SendUser, SendPools and SendIP opt in to pushing the stratum users (a
	// wallet address, often), the pools and the miners' IPs (a map of the
	// local network) -- off by default, nothing sensitive leaves the Pi
	// unless the operator asks for it. Without SendIP a board knows each
	// miner by an IPv6 made from its MAC instead (see the feeder's
	// maskedIP).
	SendUser  bool `yaml:"sendUser" json:"sendUser"`
	SendPools bool `yaml:"sendPools" json:"sendPools"`
	SendIP    bool `yaml:"sendIP" json:"sendIP"`
}

// Enabled reports whether the feeder has enough to push to hashboard --
// both PushURL and APIKey configured. The single source of truth for this
// check, so every call site (the feeder's per-miner push, its config push)
// stays in sync rather than repeating the same two-field comparison.
func (r RemoteConfig) Enabled() bool {
	return r.PushURL != "" && r.APIKey != ""
}

// NotificationsConfig is everything the dashboard sends on its own: how
// its messages read (language, links), the channels they go through (mail
// for now), and what goes out (the audit report, the alerts).
type NotificationsConfig struct {
	// Language is the messages' language: "fr" or "en" (the default).
	Language string `yaml:"language,omitempty" json:"language"`
	// DashboardURL is the dashboard's own address as reached from where the
	// messages are read (e.g. http://192.168.1.60) -- for their links.
	DashboardURL string            `yaml:"dashboardURL,omitempty" json:"dashboardURL"`
	Mail         MailConfig        `yaml:"mail,omitempty" json:"mail"`
	AuditReport  AuditReportConfig `yaml:"auditReport,omitempty" json:"auditReport"`
	Alerts       AlertsConfig      `yaml:"alerts,omitempty" json:"alerts"`
}

// AlertsConfig is how the alerts go out on their own.
type AlertsConfig struct {
	// Mail sends one mail per feeder poll that raised alerts -- never for
	// one that ends.
	Mail bool `yaml:"mail,omitempty" json:"mail"`
}

// MailConfig is the mail channel: where mails go out from, and to whom.
type MailConfig struct {
	SMTP SMTPConfig `yaml:"smtp" json:"smtp"`
	To   []string   `yaml:"to,omitempty" json:"to"`
}

// AuditReportConfig is the mail summing up the audit since the previous
// one, sent at night (UTC, like the audit's own days) at the chosen
// frequency. Turning it off keeps the
// rest as it was.
type AuditReportConfig struct {
	Enabled   bool            `yaml:"enabled,omitempty" json:"enabled"`
	Frequency ReportFrequency `yaml:"frequency,omitempty" json:"frequency"`
	// Types narrows it to these audit entry types -- all of them when empty.
	Types []string `yaml:"types,omitempty" json:"types"`
	// SkipIfEmpty sends nothing for a period nothing was recorded in.
	SkipIfEmpty bool `yaml:"skipIfEmpty,omitempty" json:"skipIfEmpty"`
}

// ReportFrequency is how often the audit report goes out -- each covering
// the period since the previous one.
type ReportFrequency string

const (
	ReportDaily      ReportFrequency = "daily"      // every night: the day before
	ReportEvery2Days ReportFrequency = "every2days" // every other night: the 2 days before
	ReportWeekly     ReportFrequency = "weekly"     // Sunday to Monday night: Monday to Sunday
	ReportMonthly    ReportFrequency = "monthly"    // the night of the 1st: the month before
)

// ReportFrequencies is every frequency, in the order the dashboard offers
// them.
var ReportFrequencies = []ReportFrequency{ReportDaily, ReportEvery2Days, ReportWeekly, ReportMonthly}

// SMTPSecurity is how the connection to the SMTP server is protected.
type SMTPSecurity string

const (
	// SMTPStartTLS upgrades a plain connection (usually port 587).
	SMTPStartTLS SMTPSecurity = "starttls"
	// SMTPTLS is TLS from the first byte (usually port 465).
	SMTPTLS SMTPSecurity = "tls"
	// SMTPNone is a plain connection -- a relay on the local network only.
	SMTPNone SMTPSecurity = "none"
)

type SMTPConfig struct {
	Host     string       `yaml:"host,omitempty" json:"host"`
	Port     int          `yaml:"port,omitempty" json:"port"`
	Security SMTPSecurity `yaml:"security,omitempty" json:"security"`
	Username string       `yaml:"username,omitempty" json:"username"`
	// Password is write-only through the API: it's stored here, but GET
	// /api/config/settings only ever says whether one is set (see
	// handler.appSettingsResponse).
	Password string `yaml:"password,omitempty" json:"password,omitempty"`
	From     string `yaml:"from,omitempty" json:"from"`
}

// Configured reports whether there's enough to send a mail at all.
func (s SMTPConfig) Configured() bool {
	return s.Host != "" && s.Port > 0 && s.From != ""
}

// AppSettingsFile is the shape of the managed settings.yml file --
// the operational subset of dashboard.yml's config that's editable from
// the /settings page. Everything else
// (feeder.interval, healthCheck.interval, firmware.cacheTTL, server.port,
// storage.dataDir, ...) stays hand-edited-only in dashboard.yml: it's
// either process-launch config (no hot-reload exists for it) or a
// deployment-topology decision, not something an operator needs to
// change without a restart.
type AppSettingsFile struct {
	Electricity   ElectricityConfig   `yaml:"electricity" json:"electricity"`
	Pools         PoolsConfig         `yaml:"pools" json:"pools"`
	Remote        RemoteConfig        `yaml:"remote" json:"remote"`
	Firmware      AppSettingsFirmware `yaml:"firmware" json:"firmware"`
	Notifications NotificationsConfig `yaml:"notifications,omitempty" json:"notifications"`
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
	cfg.Notifications = a.Notifications
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
	// Backups controls the /backups page: "enabled" (default) shows it,
	// "hidden" hides the page and its nav entry. The feeder keeps creating
	// the archives either way.
	Backups UIVisibility `yaml:"backups"`
	// Audit controls the /audit page: "enabled" (default) shows it,
	// "hidden" hides the page and its nav entry. dashboard-api keeps
	// recording either way.
	Audit UIVisibility `yaml:"audit"`
}

type UIActionConfig struct {
	// MinerRestart/MinerPoolSwitch control the per-miner "restart" and
	// "switch pool" buttons on the dashboard: "enabled" shows a working
	// button, "readonly" shows it disabled (with a hint), "hidden" doesn't
	// render it at all.
	MinerRestart    UIVisibility `yaml:"minerRestart"`
	MinerPoolSwitch UIVisibility `yaml:"minerPoolSwitch"`
}
