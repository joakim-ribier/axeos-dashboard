package main

import (
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
)

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func serverAddr(server *httptest.Server) string {
	return strings.TrimPrefix(server.URL, "http://")
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
		pushCh <- pushedRequest{auth: r.Header.Get("Authorization"), body: decoded}
		w.WriteHeader(http.StatusOK)
	}))
	defer remoteServer.Close()

	minerAddr := serverAddr(bitaxeServer)
	cfg := config.Config{
		Bitaxes: []config.Bitaxe{
			{Ip: minerAddr, Model: "bitaxe", Hostname: "bitaxe-1", Enabled: true},
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

	latestPath := filepath.Join(cfg.Storage.BitaxesDir(), minerAddr, "latest.json")
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

func TestFeeder_runOnce_unreachableMinerIsSkipped(t *testing.T) {
	dir := t.TempDir()

	cfg := config.Config{
		Bitaxes: []config.Bitaxe{
			{Ip: "127.0.0.1:1", Model: "bitaxe", Enabled: true},
		},
		Endpoints: config.EndpointConfig{Info: "api/system/info", Timeout: 200 * time.Millisecond},
		Storage:   config.StorageConfig{DataDir: dir},
		Firmware:  config.FirmwareConfig{CacheTTL: time.Hour, Repos: map[string]string{}},
	}

	NewFeeder(testLogger(), cfg).runOnce(context.Background())

	if _, err := os.Stat(filepath.Join(cfg.Storage.BitaxesDir(), "127.0.0.1:1")); !os.IsNotExist(err) {
		t.Error("no data directory should be created for a miner that fails to respond")
	}
}
