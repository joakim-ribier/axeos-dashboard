// internal/handler/config.go
package handler

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/discovery"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/firmware"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/remotepush"
)

// bitaxesResponse wraps a list of miner entries the same way the managed
// miners file itself is shaped (bitaxes: [...]) -- shared by every
// handler in this file that returns Bitaxe entries (discovered or
// already configured).
// LastUpdated is the managed miners file's own mtime (RFC3339, UTC), omitted
// when there's no file to stat yet (fresh install) or on a discovery
// response, which never reflects the file on disk.
type bitaxesResponse struct {
	Bitaxes     []config.Bitaxe `json:"bitaxes"`
	LastUpdated string          `json:"lastUpdated,omitempty"`
}

// ListMinersConfig returns every miner entry currently in the managed
// miners config -- including disabled ones, so the UI can show and let the
// operator re-enable them, unlike GET /api/miners (dashboard data) which
// only ever lists enabled miners. Read-only: no file is touched here, this
// just echoes what's already loaded in memory.
//
// @Summary List configured miners
// @Description Returns every miner entry in the managed miners config, including disabled ones. Read-only -- see POST/DELETE for writing.
// @Tags dashboard-api
// @Produce json
// @Success 200 {object} handler.bitaxesResponse
// @Router /api/config/miners [get]
func ListMinersConfig(cfg config.Config, w http.ResponseWriter, _ *http.Request) {
	writeBitaxesResponse(w, cfg.Bitaxes, managedFileLastUpdated(cfg.MinersFilePath))
}

// managedFileLastUpdated stats a managed config file (miners.yml,
// settings.yml, ...) and returns its mtime as RFC3339 (UTC) -- the
// same precision SaveMiners'/SaveAppSettings' own header comment uses.
// Returns "" if path is empty (no managed file configured) or the file
// can't be stat'd (e.g. not written yet), so the field is simply omitted
// from the response rather than surfacing a spurious error.
func managedFileLastUpdated(path string) string {
	if path == "" {
		return ""
	}
	info, err := os.Stat(path)
	if err != nil {
		return ""
	}
	return info.ModTime().UTC().Format(time.RFC3339)
}

// normalizedMacPattern matches a normalized MAC (see config.NormalizeMac):
// exactly 12 lowercase hex digits, no separators.
var normalizedMacPattern = regexp.MustCompile(`^[0-9a-f]{12}$`)

// SaveMinersConfig upserts one or more miner entries into the managed
// miners config file, matched by (normalized) MAC. An entry whose MAC
// isn't already configured is appended and force-enabled regardless of
// what the client sent -- a freshly discovered/added miner must never
// silently land disabled where nothing in the UI would explain why it's
// not being polled. An entry that matches an existing MAC replaces it
// in place (keeping its position in the file), enabled value included --
// this is also how a future edit/toggle flow reuses this same endpoint.
//
// @Summary Add or update configured miners
// @Description Upserts one or more miner entries into the managed miners file, matched by MAC. New entries are always saved enabled.
// @Tags dashboard-api
// @Accept json
// @Param request body handler.bitaxesResponse true "Miner entries to add/update"
// @Produce json
// @Success 200 {object} handler.bitaxesResponse "the full, updated list of configured miners"
// @Failure 400 {object} handler.ErrorResponse "invalid request body or entry"
// @Failure 409 {object} handler.ErrorResponse "server not started with -miners -- nowhere safe to write"
// @Failure 500 {object} handler.ErrorResponse "failed to write the miners file"
// @Router /api/config/miners [post]
//
// Returns the merged list and true on success -- the router uses this to
// update its own in-memory config.Bitaxes immediately, so this same
// process's GET /api/config/miners (and the Settings page) reflects the
// save right away without a restart. The feeder (a separate OS process)
// and dashboard-api's own health-check/pool-scheduler loops still won't
// pick up the change until they're restarted, or until hot-reload lands
// -- this only keeps the config *listing* self-consistent, not the live
// dashboard data.
func SaveMinersConfig(cfg config.Config, w http.ResponseWriter, r *http.Request) ([]config.Bitaxe, bool) {
	if cfg.MinersFilePath == "" {
		writeErrorResponse(w,
			"dashboard-api wasn't started with -miners <path> -- there's no managed file to write to",
			http.StatusConflict)
		return nil, false
	}

	var body bitaxesResponse
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErrorResponse(w, "invalid request body: "+err.Error(), http.StatusBadRequest)
		return nil, false
	}
	if len(body.Bitaxes) == 0 {
		writeErrorResponse(w, "no miners provided", http.StatusBadRequest)
		return nil, false
	}
	for i, b := range body.Bitaxes {
		if err := validateBitaxe(b); err != nil {
			writeErrorResponse(w, fmt.Sprintf("entry %d (%s): %v", i, b.Hostname, err), http.StatusBadRequest)
			return nil, false
		}
	}

	merged, err := upsertBitaxes(cfg.Bitaxes, body.Bitaxes)
	if err != nil {
		writeErrorResponse(w, err.Error(), http.StatusBadRequest)
		return nil, false
	}

	if err := config.SaveMiners(cfg.MinersFilePath, merged); err != nil {
		writeErrorResponse(w, "failed to save miners config: "+err.Error(), http.StatusInternalServerError)
		return nil, false
	}

	writeBitaxesResponse(w, merged, managedFileLastUpdated(cfg.MinersFilePath))
	return merged, true
}

// validateBitaxe checks the handful of fields a saved entry can't do
// without -- everything else (pools, model) is free-form, same as
// hand-writing the managed miners file.
func validateBitaxe(b config.Bitaxe) error {
	if b.Ip == "" {
		return fmt.Errorf("ip is required")
	}
	if net.ParseIP(b.Ip) == nil {
		return fmt.Errorf("ip %q is not a valid IPv4/IPv6 address", b.Ip)
	}
	if b.Hostname == "" {
		return fmt.Errorf("hostname is required")
	}
	if !normalizedMacPattern.MatchString(config.NormalizeMac(b.Mac)) {
		return fmt.Errorf("mac %q is not a valid MAC address", b.Mac)
	}
	if err := validateSchedule(b.Schedule); err != nil {
		return err
	}
	return nil
}

// validateSchedule checks every entry the same way the scheduler itself
// would need to accept it -- a bad cron string or an unknown action must
// be rejected here, at save time, rather than silently failing to register
// once scheduler.Scheduler picks it up. Also rejects two entries with the
// same (normalized) cron expression on the same miner -- both would fire
// at the exact same moment and race each other's action, regardless of
// what each one does.
func validateSchedule(schedule []config.CronSchedule) error {
	seen := make(map[string]bool, len(schedule))
	for i, s := range schedule {
		if err := config.ValidateCronSchedule(s.Cron); err != nil {
			return fmt.Errorf("schedule[%d]: invalid cron %q: %w", i, s.Cron, err)
		}
		switch s.Action {
		case config.ActionSwitchPrimary, config.ActionSwitchFallback, config.ActionRestart:
		default:
			return fmt.Errorf("schedule[%d]: action %q must be %q, %q or %q", i, s.Action,
				config.ActionSwitchPrimary, config.ActionSwitchFallback, config.ActionRestart)
		}
		key := config.NormalizeCronExpression(s.Cron)
		if seen[key] {
			return fmt.Errorf("schedule[%d]: duplicate cron %q -- already scheduled for this miner", i, s.Cron)
		}
		seen[key] = true
	}
	return nil
}

// upsertBitaxes merges incoming into existing by normalized MAC: a MAC
// already present is replaced in place (position preserved), a new one is
// appended with Enabled forced true. Returns an error if incoming itself
// contains the same MAC twice -- ambiguous, the caller must resolve which
// one wins before saving rather than have the server pick silently.
func upsertBitaxes(existing, incoming []config.Bitaxe) ([]config.Bitaxe, error) {
	merged := append([]config.Bitaxe{}, existing...)

	indexByMac := make(map[string]int, len(merged))
	for i, b := range merged {
		indexByMac[config.NormalizeMac(b.Mac)] = i
	}

	seen := make(map[string]bool, len(incoming))
	for _, b := range incoming {
		key := config.NormalizeMac(b.Mac)
		if seen[key] {
			return nil, fmt.Errorf("duplicate mac %s in request", b.Mac)
		}
		seen[key] = true

		if idx, ok := indexByMac[key]; ok {
			merged[idx] = b
			continue
		}
		b.Enabled = true
		merged = append(merged, b)
		indexByMac[key] = len(merged) - 1
	}
	return merged, nil
}

// Discover finds AxeOS devices on the network, in one of two mutually
// exclusive modes selected by which query param is set:
//   - ip: probe exactly that one address (use when a device isn't on the
//     server's own subnet -- different VLAN/network the scan wouldn't reach).
//   - cidr: sweep every host in that range in parallel (max /24 = 254
//     hosts). If neither ip nor cidr is given, cidr defaults to the
//     server's own local /24 subnet (auto-detected) -- the common case of
//     "scan whatever network this server is on".
//
// Either way, each device found comes back as a ready-to-save entry
// shaped like the managed miners file, pre-filled from what the device
// itself reports (hostname, mac, guessed model, and its currently
// configured pool).
//
// @Summary Discover AxeOS devices on the network
// @Description Probes a single IP (?ip=) or sweeps a CIDR range (?cidr=, max /24, defaults to the server's own local /24 subnet when both are omitted). ip takes priority if both are set.
// @Tags dashboard-api
// @Param ip query string false "Probe exactly this one IP instead of scanning a range (e.g. a device on a different VLAN than the server). Takes priority over cidr."
// @Param cidr query string false "Network range to sweep, e.g. '192.168.1.0/24' (max /24 = 254 hosts). Omitted: auto-detects and scans the server's own local /24 subnet. Ignored if ip is set."
// @Param timeout query string false "Per-host probe timeout, e.g. '500ms' or '2s' (default 1s, capped at 3s). Raise it and retry if a scan/probe found nothing on a slow network."
// @Produce json
// @Success 200 {object} handler.bitaxesResponse
// @Failure 400 {object} handler.ErrorResponse "invalid/too-large cidr, or invalid/too-large timeout"
// @Failure 404 {object} handler.ErrorResponse "no AxeOS device found at the given ip"
// @Router /api/config/discover [get]
func Discover(cfg config.Config, w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	endpoint := cfg.Endpoints.Info

	timeout, err := parseProbeTimeout(r.URL.Query().Get("timeout"))
	if err != nil {
		writeErrorResponse(w, err.Error(), http.StatusBadRequest)
		return
	}

	if ip := r.URL.Query().Get("ip"); ip != "" {
		b, err := discovery.Probe(ctx, endpoint, timeout, ip)
		if err != nil {
			writeErrorResponse(w, err.Error(), http.StatusNotFound)
			return
		}
		writeBitaxesResponse(w, []config.Bitaxe{b}, "")
		return
	}

	cidr := r.URL.Query().Get("cidr")
	if cidr == "" {
		var err error
		cidr, err = discovery.LocalCIDR()
		if err != nil {
			writeErrorResponse(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}

	found, err := discovery.Scan(ctx, endpoint, timeout, cidr)
	if err != nil {
		writeErrorResponse(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeBitaxesResponse(w, found, "")
}

// parseProbeTimeout resolves the optional ?timeout= query param into a
// duration, defaulting to discovery.DefaultProbeTimeout when absent and
// rejecting anything invalid or above discovery.MaxProbeTimeout.
func parseProbeTimeout(raw string) (time.Duration, error) {
	if raw == "" {
		return discovery.DefaultProbeTimeout, nil
	}
	timeout, err := time.ParseDuration(raw)
	if err != nil {
		return 0, fmt.Errorf("invalid timeout %q: %w", raw, err)
	}
	if timeout <= 0 {
		return 0, fmt.Errorf("timeout must be positive, got %q", raw)
	}
	if timeout > discovery.MaxProbeTimeout {
		return 0, fmt.Errorf("timeout %q exceeds the max of %s", raw, discovery.MaxProbeTimeout)
	}
	return timeout, nil
}

func writeBitaxesResponse(w http.ResponseWriter, bitaxes []config.Bitaxe, lastUpdated string) {
	if bitaxes == nil {
		bitaxes = []config.Bitaxe{}
	}
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(bitaxesResponse{Bitaxes: bitaxes, LastUpdated: lastUpdated}); err != nil {
		http.Error(w, "failed to encode response", http.StatusInternalServerError)
	}
}

// appSettingsResponse is the shape of GET/POST /api/config/settings.
// config.AppSettingsFile here carries the user's overrides only --
// Pools.Dashboards/Firmware.Repos are whatever's actually stored in
// settings.yml (possibly empty), not the merged effective view
// (see Defaults for that). Also carries a read-only snapshot of a few
// process-launch settings shown for visibility only. Those never round-trip
// through SaveAppSettings: no hot-reload exists for them, so changing them
// still means hand-editing dashboard.yml and restarting, same as before
// this endpoint existed.
type appSettingsResponse struct {
	config.AppSettingsFile
	Defaults    appSettingsDefaults `json:"defaults"`
	ReadOnly    appSettingsReadOnly `json:"readOnly"`
	LastUpdated string              `json:"lastUpdated,omitempty"`
}

// appSettingsDefaults is the built-in registry (config.DefaultPoolDashboards/
// config.DefaultFirmwareRepos) the UI displays read-only next to the
// editable override lists -- adding a well-known pool or fixing a
// firmware repo URL is a code change (see server/internal/config/defaults.go),
// not something this endpoint ever writes to.
type appSettingsDefaults struct {
	Pools    config.PoolsConfig         `json:"pools"`
	Firmware config.AppSettingsFirmware `json:"firmware"`
}

func defaultAppSettings() appSettingsDefaults {
	return appSettingsDefaults{
		Pools:    config.PoolsConfig{Dashboards: config.DefaultPoolDashboards},
		Firmware: config.AppSettingsFirmware{Repos: config.DefaultFirmwareRepos},
	}
}

type appSettingsReadOnly struct {
	FeederInterval      string `json:"feederInterval"`
	HealthCheckInterval string `json:"healthCheckInterval"`
	FirmwareCacheTTL    string `json:"firmwareCacheTTL"`
	// FirmwareCacheCheckedAt is the most recent CheckedAt across every
	// model in the firmware cache (RFC3339, UTC) -- omitted if the cache
	// is empty (nothing checked yet, e.g. fresh install or no miner has
	// triggered a check). Lets the UI show "was this actually run" rather
	// than just the configured TTL.
	FirmwareCacheCheckedAt string `json:"firmwareCacheCheckedAt,omitempty"`
	// RemotePushMinersConfig/RemotePushSettingsConfig mirror
	// remotepush.Status's two independently-tracked config push attempts
	// (RFC3339, UTC) -- the feeder's own record of its last attempt to
	// push each config endpoint to hashboard, read back from disk since
	// the feeder is a separate OS process. Kept separate rather than
	// merged into one field so the Settings page can show both endpoints'
	// health at once: one succeeding must never hide the other currently
	// failing (see remotepush.Status). Each is its zero value when that
	// endpoint has never been attempted (no status file yet).
	RemotePushMinersConfig   remotePushEndpointStatus `json:"remotePushMinersConfig"`
	RemotePushSettingsConfig remotePushEndpointStatus `json:"remotePushSettingsConfig"`
}

type remotePushEndpointStatus struct {
	LastAttemptAt string `json:"lastAttemptAt,omitempty"`
	LastSuccessAt string `json:"lastSuccessAt,omitempty"`
	LastError     string `json:"lastError,omitempty"`
}

func toRemotePushEndpointStatus(a remotepush.Attempt) remotePushEndpointStatus {
	var s remotePushEndpointStatus
	if !a.LastAttemptAt.IsZero() {
		s.LastAttemptAt = a.LastAttemptAt.UTC().Format(time.RFC3339)
	}
	if !a.LastSuccessAt.IsZero() {
		s.LastSuccessAt = a.LastSuccessAt.UTC().Format(time.RFC3339)
	}
	s.LastError = a.LastError
	return s
}

// GetAppSettings returns the current settings.yml overrides plus the
// built-in defaults and the read-only process-launch settings (see
// appSettingsResponse). Read-only: no file is touched here, current is
// whatever the caller already has in memory for the managed file (see
// Router's GET /api/config/settings route, which reloads the shared
// AppSettingsStore) and cfg is the already-merged config (see
// Router.snapshotConfig) used only for the read-only process settings.
//
// @Summary Get app settings
// @Description Returns the settings.yml overrides, the built-in defaults for pool dashboards/firmware repos, and a read-only snapshot of process-launch settings (poll intervals, firmware cache TTL) shown for visibility only.
// @Tags dashboard-api
// @Produce json
// @Success 200 {object} handler.appSettingsResponse
// @Router /api/config/settings [get]
func GetAppSettings(cfg config.Config, current config.AppSettingsFile, w http.ResponseWriter, _ *http.Request) {
	writeAppSettingsResponse(w, cfg, current)
}

// SaveAppSettings validates and persists the editable app settings
// (electricity rate, pool dashboard links, remote push credentials,
// firmware repos) to the managed settings.yml file.
//
// @Summary Save app settings
// @Description Validates and persists the editable subset of app settings to settings.yml.
// @Tags dashboard-api
// @Accept json
// @Param request body config.AppSettingsFile true "Settings to save"
// @Produce json
// @Success 200 {object} handler.appSettingsResponse
// @Failure 400 {object} handler.ErrorResponse "invalid settings"
// @Failure 409 {object} handler.ErrorResponse "server has no resolvable config path -- nowhere safe to write"
// @Failure 500 {object} handler.ErrorResponse "failed to write the app-settings file"
// @Router /api/config/settings [post]
//
// Returns the saved settings and true on success -- the router uses this
// to update its own in-memory store immediately (see
// config.AppSettingsStore.Set), same contract as SaveMinersConfig.
func SaveAppSettings(cfg config.Config, w http.ResponseWriter, r *http.Request) (config.AppSettingsFile, bool) {
	if cfg.AppSettingsFilePath == "" {
		writeErrorResponse(w, "dashboard-api has no resolvable config path -- there's no managed file to write to", http.StatusConflict)
		return config.AppSettingsFile{}, false
	}

	var settings config.AppSettingsFile
	if err := json.NewDecoder(r.Body).Decode(&settings); err != nil {
		writeErrorResponse(w, "invalid request body: "+err.Error(), http.StatusBadRequest)
		return config.AppSettingsFile{}, false
	}

	if err := validateAppSettings(settings); err != nil {
		writeErrorResponse(w, err.Error(), http.StatusBadRequest)
		return config.AppSettingsFile{}, false
	}

	if err := config.SaveAppSettings(cfg.AppSettingsFilePath, settings); err != nil {
		writeErrorResponse(w, "failed to save app settings: "+err.Error(), http.StatusInternalServerError)
		return config.AppSettingsFile{}, false
	}

	writeAppSettingsResponse(w, cfg, settings)
	return settings, true
}

// validateAppSettings checks the handful of things a saved entry can't do
// without -- everything else is free-form, same principle as
// validateBitaxe/validateSchedule.
func validateAppSettings(s config.AppSettingsFile) error {
	if s.Electricity.RatePerKwh < 0 {
		return fmt.Errorf("electricity.ratePerKwh must not be negative")
	}
	for host, dashboardURL := range s.Pools.Dashboards {
		if host == "" {
			return fmt.Errorf("pools.dashboards: a pool hostname is empty")
		}
		if dashboardURL == "" {
			return fmt.Errorf("pools.dashboards[%s]: dashboard URL is empty", host)
		}
	}
	if s.Remote.PushURL != "" {
		if _, err := url.ParseRequestURI(s.Remote.PushURL); err != nil {
			return fmt.Errorf("remote.pushURL %q is not a valid URL: %w", s.Remote.PushURL, err)
		}
	}
	for model, repo := range s.Firmware.Repos {
		if model != config.ModelBitaxe && model != config.ModelNerdaxe {
			return fmt.Errorf("firmware.repos: unknown model %q (must be %q or %q)", model, config.ModelBitaxe, config.ModelNerdaxe)
		}
		if repo == "" {
			return fmt.Errorf("firmware.repos[%s]: repo URL is empty", model)
		}
		if _, err := url.ParseRequestURI(repo); err != nil {
			return fmt.Errorf("firmware.repos[%s] %q is not a valid URL: %w", model, repo, err)
		}
	}
	return nil
}

func writeAppSettingsResponse(w http.ResponseWriter, cfg config.Config, settings config.AppSettingsFile) {
	// A zero-value AppSettingsFile (e.g. before settings.yml has ever
	// been saved) has nil maps here, which encode as JSON null -- the
	// frontend's Zod schema expects an object (possibly empty), not null.
	if settings.Pools.Dashboards == nil {
		settings.Pools.Dashboards = map[string]string{}
	}
	if settings.Firmware.Repos == nil {
		settings.Firmware.Repos = map[config.Model]string{}
	}
	readOnly := appSettingsReadOnly{
		FeederInterval:      cfg.Feeder.Interval.String(),
		HealthCheckInterval: cfg.HealthCheck.Interval.String(),
		FirmwareCacheTTL:    cfg.Firmware.CacheTTL.String(),
	}
	fwCache := firmware.LoadCache(getDataRoot(cfg.Storage))
	if checkedAt := firmware.LatestCheck(fwCache); !checkedAt.IsZero() {
		readOnly.FirmwareCacheCheckedAt = checkedAt.UTC().Format(time.RFC3339)
	}
	pushStatus := remotepush.Load(getDataRoot(cfg.Storage))
	readOnly.RemotePushMinersConfig = toRemotePushEndpointStatus(pushStatus.MinersConfig)
	readOnly.RemotePushSettingsConfig = toRemotePushEndpointStatus(pushStatus.SettingsConfig)
	resp := appSettingsResponse{
		AppSettingsFile: settings,
		Defaults:        defaultAppSettings(),
		ReadOnly:        readOnly,
		LastUpdated:     managedFileLastUpdated(cfg.AppSettingsFilePath),
	}
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		http.Error(w, "failed to encode response", http.StatusInternalServerError)
	}
}
