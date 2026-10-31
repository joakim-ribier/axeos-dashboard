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
	"path/filepath"
	"slices"
	"sync"
	"syscall"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/alerts"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/audit"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/backup"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/bitaxe"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/firmware"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/model"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/storage"
)

type Feeder struct {
	logger *slog.Logger

	config           config.Config
	auditLog         *audit.Log
	alertsLog        *alerts.Log
	minersStore      *config.MinersStore
	appSettingsStore *config.AppSettingsStore

	// pushWG tracks every in-flight push goroutine (see goPush), the
	// alerts mail's included -- runOnce itself never waits on it (a
	// hashboard or SMTP hiccup must never block local polling, see
	// postToRemote), but tests do via WaitForPushes, so every push has
	// landed by the time a test checks what was sent.
	pushWG sync.WaitGroup
}

// goPush runs fn in a new goroutine, tracked by pushWG so tests can wait
// for every push this runOnce cycle spawned (see WaitForPushes) without
// runOnce itself ever blocking on network I/O to hashboard.
func (f *Feeder) goPush(fn func()) {
	f.pushWG.Add(1)
	go func() {
		defer f.pushWG.Done()
		fn()
	}()
}

// WaitForPushes blocks until every push goroutine spawned so far has
// finished. Test-only: production never calls this (see goPush).
func (f *Feeder) WaitForPushes() {
	f.pushWG.Wait()
}

func NewFeeder(logger *slog.Logger, config config.Config) *Feeder {
	return &Feeder{
		logger:    logger.With("namespace", "feeder"),
		config:    config,
		auditLog:  audit.NewLog(config.Storage.AuditDir()),
		alertsLog: alerts.NewLog(config.Storage.AlertsDir()),
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

	go f.backupLoop(ctx)

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

// backupLoop runs off the polling loop so that a first catch-up over months
// of existing history (several seconds on a Pi) never delays a poll. Checked
// hourly, so a finished UTC day is added within the hour after midnight UTC.
func (f *Feeder) backupLoop(ctx context.Context) {
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()

	for {
		f.runBackup(time.Now())

		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

// runBackup records the run in the audit only when it did something -- a
// day archived, a month made final -- or failed: the hourly checks that
// find nothing new would otherwise bury everything else.
func (f *Feeder) runBackup(now time.Time) {
	months, err := backup.ArchiveCompletedDays(f.config.Storage.BitaxesDir(), f.config.Storage.BackupsDir(), now)
	if len(months) == 0 && err == nil {
		return
	}

	entry := audit.Entry{
		Timestamp: now,
		Source:    audit.SourceSystem,
		Service:   audit.ServiceBackup,
		Type:      audit.TypeBackup,
	}
	for _, month := range months {
		f.logger.Info("Monthly backup updated", "month", month)
		entry.Changes = append(entry.Changes, audit.Change{Field: "backupMonth", Kind: audit.ChangeAdded, After: month})
	}
	if err != nil {
		f.logger.Error("failed to update monthly backup", "error", err)
		entry.Error = err.Error()
	}
	if err := f.auditLog.Record(entry); err != nil {
		f.logger.Error("failed to record audit entry", "type", audit.TypeBackup, "error", err)
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

	if f.appSettingsStore != nil {
		settings, err := f.appSettingsStore.Reload()
		if err != nil {
			f.logger.Error("failed to reload app settings", "error", err)
		}
		settings.ApplyTo(&f.config)
	}

	if err := os.MkdirAll(f.config.Storage.BitaxesDir(), 0o755); err != nil {
		log.Fatalf("cannot create data dir: %v", err)
	}

	client := bitaxe.NewClient(f.logger, f.config.Endpoints.Info, f.config.Endpoints.Timeout)
	store := storage.NewRawStorage(f.config.Storage.BitaxesDir(), f.config.Electricity.RatePerKwh)
	fwCache := firmware.LoadCache(f.config.Storage.BitaxesDir())

	var changes []alerts.Event
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
			changes = append(changes, f.trackAlerts(now, bitaxe, alerts.Poll{Err: err})...)
			offline := []model.Alert{{Type: model.AlertOffline, Message: err.Error()}}
			if err := store.AppendAlertOnly(now, key, offline); err != nil {
				f.logger.Error("storage error (offline alert)", "ip", addr, "mac", key, "error", err)
			} else {
				f.pushOffline(now, key, addr, bitaxe, offline)
			}
			continue
		}

		// The device itself must agree with what's configured -- a wrong
		// device at this IP (network mixup) or a config typo must never
		// silently write into another device's storage directory.
		if reportedMac := config.NormalizeMac(extractDeviceMac(payload)); reportedMac != "" && reportedMac != key {
			f.logger.Error("bitaxe: mac mismatch, refusing to store this poll",
				"ip", addr, "configuredMac", key, "reportedMac", reportedMac)
			changes = append(changes, f.trackAlerts(now, bitaxe, alerts.Poll{ReportedMac: reportedMac})...)
			continue
		}

		latestFW := fwCache.Models[string(bitaxe.Model)].Version
		changes = append(changes, f.trackAlerts(now, bitaxe, readingsPoll(payload, latestFW))...)

		// Storage is keyed by MAC (stable across IP/location changes), not IP.
		if err := store.Append(now, key, payload); err != nil {
			f.logger.Error("storage error", "ip", addr, "mac", key, "error", err)
		} else if f.config.Remote.Enabled() {
			// Push the already-computed storage key, not the raw mac --
			// hashboard just uses it verbatim as its own directory name, no
			// need for it to know anything about MAC address formatting at
			// all (single source of truth for that logic, here). A board only
			// shows the miners' stats: the alerts stay local.
			f.goPush(func() {
				f.pushToRemote(pushSamplePath, now, key, addr, bitaxe.Hostname, bitaxe.Alias, string(bitaxe.Model), latestFW, remotePayload(payload, f.config.Remote), nil)
			})

			// totals.json was just (re)written by store.Append above -- push
			// it separately from the per-poll sample so hashboard can store
			// it verbatim, with zero computation of its own (see
			// internal/storage.Totals for who owns the delta/reset logic).
			totals := storage.ReadTotals(storage.TotalsPath(f.config.Storage.BitaxesDir(), key))
			f.goPush(func() { f.pushTotalsToRemote(key, totals) })
		}
	}

	f.mailAlerts(changes)

	models := make(map[string]struct{})
	for _, b := range f.config.GetMiners() {
		models[string(b.Model)] = struct{}{}
	}
	for model := range models {
		firmware.CheckAndCache(model, f.config.Firmware.Repos, f.config.Firmware.CacheTTL, f.config.Storage.BitaxesDir(), f.logger)
	}
}

// trackAlerts updates the miner's alerts with this poll and records their
// changes of state, if any -- returned once recorded.
func (f *Feeder) trackAlerts(now time.Time, bitaxe config.Bitaxe, poll alerts.Poll) []alerts.Event {
	key := bitaxe.StorageKey()
	dir := filepath.Join(f.config.Storage.BitaxesDir(), key)
	state, err := alerts.LoadState(dir)
	if err != nil {
		f.logger.Error("failed to read alerts state, starting over", "mac", key, "error", err)
	}

	events := state.Observe(now, poll)
	for i := range events {
		events[i].Mac, events[i].IP, events[i].Hostname = key, bitaxe.Ip, bitaxe.DisplayName()
	}

	if err := f.alertsLog.Record(events); err != nil {
		f.logger.Error("failed to record alerts", "mac", key, "error", err)
		return nil
	}
	if err := alerts.SaveState(dir, state); err != nil {
		f.logger.Error("failed to save alerts state", "mac", key, "error", err)
	}
	return events
}

// mailerTimeout bounds the call to the mailer, its SMTP send included
// (mail.Timeout, 15s).
const mailerTimeout = 30 * time.Second

// mailAlerts hands the mailer the alerts this poll raised, when the alerts
// mail is on -- one mail for all of them, never for one that ended. In the
// background, like a push: the mailer sends it, and a slow SMTP server
// must never hold up the polling.
func (f *Feeder) mailAlerts(changes []alerts.Event) {
	raised := slices.DeleteFunc(changes, func(e alerts.Event) bool { return e.State != alerts.Raised })
	if len(raised) == 0 || !f.config.Notifications.Alerts.Mail {
		return
	}
	body, err := json.Marshal(map[string][]alerts.Event{"alerts": raised})
	if err != nil {
		f.logger.Error("alerts mail: marshal error", "error", err)
		return
	}
	url := "http://" + f.config.Mailer.Address() + "/api/mailer/alerts"
	f.goPush(func() {
		client := &http.Client{Timeout: mailerTimeout}
		resp, err := client.Post(url, "application/json", bytes.NewReader(body))
		if err != nil {
			f.logger.Error("alerts mail: mailer unreachable", "alerts", len(raised), "error", err)
			return
		}
		defer func() { _ = resp.Body.Close() }()
		if resp.StatusCode != http.StatusOK {
			var e struct {
				Message string `json:"message"`
			}
			_ = json.NewDecoder(resp.Body).Decode(&e)
			f.logger.Error("alerts mail not sent", "alerts", len(raised), "status", resp.StatusCode, "error", e.Message)
		}
	})
}

// readingsPoll reads what the alerts need off a poll's raw payload.
func readingsPoll(payload []byte, latestFirmwareVersion string) alerts.Poll {
	var p struct {
		Temp     float64 `json:"temp"`
		FanSpeed float64 `json:"fanspeed"`
		Version  string  `json:"version"`
	}
	_ = json.Unmarshal(payload, &p)
	return alerts.Poll{Temp: p.Temp, FanSpeed: p.FanSpeed, Version: p.Version, LatestVersion: latestFirmwareVersion}
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

// Device fields kept off a board: never shown there, and they say where the
// miner is (the home Wi-Fi, an IPv6 that embeds the MAC) -- or, unless the
// operator opts in, who gets paid, where it mines and its address on the
// local network (bitaxe: ipv4, nerdaxe: hostip). scriptsig is the pool's
// coinbase tag ("/slush/"), the pool again.
var (
	neverPushedFields = []string{"ssid", "ipv6"}
	userFields        = []string{"stratumUser", "fallbackStratumUser"}
	poolFields        = []string{"stratumURL", "stratumPort", "fallbackStratumURL", "fallbackStratumPort", "scriptsig"}
	ipFields          = []string{"ipv4", "hostip"}
)

// remotePayload is payload with the fields remote doesn't let out
// obfuscated -- the stored one stays whole. Every field stays, its value
// doesn't: a text says model.Obfuscated, a number (a port) says 0, since a
// board decodes it as one and a word there would make it drop the whole
// reading. A payload that isn't a JSON object goes out as-is: there's
// nothing in it to obfuscate.
func remotePayload(payload []byte, remote config.RemoteConfig) []byte {
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(payload, &fields); err != nil {
		return payload
	}
	obfuscatedText, _ := json.Marshal(model.Obfuscated)
	hide := func(names []string) {
		for _, name := range names {
			value, ok := fields[name]
			switch {
			case !ok:
			case len(value) > 0 && value[0] == '"':
				fields[name] = obfuscatedText
			default:
				fields[name] = json.RawMessage("0")
			}
		}
	}
	hide(neverPushedFields)
	if !remote.SendUser {
		hide(userFields)
	}
	if !remote.SendPools {
		hide(poolFields)
	}
	if !remote.SendIP {
		hide(ipFields)
	}
	filtered, err := json.Marshal(fields)
	if err != nil {
		return payload
	}
	return filtered
}

// maskedIP stands in for the IP of a miner whose IP isn't shared: an IPv6
// of the private fd00::/8 range carrying its storage key (aabbccddeeff ->
// fd00::aabb:ccdd:eeff). A board only uses the value to address the miner,
// but hashboard requires an IP -- this one is unique per miner and says
// nothing of the network. A key that isn't a normalized MAC is refused by
// hashboard anyway.
func maskedIP(storageKey string) string {
	if len(storageKey) != 12 {
		return "fd00::"
	}
	return "fd00::" + storageKey[0:4] + ":" + storageKey[4:8] + ":" + storageKey[8:12]
}

// Where each push goes, appended to remote.pushURL (hashboard's
// .../api/push) -- one route per file hashboard writes, verbatim. A board
// only gets the miners' stats: nothing of the configuration.
const (
	pushSamplePath  = ""         // a successful poll: the day's JSONL + latest.json
	pushHistoryPath = "/history" // an offline poll: the day's JSONL only
	pushTotalsPath  = "/totals"  // totals.json
)

type pushSample struct {
	Timestamp time.Time `json:"ts"`
	IP        string    `json:"ip"`
	// StorageKey is the already-normalized directory-name key (see
	// config.Bitaxe.StorageKey) -- hashboard just uses it verbatim, it
	// never needs to know this is derived from a MAC address at all.
	StorageKey      string  `json:"storageKey"`
	Hostname        string  `json:"hostname"`
	Alias           string  `json:"alias,omitempty"`
	Model           string  `json:"model"`
	ElectricityRate float64 `json:"electricityRatePerKwh,omitempty"`
	LatestFirmware  string  `json:"latestFirmware,omitempty"`
	// Payload is absent on an offline poll's line (see pushOffline).
	Payload json.RawMessage `json:"payload,omitempty"`
	// Alerts is only ever an offline poll's: the board's 24h chart reads it
	// as a dip to 0. Opaque to hashboard, stored verbatim.
	Alerts []model.Alert `json:"alerts,omitempty"`
	// FeederIntervalSeconds is this server's own feeder.interval -- global
	// to the deployment, not per-miner, so (like ElectricityRate) it's
	// redundantly re-sent with every sample rather than pushed separately.
	// remote-dashboard-api reads it back to tell a miner gone quiet (see
	// handler.aliveFromTimestamp) -- a board has no config of its own to
	// read it from otherwise.
	FeederIntervalSeconds int `json:"feederIntervalSeconds,omitempty"`
}

// pushOffline sends hashboard the offline line just stored locally, so a
// missed poll is a dip in the board's 24h chart too. It goes to /history,
// which only appends it to the day's history: the miner's latest.json there
// keeps its last reading, as storage.AppendAlertOnly leaves it here.
func (f *Feeder) pushOffline(now time.Time, key, addr string, bitaxe config.Bitaxe, alerts []model.Alert) {
	if !f.config.Remote.Enabled() {
		return
	}
	if !f.config.Remote.SendIP {
		// The message is the HTTP client's error, the miner's IP in it --
		// the board only needs the type.
		alerts = slices.Clone(alerts)
		for i := range alerts {
			alerts[i].Message = model.Obfuscated
		}
	}
	f.goPush(func() {
		f.pushToRemote(pushHistoryPath, now, key, addr, bitaxe.Hostname, bitaxe.Alias, string(bitaxe.Model), "", nil, alerts)
	})
}

func (f *Feeder) pushToRemote(path string, now time.Time, storageKey, ip, hostname, alias, model, latestFirmware string, payload []byte, alerts []model.Alert) {
	remoteIP := maskedIP(storageKey)
	if f.config.Remote.SendIP {
		remoteIP = ip
	}
	sample := pushSample{
		Timestamp:             now.UTC().Truncate(time.Second),
		IP:                    remoteIP,
		StorageKey:            storageKey,
		Hostname:              hostname,
		Alias:                 alias,
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
	_ = f.postToRemote(path, body, "sample "+ip)
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
	_ = f.postToRemote(pushTotalsPath, body, "totals "+storageKey)
}

// postToRemote sends body as an authenticated JSON POST to hashboard and
// returns the resulting error, if any (nil on 2xx). Shared by every push --
// same auth, same timeout, same fire-and-forget error handling (logged,
// never fatal: a hashboard hiccup must never affect local polling).
// path is relative to f.config.Remote.PushURL -- only that path suffix is
// ever logged/persisted (never the full URL), so a hashboard.live URL
// doesn't get repeated in full on every single log line and error message.
func (f *Feeder) postToRemote(path string, body []byte, logCtx string) error {
	url := f.config.Remote.PushURL + path
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		f.logger.Error("push: request error", "context", logCtx, "path", path, "error", err)
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", f.config.Remote.APIKey))

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		f.logger.Error("push: send error", "context", logCtx, "path", path, "error", err)
		return err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		f.logger.Error("push: unexpected status", "context", logCtx, "path", path, "status", resp.Status)
		return fmt.Errorf("unexpected status %s (%s)", resp.Status, path)
	}

	return nil
}
