package main

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

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

// isNonSamplePushPath reports whether path is one of the pushes runOnce
// fires alongside the per-miner sample push (totals, managed miners config,
// managed settings config) -- shared by every test remoteServer handler
// below that only cares about the sample push, so those concurrent pushes
// don't race it onto the same assertion channel.
func isNonSamplePushPath(path string) bool {
	switch path {
	case "/totals", "/config/miners", "/config/settings":
		return true
	default:
		return false
	}
}

func TestFeeder_runOnce_fetchesStoresAndPushes(t *testing.T) {
	dir := t.TempDir()

	bitaxeServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/system/info" {
			t.Errorf("request path = %q, want %q", r.URL.Path, "/api/system/info")
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"hashRate":500000,"version":"v2.0"}`))
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
		// runOnce also pushes totals (POST .../totals) and the managed
		// miners/settings config (POST .../config/miners, .../config/settings)
		// concurrently with the sample push -- only the sample push is under
		// test here, so ignore those requests rather than racing them all
		// onto the same channel.
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

	NewFeeder(testLogger(), cfg).runOnce(context.Background())

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
		if p.body["ip"] != minerAddr {
			t.Errorf("push body ip = %v, want %v", p.body["ip"], minerAddr)
		}
		if p.body["storageKey"] != "aabbccddeeff" {
			t.Errorf("push body storageKey = %v, want %q", p.body["storageKey"], "aabbccddeeff")
		}
		if p.body["hostname"] != "bitaxe-1" {
			t.Errorf("push body hostname = %v, want %q", p.body["hostname"], "bitaxe-1")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("expected a push to the remote server, none received")
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

	NewFeeder(testLogger(), cfg).runOnce(context.Background())

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

	type pushedRequest struct{ body map[string]any }
	pushCh := make(chan pushedRequest, 1)
	remoteServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var decoded map[string]any
		_ = json.Unmarshal(body, &decoded)
		w.WriteHeader(http.StatusOK)
		// The miners/settings config pushes fire every cycle regardless of
		// any single miner's poll outcome -- see isNonSamplePushPath. Only
		// the per-miner sample push is under test here (it must NOT fire
		// for a mismatched device).
		if isNonSamplePushPath(r.URL.Path) {
			return
		}
		pushCh <- pushedRequest{body: decoded}
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

	NewFeeder(logger, cfg).runOnce(context.Background())

	minerDir := filepath.Join(cfg.Storage.BitaxesDir(), "aabbccddeeff")

	if _, err := os.Stat(filepath.Join(minerDir, "latest.json")); !os.IsNotExist(err) {
		t.Errorf("latest.json should not be created/updated on a mac mismatch, stat err = %v", err)
	}

	entries, err := os.ReadDir(minerDir)
	if err != nil {
		t.Fatalf("expected a jsonl-only directory to be created for the mismatch alert, got err: %v", err)
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
			if len(sample.Alerts) != 1 || sample.Alerts[0].Type != model.AlertMacMismatch {
				t.Errorf("Alerts = %+v, want one macMismatch alert", sample.Alerts)
			}
		}
	}
	if !jsonlFound {
		t.Error("expected a jsonl file recording the mac mismatch alert")
	}

	if !strings.Contains(logBuf.String(), "mac mismatch") {
		t.Errorf("expected an error to be logged about the mac mismatch, got log: %s", logBuf.String())
	}

	select {
	case <-pushCh:
		t.Error("must not push to the remote server when the mac mismatches")
	case <-time.After(200 * time.Millisecond):
		// expected: no push happened
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
