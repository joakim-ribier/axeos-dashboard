// ./cmd/feeder/feeder.go
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/bitaxe"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/firmware"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/model"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/storage"
)

type Feeder struct {
	logger *slog.Logger

	config           config.Config
	minersStore      *config.MinersStore
	appSettingsStore *config.AppSettingsStore
}

func NewFeeder(logger *slog.Logger, config config.Config) *Feeder {
	return &Feeder{
		logger: logger.With("namespace", "feeder"),
		config: config,
	}
}

// WithMinersStore attaches the shared miners store this Feeder reloads
// config.Bitaxes from at the start of every runOnce() cycle -- so a miner
// saved through the Settings UI (a separate dashboard-api process) starts
// getting polled on the feeder's next tick, without a restart. Optional: a
// Feeder with no store just keeps polling whatever Bitaxes it was
// constructed with, same as before this feature existed.
func (f *Feeder) WithMinersStore(store *config.MinersStore) *Feeder {
	f.minersStore = store
	return f
}

// WithAppSettingsStore attaches the shared app-settings store this Feeder
// reloads Electricity/Remote/Firmware.Repos from at the start of every
// runOnce() cycle -- so a setting saved through /settings (a separate
// dashboard-api process) applies to the feeder's next tick, without a
// restart. Optional, same reasoning as WithMinersStore.
func (f *Feeder) WithAppSettingsStore(store *config.AppSettingsStore) *Feeder {
	f.appSettingsStore = store
	return f
}

func (f *Feeder) Feed() {
	ctx, stop := signal.NotifyContext(
		context.Background(),
		os.Interrupt,
		syscall.SIGTERM,
	)
	defer stop()

	ticker := time.NewTicker(f.config.Feeder.Interval)
	defer ticker.Stop()

	f.runOnce(ctx)

	for {
		select {
		case <-ctx.Done():
			f.logger.Info("Feeder stopped")
			return
		case <-ticker.C:
			f.runOnce(ctx)
		}
	}
}

func (f *Feeder) runOnce(ctx context.Context) {
	now := time.Now()
	f.logger.Info("Fetching miners stats", "ts", now.UTC().Truncate(time.Second))

	if f.minersStore != nil {
		bitaxes, err := f.minersStore.Reload()
		if err != nil {
			f.logger.Error("failed to reload miners config", "error", err)
		}
		f.config.Bitaxes = bitaxes
	}

	// settingsSnapshot is the raw AppSettingsFile as loaded this cycle (only
	// settings.yml's own overrides, not the defaults-merged view ApplyTo
	// computes into f.config) -- kept aside so pushSettingsConfigToRemote
	// below can push the exact same shape GET /api/config/settings already
	// returns locally, rather than the merged Pools.Dashboards/Firmware.Repos.
	settingsSnapshot := f.config.AppSettingsSnapshot()
	if f.appSettingsStore != nil {
		settings, err := f.appSettingsStore.Reload()
		if err != nil {
			f.logger.Error("failed to reload app settings", "error", err)
		}
		settingsSnapshot = settings
		settings.ApplyTo(&f.config)
	}

	if f.config.Remote.Enabled() {
		// Pushed every cycle, not only on change -- keeps the remote copy an
		// exact mirror of what this feeder is actually running with right
		// now, rather than trusting a mtime-based diff to never miss an edit.
		go f.pushMinersConfigToRemote(f.config.Bitaxes)
		// Settings themselves are pushed further down, once the firmware
		// cache below has had a chance to refresh this cycle -- otherwise
		// firmwareCacheCheckedAt would always be one cycle stale.
	}

	if err := os.MkdirAll(f.config.Storage.BitaxesDir(), 0o755); err != nil {
		log.Fatalf("cannot create data dir: %v", err)
	}

	client := bitaxe.NewClient(f.logger, f.config.Endpoints.Info, f.config.Endpoints.Timeout)
	store := storage.NewRawStorage(f.config.Storage.BitaxesDir(), f.config.Electricity.RatePerKwh)
	fwCache := firmware.LoadCache(f.config.Storage.BitaxesDir())

	for _, bitaxe := range f.config.GetMiners() {
		addr := bitaxe.Ip
		key := bitaxe.StorageKey()
		if key == "" {
			f.logger.Error("bitaxe: no mac configured, skipping (set mac: in dashboard.yml)", "ip", addr)
			continue
		}

		payload, err := client.FetchSystemInfo(ctx, addr)
		if err != nil {
			f.logger.Error("bitaxe fetch error", "ip", addr, "error", err)
			offline := []model.Alert{{Type: model.AlertOffline, Message: err.Error()}}
			if err := store.AppendAlertOnly(now, key, offline); err != nil {
				f.logger.Error("storage error (offline alert)", "ip", addr, "mac", key, "error", err)
			}
			continue
		}

		// The device itself must agree with what's configured -- a wrong
		// device at this IP (network mixup) or a config typo must never
		// silently write into another device's storage directory.
		if reportedMac := config.NormalizeMac(extractDeviceMac(payload)); reportedMac != "" && reportedMac != key {
			f.logger.Error("bitaxe: mac mismatch, refusing to store this poll",
				"ip", addr, "configuredMac", key, "reportedMac", reportedMac)
			mismatch := []model.Alert{{
				Type:    model.AlertMacMismatch,
				Message: fmt.Sprintf("configured mac %s doesn't match the device's reported %s", key, reportedMac),
			}}
			if err := store.AppendAlertOnly(now, key, mismatch); err != nil {
				f.logger.Error("storage error (mismatch alert)", "ip", addr, "mac", key, "error", err)
			}
			continue
		}

		latestFW := fwCache.Models[string(bitaxe.Model)].Version
		alerts := computeAlerts(payload, latestFW)

		// Storage is keyed by MAC (stable across IP/location changes), not IP.
		if err := store.Append(now, key, payload, alerts); err != nil {
			f.logger.Error("storage error", "ip", addr, "mac", key, "error", err)
		} else if f.config.Remote.Enabled() {
			// Push the already-computed storage key, not the raw mac --
			// hashboard just uses it verbatim as its own directory name, no
			// need for it to know anything about MAC address formatting at
			// all (single source of truth for that logic, here).
			go f.pushToRemote(now, key, addr, bitaxe.Hostname, string(bitaxe.Model), latestFW, payload, alerts)

			// totals.json was just (re)written by store.Append above -- push
			// it separately from the per-poll sample so hashboard can store
			// it verbatim, with zero computation of its own (see
			// internal/storage.Totals for who owns the delta/reset logic).
			totals := storage.ReadTotals(storage.TotalsPath(f.config.Storage.BitaxesDir(), key))
			go f.pushTotalsToRemote(key, totals)
		}
	}

	models := make(map[string]struct{})
	for _, b := range f.config.GetMiners() {
		models[string(b.Model)] = struct{}{}
	}
	for model := range models {
		firmware.CheckAndCache(model, f.config.Firmware.Repos, f.config.Firmware.CacheTTL, f.config.Storage.BitaxesDir(), f.logger)
	}

	if f.config.Remote.Enabled() {
		// Reloaded rather than reusing fwCache from above -- CheckAndCache
		// may have just updated it on disk this cycle.
		checkedAt := firmware.LatestCheck(firmware.LoadCache(f.config.Storage.BitaxesDir()))
		go f.pushSettingsConfigToRemote(settingsSnapshot, checkedAt)
	}
}

// computeAlerts inspects a single poll's raw payload and returns whatever
// alerts apply *at this instant* -- temp/fan compared against the fixed
// default thresholds (not yet configurable, see model.Default*Threshold),
// and a firmware-update alert if the device's reported version doesn't match
// the cached latest release. Deliberately stateless: no comparison against
// any previous poll, no memory of what was alerting last tick -- each call
// starts fresh from just this payload.
func computeAlerts(payload []byte, latestFirmwareVersion string) []model.Alert {
	var p struct {
		Temp     float64 `json:"temp"`
		FanSpeed float64 `json:"fanspeed"`
		Version  string  `json:"version"`
	}
	if err := json.Unmarshal(payload, &p); err != nil {
		return nil
	}

	var alerts []model.Alert
	if p.Temp > model.DefaultTempThreshold {
		alerts = append(alerts, model.Alert{
			Type:      model.AlertTempHigh,
			Value:     p.Temp,
			Threshold: model.DefaultTempThreshold,
		})
	}
	if p.FanSpeed > model.DefaultFanThreshold {
		alerts = append(alerts, model.Alert{
			Type:      model.AlertFanHigh,
			Value:     p.FanSpeed,
			Threshold: model.DefaultFanThreshold,
		})
	}
	if latestFirmwareVersion != "" && p.Version != "" && p.Version != latestFirmwareVersion {
		alerts = append(alerts, model.Alert{
			Type:    model.AlertFirmwareStale,
			Message: fmt.Sprintf("%s -> %s available", p.Version, latestFirmwareVersion),
		})
	}
	return alerts
}

// extractDeviceMac pulls the macAddr field a device reports flat/top-level
// in its own response (see internal/healtcheck.MinerCommon) -- used only to
// cross-check against the configured mac:, never as the storage key itself.
func extractDeviceMac(payload []byte) string {
	var m struct {
		MacAddr string `json:"macAddr"`
	}
	if err := json.Unmarshal(payload, &m); err != nil {
		return ""
	}
	return m.MacAddr
}

type pushSample struct {
	Timestamp time.Time `json:"ts"`
	IP        string    `json:"ip"`
	// StorageKey is the already-normalized directory-name key (see
	// config.Bitaxe.StorageKey) -- hashboard just uses it verbatim, it
	// never needs to know this is derived from a MAC address at all.
	StorageKey      string          `json:"storageKey"`
	Hostname        string          `json:"hostname"`
	Model           string          `json:"model"`
	ElectricityRate float64         `json:"electricityRatePerKwh,omitempty"`
	LatestFirmware  string          `json:"latestFirmware,omitempty"`
	Payload         json.RawMessage `json:"payload"`
	// Alerts is opaque to hashboard -- it stores it verbatim, same principle
	// as StorageKey.
	Alerts []model.Alert `json:"alerts,omitempty"`
	// FeederIntervalSeconds is this server's own feeder.interval -- global
	// to the deployment, not per-miner, so (like ElectricityRate) it's
	// redundantly re-sent with every sample rather than pushed separately.
	// remote-dashboard-api reads it back to derive the same alert-episode
	// grouping threshold (see handler.episodeGapThreshold) that local mode
	// gets from its own config directly -- a remote board has no config of
	// its own to read it from otherwise.
	FeederIntervalSeconds int `json:"feederIntervalSeconds,omitempty"`
}

func (f *Feeder) pushToRemote(now time.Time, storageKey, ip, hostname, model, latestFirmware string, payload []byte, alerts []model.Alert) {
	sample := pushSample{
		Timestamp:             now.UTC().Truncate(time.Second),
		IP:                    ip,
		StorageKey:            storageKey,
		Hostname:              hostname,
		Model:                 model,
		ElectricityRate:       f.config.Electricity.RatePerKwh,
		LatestFirmware:        latestFirmware,
		Payload:               json.RawMessage(payload),
		Alerts:                alerts,
		FeederIntervalSeconds: int(f.config.Feeder.Interval.Seconds()),
	}

	body, err := json.Marshal(sample)
	if err != nil {
		f.logger.Error("push: marshal error", "ip", ip, "error", err)
		return
	}
	f.postToRemote(f.config.Remote.PushURL, body, "sample "+ip)
}

// pushTotals is the body sent to hashboard's totals endpoint -- the storage
// key plus storage.Totals verbatim (embedded, so its fields flatten into the
// same JSON object). hashboard stores this file as-is; it never parses or
// recomputes any of it.
type pushTotals struct {
	StorageKey string `json:"storageKey"`
	storage.Totals
}

func (f *Feeder) pushTotalsToRemote(storageKey string, totals storage.Totals) {
	body, err := json.Marshal(pushTotals{StorageKey: storageKey, Totals: totals})
	if err != nil {
		f.logger.Error("push: totals marshal error", "mac", storageKey, "error", err)
		return
	}
	f.postToRemote(f.config.Remote.PushURL+"/totals", body, "totals "+storageKey)
}

// configMinersPush is the body sent to hashboard's miners-config endpoint --
// the full managed miners list, enabled and disabled alike (matching what
// GET /api/config/miners returns locally), so a remote Settings page can
// render the same table.
type configMinersPush struct {
	Bitaxes []config.Bitaxe `json:"bitaxes"`
}

func (f *Feeder) pushMinersConfigToRemote(bitaxes []config.Bitaxe) {
	body, err := json.Marshal(configMinersPush{Bitaxes: bitaxes})
	if err != nil {
		f.logger.Error("push: miners config marshal error", "error", err)
		return
	}
	f.postToRemote(f.config.Remote.PushURL+"/config/miners", body, "config/miners")
}

// configSettingsPush mirrors AppSettingsFile minus Remote -- the push
// credentials themselves must never round-trip back out through a
// read-only remote view, so they're deliberately left out here rather than
// sent and relied upon to be filtered out downstream.
type configSettingsPush struct {
	Electricity config.ElectricityConfig   `json:"electricity"`
	Pools       config.PoolsConfig         `json:"pools"`
	Firmware    config.AppSettingsFirmware `json:"firmware"`
	// FirmwareCacheCheckedAt is this feeder's own firmware.LatestCheck --
	// the one process-launch "read-only" value dashboard-api's GET
	// /api/config/settings has that a remote board otherwise has no way
	// to see at all (unlike feederInterval/healthCheckInterval, which a
	// remote board can approximate from the miner data it already gets --
	// see RemoteAppSettings, internal/handler/remote_config.go). Lets a
	// remote board tell at a glance whether the source Pi's feeder is
	// still actually alive, not just quietly stalled.
	FirmwareCacheCheckedAt string `json:"firmwareCacheCheckedAt,omitempty"`
}

func (f *Feeder) pushSettingsConfigToRemote(settings config.AppSettingsFile, firmwareCacheCheckedAt time.Time) {
	push := configSettingsPush{
		Electricity: settings.Electricity,
		Pools:       settings.Pools,
		Firmware:    settings.Firmware,
	}
	if !firmwareCacheCheckedAt.IsZero() {
		push.FirmwareCacheCheckedAt = firmwareCacheCheckedAt.UTC().Format(time.RFC3339)
	}

	body, err := json.Marshal(push)
	if err != nil {
		f.logger.Error("push: settings config marshal error", "error", err)
		return
	}
	f.postToRemote(f.config.Remote.PushURL+"/config/settings", body, "config/settings")
}

// postToRemote sends body as an authenticated JSON POST to hashboard.
// Shared by pushToRemote and pushTotalsToRemote -- same auth, same timeout,
// same fire-and-forget error handling (logged, never fatal: a hashboard
// hiccup must never affect local polling).
func (f *Feeder) postToRemote(url string, body []byte, logCtx string) {
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		f.logger.Error("push: request error", "context", logCtx, "error", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", f.config.Remote.APIKey))

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		f.logger.Error("push: send error", "context", logCtx, "error", err)
		return
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		f.logger.Error("push: unexpected status", "context", logCtx, "status", resp.Status)
	}
}
