package main

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/alerts"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/audit"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/firmware"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/model"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/storage"
)

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func serverAddr(server *httptest.Server) string {
	return strings.TrimPrefix(server.URL, "http://")
}

// isNonSamplePushPath reports whether path is the totals push runOnce fires
// alongside the per-miner sample push -- shared by every test remoteServer
// handler below that only cares about the sample push, so the concurrent
// totals push doesn't race it onto the same assertion channel.
func isNonSamplePushPath(path string) bool {
	return path == "/totals"
}

func TestFeeder_runOnce_fetchesStoresAndPushes(t *testing.T) {
	dir := t.TempDir()

	bitaxeServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/system/info" {
			t.Errorf("request path = %q, want %q", r.URL.Path, "/api/system/info")
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"hashRate":500000,"version":"v2.0","temp":70}`))
	}))
	defer bitaxeServer.Close()

	firmwareServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{"tag_name": "v2.1"})
	}))
	defer firmwareServer.Close()

	type pushedRequest struct {
		auth string
		body map[string]any
	}
	pushCh := make(chan pushedRequest, 1)
	remoteServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var decoded map[string]any
		_ = json.Unmarshal(body, &decoded)
		w.WriteHeader(http.StatusOK)
		// See isNonSamplePushPath -- only the sample push is under test here.
		if isNonSamplePushPath(r.URL.Path) {
			return
		}
		pushCh <- pushedRequest{auth: r.Header.Get("Authorization"), body: decoded}
	}))
	defer remoteServer.Close()

	minerAddr := serverAddr(bitaxeServer)
	cfg := config.Config{
		Bitaxes: []config.Bitaxe{
			{Ip: minerAddr, Mac: "aabbccddeeff", Model: "bitaxe", Hostname: "bitaxe-1", Enabled: true},
		},
		Endpoints:   config.EndpointConfig{Info: "api/system/info", Timeout: time.Second},
		Storage:     config.StorageConfig{DataDir: dir},
		Electricity: config.ElectricityConfig{RatePerKwh: 0.15},
		Firmware: config.FirmwareConfig{
			CacheTTL: time.Hour,
			Repos:    map[string]string{"bitaxe": firmwareServer.URL},
		},
		Remote: config.RemoteConfig{PushURL: remoteServer.URL, APIKey: "test-key"},
	}

	feeder := NewFeeder(testLogger(), cfg)
	feeder.runOnce(context.Background())
	// Waits for every push this cycle spawned (not just the sample push
	// asserted on below), so none outlives the test.
	feeder.WaitForPushes()

	// Storage is keyed by the configured MAC, not the IP.
	latestPath := filepath.Join(cfg.Storage.BitaxesDir(), "aabbccddeeff", "latest.json")
	data, err := os.ReadFile(latestPath)
	if err != nil {
		t.Fatalf("latest.json was not written: %v", err)
	}
	if !strings.Contains(string(data), `"hashRate":500000`) {
		t.Errorf("latest.json = %s, want it to contain the fetched payload", data)
	}

	select {
	case p := <-pushCh:
		if p.auth != "Bearer test-key" {
			t.Errorf("push Authorization = %q, want %q", p.auth, "Bearer test-key")
		}
		// remote.sendIP is off: an IPv6 made from the MAC stands in for the IP.
		if p.body["ip"] != "fd00::aabb:ccdd:eeff" {
			t.Errorf("push body ip = %v, want %q", p.body["ip"], "fd00::aabb:ccdd:eeff")
		}
		if p.body["storageKey"] != "aabbccddeeff" {
			t.Errorf("push body storageKey = %v, want %q", p.body["storageKey"], "aabbccddeeff")
		}
		if p.body["hostname"] != "bitaxe-1" {
			t.Errorf("push body hostname = %v, want %q", p.body["hostname"], "bitaxe-1")
		}
		// A board only shows the miners' stats: the poll's tempHigh alert
		// stays local.
		if alerts, ok := p.body["alerts"]; ok {
			t.Errorf("push body alerts = %v, want none", alerts)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("expected a push to the remote server, none received")
	}

	day, err := os.ReadFile(filepath.Join(cfg.Storage.AlertsDir(), time.Now().UTC().Format("2006-01-02")+".jsonl"))
	if err != nil {
		t.Fatalf("day's alerts were not written: %v", err)
	}
	if !strings.Contains(string(day), `"type":"tempHigh","state":"raised"`) {
		t.Errorf("day's alerts = %s, want the tempHigh alert raised", day)
	}

	cache := firmware.LoadCache(cfg.Storage.BitaxesDir())
	if cache.Models["bitaxe"].Version != "v2.1" {
		t.Errorf("firmware cache version = %q, want %q", cache.Models["bitaxe"].Version, "v2.1")
	}
}

func TestFeeder_runOnce_matchingReportedMacStoresNormally(t *testing.T) {
	dir := t.TempDir()

	bitaxeServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"hashRate":500000,"macAddr":"AA:BB:CC:DD:EE:FF"}`))
	}))
	defer bitaxeServer.Close()

	minerAddr := serverAddr(bitaxeServer)
	cfg := config.Config{
		Bitaxes: []config.Bitaxe{
			{Ip: minerAddr, Mac: "aa:bb:cc:dd:ee:ff", Model: "bitaxe", Hostname: "bitaxe-1", Enabled: true},
		},
		Endpoints: config.EndpointConfig{Info: "api/system/info", Timeout: time.Second},
		Storage:   config.StorageConfig{DataDir: dir},
		Firmware:  config.FirmwareConfig{CacheTTL: time.Hour, Repos: map[string]string{}},
	}

	NewFeeder(testLogger(), cfg).runOnce(context.Background())

	macDir := filepath.Join(cfg.Storage.BitaxesDir(), "aabbccddeeff")
	if _, err := os.Stat(filepath.Join(macDir, "latest.json")); err != nil {
		t.Fatalf("expected latest.json under the mac directory when reported mac matches configured: %v", err)
	}
}

func TestFeeder_runOnce_pushesTheSameNormalizedStorageKeyUsedLocally(t *testing.T) {
	dir := t.TempDir()

	bitaxeServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"hashRate":500000,"macAddr":"AA:BB:CC:DD:EE:FF"}`))
	}))
	defer bitaxeServer.Close()

	type pushedRequest struct{ body map[string]any }
	pushCh := make(chan pushedRequest, 1)
	remoteServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var decoded map[string]any
		_ = json.Unmarshal(body, &decoded)
		w.WriteHeader(http.StatusOK)
		// See isNonSamplePushPath -- only the sample push is under test here.
		if isNonSamplePushPath(r.URL.Path) {
			return
		}
		pushCh <- pushedRequest{body: decoded}
	}))
	defer remoteServer.Close()

	minerAddr := serverAddr(bitaxeServer)
	cfg := config.Config{
		Bitaxes: []config.Bitaxe{
			// Configured with colons -- axeos-dashboard is the single place
			// that normalizes; hashboard just receives the final key and
			// uses it verbatim, no MAC-formatting knowledge needed there.
			{Ip: minerAddr, Mac: "aa:bb:cc:dd:ee:ff", Model: "bitaxe", Hostname: "bitaxe-1", Enabled: true},
		},
		Endpoints: config.EndpointConfig{Info: "api/system/info", Timeout: time.Second},
		Storage:   config.StorageConfig{DataDir: dir},
		Firmware:  config.FirmwareConfig{CacheTTL: time.Hour, Repos: map[string]string{}},
		Remote:    config.RemoteConfig{PushURL: remoteServer.URL, APIKey: "test-key"},
	}

	feeder := NewFeeder(testLogger(), cfg)
	feeder.runOnce(context.Background())
	feeder.WaitForPushes() // see the identical comment in the test above

	macDir := filepath.Join(cfg.Storage.BitaxesDir(), "aabbccddeeff")
	if _, err := os.Stat(filepath.Join(macDir, "latest.json")); err != nil {
		t.Fatalf("expected latest.json under the normalized storage key directory: %v", err)
	}

	select {
	case p := <-pushCh:
		if p.body["storageKey"] != "aabbccddeeff" {
			t.Errorf("push body storageKey = %v, want the same normalized key used locally (%q)", p.body["storageKey"], "aabbccddeeff")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("expected a push to the remote server, none received")
	}
}

func TestFeeder_runOnce_pushesAnOfflinePollToo(t *testing.T) {
	dir := t.TempDir()

	// Unreachable from here on: the poll fails, as for a miner that's down.
	bitaxeServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	minerAddr := serverAddr(bitaxeServer)
	bitaxeServer.Close()

	type pushed struct {
		path string
		body map[string]any
	}
	pushCh := make(chan pushed, 1)
	remoteServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		w.WriteHeader(http.StatusOK)
		if isNonSamplePushPath(r.URL.Path) {
			return
		}
		var decoded map[string]any
		_ = json.Unmarshal(body, &decoded)
		pushCh <- pushed{path: r.URL.Path, body: decoded}
	}))
	defer remoteServer.Close()

	cfg := config.Config{
		Bitaxes:   []config.Bitaxe{{Ip: minerAddr, Mac: "aa:bb:cc:dd:ee:ff", Model: "bitaxe", Hostname: "bitaxe-1", Enabled: true}},
		Endpoints: config.EndpointConfig{Info: "api/system/info", Timeout: time.Second},
		Storage:   config.StorageConfig{DataDir: dir},
		Firmware:  config.FirmwareConfig{CacheTTL: time.Hour, Repos: map[string]string{}},
		Remote:    config.RemoteConfig{PushURL: remoteServer.URL, APIKey: "test-key"},
	}

	feeder := NewFeeder(testLogger(), cfg)
	feeder.runOnce(context.Background())
	feeder.WaitForPushes()

	// A remote board mirrors the local history: the missed poll is pushed
	// too, to /history (appended there, latest.json left alone, like
	// storage.AppendAlertOnly does locally), as an alert with no payload.
	select {
	case p := <-pushCh:
		body := p.body
		if p.path != "/history" {
			t.Errorf("pushed to %q, want /history", p.path)
		}
		alerts, _ := body["alerts"].([]any)
		first, _ := alerts[0].(map[string]any)
		if body["storageKey"] != "aabbccddeeff" || first["type"] != "offline" {
			t.Errorf("push body = %v, want this miner's offline alert", body)
		}
		if _, ok := body["payload"]; ok {
			t.Errorf("push body has a payload %v, want none on an offline poll", body["payload"])
		}
	case <-time.After(2 * time.Second):
		t.Fatal("expected the offline poll to be pushed, none received")
	}
}

func TestFeeder_runOnce_mismatchedReportedMacStoresNothing(t *testing.T) {
	dir := t.TempDir()
	var logBuf bytes.Buffer
	logger := slog.New(slog.NewTextHandler(&logBuf, nil))

	// The device actually responding at this IP reports a DIFFERENT mac
	// than what's configured -- wrong device at this address, or a config
	// typo. Must never silently write into the configured mac's directory.
	bitaxeServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"hashRate":500000,"macAddr":"ff:ff:ff:ff:ff:ff"}`))
	}))
	defer bitaxeServer.Close()

	type pushedRequest struct {
		path string
		body map[string]any
	}
	pushCh := make(chan pushedRequest, 1)
	remoteServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var decoded map[string]any
		_ = json.Unmarshal(body, &decoded)
		w.WriteHeader(http.StatusOK)
		pushCh <- pushedRequest{path: r.URL.Path, body: decoded}
	}))
	defer remoteServer.Close()

	minerAddr := serverAddr(bitaxeServer)
	cfg := config.Config{
		Bitaxes: []config.Bitaxe{
			{Ip: minerAddr, Mac: "AA:BB:CC:DD:EE:FF", Model: "bitaxe", Hostname: "bitaxe-1", Enabled: true},
		},
		Endpoints: config.EndpointConfig{Info: "api/system/info", Timeout: time.Second},
		Storage:   config.StorageConfig{DataDir: dir},
		Firmware:  config.FirmwareConfig{CacheTTL: time.Hour, Repos: map[string]string{}},
		Remote:    config.RemoteConfig{PushURL: remoteServer.URL, APIKey: "test-key"},
	}

	feeder := NewFeeder(logger, cfg)
	feeder.runOnce(context.Background())
	feeder.WaitForPushes() // see the identical comment further up this file

	minerDir := filepath.Join(cfg.Storage.BitaxesDir(), "aabbccddeeff")

	if _, err := os.Stat(filepath.Join(minerDir, "latest.json")); !os.IsNotExist(err) {
		t.Errorf("latest.json should not be created/updated on a mac mismatch, stat err = %v", err)
	}

	if matches, _ := filepath.Glob(filepath.Join(minerDir, "*.jsonl")); len(matches) > 0 {
		t.Errorf("history written on a mac mismatch: %v", matches)
	}

	if !strings.Contains(logBuf.String(), "mac mismatch") {
		t.Errorf("expected an error to be logged about the mac mismatch, got log: %s", logBuf.String())
	}

	// Nothing reaches the board: neither the wrong device's reading nor the
	// mismatch alert, a local configuration matter.
	select {
	case p := <-pushCh:
		t.Errorf("pushed %v to %q, want nothing", p.body, p.path)
	default:
	}
}

func TestFeeder_runOnce_skipsDeviceWithNoMacConfigured(t *testing.T) {
	dir := t.TempDir()

	bitaxeServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("device should never be polled when mac: isn't configured")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"hashRate":500000}`))
	}))
	defer bitaxeServer.Close()

	cfg := config.Config{
		Bitaxes: []config.Bitaxe{
			{Ip: serverAddr(bitaxeServer), Model: "bitaxe", Enabled: true}, // no Mac set
		},
		Endpoints: config.EndpointConfig{Info: "api/system/info", Timeout: time.Second},
		Storage:   config.StorageConfig{DataDir: dir},
		Firmware:  config.FirmwareConfig{CacheTTL: time.Hour, Repos: map[string]string{}},
	}

	NewFeeder(testLogger(), cfg).runOnce(context.Background())

	entries, _ := os.ReadDir(cfg.Storage.BitaxesDir())
	if len(entries) != 0 {
		t.Errorf("no directory should be created for a miner with no mac configured, got %v", entries)
	}
}

func TestFeeder_runOnce_skipsDisabledMiner(t *testing.T) {
	dir := t.TempDir()

	bitaxeServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("a disabled miner should never be polled")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"hashRate":500000}`))
	}))
	defer bitaxeServer.Close()

	cfg := config.Config{
		Bitaxes: []config.Bitaxe{
			{Ip: serverAddr(bitaxeServer), Mac: "aabbccddeeff", Model: "bitaxe", Enabled: false},
		},
		Endpoints: config.EndpointConfig{Info: "api/system/info", Timeout: time.Second},
		Storage:   config.StorageConfig{DataDir: dir},
		Firmware:  config.FirmwareConfig{CacheTTL: time.Hour, Repos: map[string]string{}},
	}

	NewFeeder(testLogger(), cfg).runOnce(context.Background())

	if _, err := os.Stat(filepath.Join(cfg.Storage.BitaxesDir(), "aabbccddeeff")); !os.IsNotExist(err) {
		t.Errorf("no directory should be created for a disabled miner (err = %v)", err)
	}
}

func TestFeeder_runOnce_unreachableMinerIsSkipped(t *testing.T) {
	dir := t.TempDir()

	cfg := config.Config{
		Bitaxes: []config.Bitaxe{
			{Ip: "127.0.0.1:1", Mac: "aabbccddeeff", Model: "bitaxe", Enabled: true},
		},
		Endpoints: config.EndpointConfig{Info: "api/system/info", Timeout: 200 * time.Millisecond},
		Storage:   config.StorageConfig{DataDir: dir},
		Firmware:  config.FirmwareConfig{CacheTTL: time.Hour, Repos: map[string]string{}},
	}

	NewFeeder(testLogger(), cfg).runOnce(context.Background())

	minerDir := filepath.Join(cfg.Storage.BitaxesDir(), "aabbccddeeff")

	if _, err := os.Stat(filepath.Join(minerDir, "latest.json")); !os.IsNotExist(err) {
		t.Errorf("latest.json should not be created for a miner that fails to respond, stat err = %v", err)
	}

	entries, err := os.ReadDir(minerDir)
	if err != nil {
		t.Fatalf("expected a jsonl-only directory to be created for the offline alert, got err: %v", err)
	}
	var jsonlFound bool
	for _, e := range entries {
		if strings.HasSuffix(e.Name(), ".jsonl") {
			jsonlFound = true
			data, err := os.ReadFile(filepath.Join(minerDir, e.Name()))
			if err != nil {
				t.Fatalf("failed to read %s: %v", e.Name(), err)
			}
			var sample storage.RawSample
			if err := json.Unmarshal(bytes.TrimSpace(data), &sample); err != nil {
				t.Fatalf("failed to unmarshal jsonl line: %v", err)
			}
			if len(sample.Alerts) != 1 || sample.Alerts[0].Type != model.AlertOffline {
				t.Errorf("Alerts = %+v, want one offline alert", sample.Alerts)
			}
		}
	}
	if !jsonlFound {
		t.Error("expected a jsonl file recording the offline alert")
	}
}

func TestFeeder_runOnce_offlineAlertOnTheSecondMissedPollOnly(t *testing.T) {
	cfg := config.Config{
		Bitaxes: []config.Bitaxe{
			{Ip: "127.0.0.1:1", Mac: "aabbccddeeff", Model: "bitaxe", Hostname: "bitaxe-1", Enabled: true},
		},
		Endpoints: config.EndpointConfig{Info: "api/system/info", Timeout: 200 * time.Millisecond},
		Storage:   config.StorageConfig{DataDir: t.TempDir()},
		Firmware:  config.FirmwareConfig{CacheTTL: time.Hour, Repos: map[string]string{}},
	}
	log := alerts.NewLog(cfg.Storage.AlertsDir())
	today := time.Now().UTC().Format("2006-01-02")

	NewFeeder(testLogger(), cfg).runOnce(context.Background())
	if events, _ := log.ReadDay(today); len(events) != 0 {
		t.Fatalf("after one missed poll: %+v, want nothing yet", events)
	}

	// A new Feeder, as after a restart: the miss is remembered on disk.
	NewFeeder(testLogger(), cfg).runOnce(context.Background())
	NewFeeder(testLogger(), cfg).runOnce(context.Background())
	events, _ := log.ReadDay(today)
	if len(events) != 1 || events[0].Type != alerts.TypeOffline || events[0].State != alerts.Raised ||
		events[0].Mac != "aabbccddeeff" || events[0].IP != "127.0.0.1:1" || events[0].Hostname != "bitaxe-1" {
		t.Errorf("after three missed polls: %+v, want one offline raised", events)
	}
}

func TestFeeder_withMinersStore_picksUpMinerAddedAfterConstruction(t *testing.T) {
	dir := t.TempDir()

	bitaxeServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"hashRate":500000,"version":"v2.0"}`))
	}))
	defer bitaxeServer.Close()

	minerAddr := serverAddr(bitaxeServer)
	minersPath := filepath.Join(dir, "miners.yml")

	cfg := config.Config{
		// Constructed with nothing configured -- the miner only shows up
		// once the file is written, simulating a save made via the
		// Settings UI (a separate dashboard-api process in real usage)
		// after this Feeder already started.
		Endpoints:      config.EndpointConfig{Info: "api/system/info", Timeout: time.Second},
		Storage:        config.StorageConfig{DataDir: dir},
		MinersFilePath: minersPath,
	}
	store := config.NewMinersStore(minersPath, nil)
	feeder := NewFeeder(testLogger(), cfg).WithMinersStore(store)

	feeder.runOnce(context.Background())
	if _, err := os.Stat(filepath.Join(cfg.Storage.BitaxesDir(), "aabbccddeeff", "latest.json")); !os.IsNotExist(err) {
		t.Fatalf("latest.json exists before the miner was ever configured (err = %v)", err)
	}

	content := "bitaxes:\n  - ip: " + minerAddr + "\n    mac: aabbccddeeff\n    model: bitaxe\n    hostname: bitaxe-1\n    enabled: true\n"
	if err := os.WriteFile(minersPath, []byte(content), 0o644); err != nil {
		t.Fatalf("write miners file: %v", err)
	}

	feeder.runOnce(context.Background())
	if _, err := os.Stat(filepath.Join(cfg.Storage.BitaxesDir(), "aabbccddeeff", "latest.json")); err != nil {
		t.Errorf("latest.json still missing after the miner was added via the miners file -- runOnce() didn't reload: %v", err)
	}
}

func TestFeeder_runBackup_recordsOnlyRunsThatDidSomething(t *testing.T) {
	cfg := config.Config{Storage: config.StorageConfig{DataDir: t.TempDir()}}
	minerDir := filepath.Join(cfg.Storage.BitaxesDir(), "aabbccddee01")
	if err := os.MkdirAll(minerDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(minerDir, "2026-10-14.jsonl"), []byte("{}\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	feeder := NewFeeder(testLogger(), cfg)
	now := time.Date(2026, 10, 15, 0, 30, 0, 0, time.UTC)
	feeder.runBackup(now)
	// Nothing new to archive an hour later: not recorded.
	feeder.runBackup(now.Add(time.Hour))

	entries, err := audit.NewLog(cfg.Storage.AuditDir()).ReadRange(now.Add(-time.Hour), now.Add(2*time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 {
		t.Fatalf("got %d entries, want 1: %+v", len(entries), entries)
	}
	e := entries[0]
	if e.Source != audit.SourceSystem || e.Service != audit.ServiceBackup || e.Type != audit.TypeBackup || e.Error != "" {
		t.Errorf("entry = %+v, want a successful system backup entry", e)
	}
	want := []audit.Change{{Field: "backupMonth", Kind: audit.ChangeAdded, After: "2026-10"}}
	if len(e.Changes) != 1 || e.Changes[0] != want[0] {
		t.Errorf("changes = %+v, want %+v", e.Changes, want)
	}
}

func TestRemotePayload(t *testing.T) {
	payload := []byte(`{"hashRate":500000,"ssid":"home-wifi","ipv6":"FE80::1","ipv4":"192.168.1.65",` +
		`"stratumUser":"bc1q.worker","fallbackStratumUser":"acct.worker",` +
		`"stratumURL":"solo.example","stratumPort":3333,"fallbackStratumURL":"pool.example","fallbackStratumPort":3334,"scriptsig":"/pool/"}`)
	userKeys := []string{"stratumUser", "fallbackStratumUser"}
	poolKeys := []string{"stratumURL", "fallbackStratumURL", "scriptsig"}
	portKeys := []string{"stratumPort", "fallbackStratumPort"}
	ipKeys := []string{"ipv4"}

	tests := []struct {
		name   string
		remote config.RemoteConfig
		hidden []string // texts that read "xxxxxxxx"
		zeroed []string // numbers that read 0
	}{
		{"nothing shared by default", config.RemoteConfig{}, concat(userKeys, poolKeys, ipKeys), portKeys},
		{"users only", config.RemoteConfig{SendUser: true}, concat(poolKeys, ipKeys), portKeys},
		{"pools only", config.RemoteConfig{SendPools: true}, concat(userKeys, ipKeys), nil},
		{"ip only", config.RemoteConfig{SendIP: true}, concat(userKeys, poolKeys), portKeys},
		{"everything shared", config.RemoteConfig{SendUser: true, SendPools: true, SendIP: true}, nil, nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var got map[string]any
			if err := json.Unmarshal(remotePayload(payload, tt.remote), &got); err != nil {
				t.Fatalf("filtered payload isn't JSON: %v", err)
			}
			want := map[string]any{}
			_ = json.Unmarshal(payload, &want)
			// The Wi-Fi name and the IPv6 are never shared.
			for _, key := range concat([]string{"ssid", "ipv6"}, tt.hidden) {
				want[key] = "xxxxxxxx"
			}
			for _, key := range tt.zeroed {
				want[key] = float64(0)
			}
			if !reflect.DeepEqual(got, want) {
				t.Errorf("remotePayload =\n %v\nwant\n %v", got, want)
			}
		})
	}

	t.Run("a field the device doesn't report isn't added", func(t *testing.T) {
		var got map[string]any
		_ = json.Unmarshal(remotePayload([]byte(`{"hashRate":1}`), config.RemoteConfig{}), &got)
		if len(got) != 1 {
			t.Errorf("remotePayload = %v, want just the hashRate", got)
		}
	})

	t.Run("a payload that isn't a JSON object goes as-is", func(t *testing.T) {
		if got := remotePayload([]byte("not json"), config.RemoteConfig{}); string(got) != "not json" {
			t.Errorf("remotePayload = %q, want it unchanged", got)
		}
	})
}

func concat(lists ...[]string) []string {
	var all []string
	for _, l := range lists {
		all = append(all, l...)
	}
	return all
}

// pushOneSample runs one feeder cycle against a device answering
// devicePayload and returns the sample pushed to hashboard, the local
// latest.json and the miner's address.
func pushOneSample(t *testing.T, devicePayload string, remote config.RemoteConfig) (map[string]any, string, string) {
	t.Helper()

	bitaxeServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(devicePayload))
	}))
	t.Cleanup(bitaxeServer.Close)

	pushCh := make(chan map[string]any, 1)
	remoteServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		w.WriteHeader(http.StatusOK)
		if isNonSamplePushPath(r.URL.Path) {
			return
		}
		var decoded map[string]any
		_ = json.Unmarshal(body, &decoded)
		pushCh <- decoded
	}))
	t.Cleanup(remoteServer.Close)

	remote.PushURL = remoteServer.URL
	remote.APIKey = "test-key"
	minerAddr := serverAddr(bitaxeServer)
	cfg := config.Config{
		Bitaxes:   []config.Bitaxe{{Ip: minerAddr, Mac: "aabbccddeeff", Model: "bitaxe", Hostname: "bitaxe-1", Enabled: true}},
		Endpoints: config.EndpointConfig{Info: "api/system/info", Timeout: time.Second},
		Storage:   config.StorageConfig{DataDir: t.TempDir()},
		Remote:    remote,
	}

	feeder := NewFeeder(testLogger(), cfg)
	feeder.runOnce(context.Background())
	feeder.WaitForPushes()

	latest, err := os.ReadFile(filepath.Join(cfg.Storage.BitaxesDir(), "aabbccddeeff", "latest.json"))
	if err != nil {
		t.Fatalf("latest.json was not written: %v", err)
	}
	select {
	case sample := <-pushCh:
		return sample, string(latest), minerAddr
	case <-time.After(2 * time.Second):
		t.Fatal("no sample was pushed")
		return nil, "", ""
	}
}

func TestFeeder_runOnce_keepsSensitiveDataLocal(t *testing.T) {
	sample, latest, _ := pushOneSample(t,
		`{"hashRate":500000,"ssid":"home-wifi","ipv4":"192.168.1.65","stratumUser":"bc1q.worker","stratumURL":"solo.example"}`,
		config.RemoteConfig{})

	// Only the push is filtered: the local copy stays whole.
	for _, want := range []string{`"ssid":"home-wifi"`, `"ipv4":"192.168.1.65"`, `"stratumUser":"bc1q.worker"`, `"stratumURL":"solo.example"`} {
		if !strings.Contains(latest, want) {
			t.Errorf("local latest.json = %s, want it to contain %s", latest, want)
		}
	}

	payload, _ := sample["payload"].(map[string]any)
	if payload["hashRate"] == nil {
		t.Errorf("pushed payload = %v, want the measures", payload)
	}
	for _, key := range []string{"ssid", "ipv4", "stratumUser", "stratumURL"} {
		if payload[key] != "xxxxxxxx" {
			t.Errorf("pushed payload %s = %v, want it obfuscated", key, payload[key])
		}
	}
	if sample["ip"] != "fd00::aabb:ccdd:eeff" {
		t.Errorf("push body ip = %v, want the IPv6 made from the MAC", sample["ip"])
	}
}

func TestFeeder_runOnce_sendIPPushesTheMinersIP(t *testing.T) {
	sample, _, minerAddr := pushOneSample(t,
		`{"hashRate":500000,"ipv4":"192.168.1.65"}`,
		config.RemoteConfig{SendIP: true})

	if sample["ip"] != minerAddr {
		t.Errorf("push body ip = %v, want %v", sample["ip"], minerAddr)
	}
	if payload, _ := sample["payload"].(map[string]any); payload["ipv4"] != "192.168.1.65" {
		t.Errorf("pushed payload = %v, want its ipv4", payload)
	}
}

func TestMaskedIP(t *testing.T) {
	got := maskedIP("10b41dc09b5c")
	if got != "fd00::10b4:1dc0:9b5c" {
		t.Errorf("maskedIP = %q, want %q", got, "fd00::10b4:1dc0:9b5c")
	}
	// hashboard refuses a push whose ip isn't one.
	if net.ParseIP(got) == nil {
		t.Errorf("maskedIP = %q, not an IP", got)
	}
}

// pushedBodies runs one feeder cycle against a device answering
// devicePayload (or not answering at all when devicePayload is empty) and
// returns every body pushed to hashboard, whatever the route -- the
// reading, the offline line, the totals -- and the miner's address.
func pushedBodies(t *testing.T, devicePayload string, remote config.RemoteConfig) (string, string) {
	t.Helper()

	bitaxeServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(devicePayload))
	}))
	minerAddr := serverAddr(bitaxeServer)
	if devicePayload == "" {
		bitaxeServer.Close()
	} else {
		t.Cleanup(bitaxeServer.Close)
	}

	var mu sync.Mutex
	var bodies []string
	remoteServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		mu.Lock()
		bodies = append(bodies, r.URL.Path+" "+string(body))
		mu.Unlock()
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(remoteServer.Close)

	remote.PushURL = remoteServer.URL
	remote.APIKey = "test-key"
	feeder := NewFeeder(testLogger(), config.Config{
		Bitaxes:   []config.Bitaxe{{Ip: minerAddr, Mac: "aabbccddeeff", Model: "bitaxe", Hostname: "bitaxe-1", Enabled: true}},
		Endpoints: config.EndpointConfig{Info: "api/system/info", Timeout: time.Second},
		Storage:   config.StorageConfig{DataDir: t.TempDir()},
		Remote:    remote,
	})
	feeder.runOnce(context.Background())
	feeder.WaitForPushes()

	mu.Lock()
	defer mu.Unlock()
	if len(bodies) == 0 {
		t.Fatal("nothing was pushed")
	}
	return strings.Join(bodies, "\n"), minerAddr
}

// Whatever the route, nothing obfuscated reaches hashboard -- checked on the
// raw bodies, so a value can't slip through some other field (an error
// message, a new one).
func TestFeeder_runOnce_nothingObfuscatedReachesHashboard(t *testing.T) {
	device := `{"hashRate":500000,"ssid":"home-wifi","ipv6":"FE80::1234","ipv4":"192.168.1.65",` +
		`"stratumUser":"bc1q.worker","fallbackStratumUser":"acct.worker",` +
		`"stratumURL":"solo.example","stratumPort":3333,"fallbackStratumURL":"pool.example","fallbackStratumPort":3334,"scriptsig":"/pool/"}`
	secrets := []string{"home-wifi", "FE80::1234", "192.168.1.65", "bc1q.worker", "acct.worker", "solo.example", "pool.example", "/pool/", "3333", "3334"}
	ipHost := func(addr string) string { return strings.Split(addr, ":")[0] }

	t.Run("a reading", func(t *testing.T) {
		bodies, minerAddr := pushedBodies(t, device, config.RemoteConfig{})
		for _, secret := range append(secrets, ipHost(minerAddr)) {
			if strings.Contains(bodies, secret) {
				t.Errorf("%q pushed:\n%s", secret, bodies)
			}
		}
	})

	t.Run("an offline poll", func(t *testing.T) {
		bodies, minerAddr := pushedBodies(t, "", config.RemoteConfig{})
		if !strings.Contains(bodies, "/history ") {
			t.Fatalf("no offline line pushed:\n%s", bodies)
		}
		if strings.Contains(bodies, ipHost(minerAddr)) {
			t.Errorf("the miner's IP pushed:\n%s", bodies)
		}
	})

	// The positive control: shared, the same values do reach hashboard --
	// the checks above can't pass for not seeing them.
	t.Run("everything shared", func(t *testing.T) {
		shared := config.RemoteConfig{SendUser: true, SendPools: true, SendIP: true}
		bodies, minerAddr := pushedBodies(t, device, shared)
		for _, value := range []string{"bc1q.worker", "solo.example", "3333", "192.168.1.65", ipHost(minerAddr)} {
			if !strings.Contains(bodies, value) {
				t.Errorf("%q not pushed though shared:\n%s", value, bodies)
			}
		}
		offline, offlineAddr := pushedBodies(t, "", shared)
		if !strings.Contains(offline, ipHost(offlineAddr)) {
			t.Errorf("the miner's IP not pushed though shared:\n%s", offline)
		}
	})
}
