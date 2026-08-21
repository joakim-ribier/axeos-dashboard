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

	config config.Config
}

func NewFeeder(logger *slog.Logger, config config.Config) *Feeder {
	return &Feeder{
		logger: logger.With("namespace", "feeder"),
		config: config,
	}
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

	if err := os.MkdirAll(f.config.Storage.BitaxesDir(), 0o755); err != nil {
		log.Fatalf("cannot create data dir: %v", err)
	}

	client := bitaxe.NewClient(f.logger, f.config.Endpoints.Info, f.config.Endpoints.Timeout)
	store := storage.NewRawStorage(f.config.Storage.BitaxesDir(), f.config.Electricity.RatePerKwh)
	fwCache := firmware.LoadCache(f.config.Storage.BitaxesDir())

	for _, bitaxe := range f.config.Bitaxes {
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

		latestFW := fwCache.Models[bitaxe.Model].Version
		alerts := computeAlerts(payload, latestFW)

		// Storage is keyed by MAC (stable across IP/location changes), not IP.
		if err := store.Append(now, key, payload, alerts); err != nil {
			f.logger.Error("storage error", "ip", addr, "mac", key, "error", err)
		} else if f.config.Remote.PushURL != "" && f.config.Remote.APIKey != "" {
			// Push the already-computed storage key, not the raw mac --
			// hashboard just uses it verbatim as its own directory name, no
			// need for it to know anything about MAC address formatting at
			// all (single source of truth for that logic, here).
			go f.pushToRemote(now, key, addr, bitaxe.Hostname, bitaxe.Model, latestFW, payload, alerts)
		}
	}

	models := make(map[string]struct{})
	for _, b := range f.config.GetMiners() {
		models[b.Model] = struct{}{}
	}
	for model := range models {
		firmware.CheckAndCache(model, f.config.Firmware.Repos, f.config.Firmware.CacheTTL, f.config.Storage.BitaxesDir(), f.logger)
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

	req, err := http.NewRequest(http.MethodPost, f.config.Remote.PushURL, bytes.NewReader(body))
	if err != nil {
		f.logger.Error("push: request error", "ip", ip, "error", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", f.config.Remote.APIKey))

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		f.logger.Error("push: send error", "ip", ip, "error", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		f.logger.Error("push: unexpected status", "ip", ip, "status", resp.Status)
	}
}
