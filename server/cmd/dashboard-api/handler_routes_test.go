package main

import (
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
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/healtcheck"
)

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func serverAddr(server *httptest.Server) string {
	return strings.TrimPrefix(server.URL, "http://")
}

func newTestRouter(t *testing.T, cfg config.Config) http.Handler {
	t.Helper()
	watcher := healtcheck.NewWatcher(testLogger(), cfg)
	return NewRouter(testLogger(), cfg, watcher).Handler()
}

func TestRouter_listMiners(t *testing.T) {
	dir := t.TempDir()
	writeRouteFixture(t, filepath.Join(dir, "data", "bitaxes", "10.0.0.1", "latest.json"),
		`{"ts":"2026-07-14T10:00:00Z","payload":{"hashRate":500000}}`)

	cfg := config.Config{
		Storage: config.StorageConfig{DataDir: dir},
		Bitaxes: []config.Bitaxe{{Ip: "10.0.0.1", Enabled: true}},
	}

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/miners", nil)
	newTestRouter(t, cfg).ServeHTTP(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}
}

func TestRouter_switchPool_noMatchingMinerStillReturnsNoContent(t *testing.T) {
	cfg := config.Config{} // no bitaxes configured — loop body never runs, no network call

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPut, "/api/miners/pool/primary/enable", nil)
	newTestRouter(t, cfg).ServeHTTP(w, r)

	if w.Code != http.StatusNoContent {
		t.Errorf("status = %d, want %d", w.Code, http.StatusNoContent)
	}
}

func TestRouter_setWifi_disabledByServer(t *testing.T) {
	cfg := config.Config{Wifi: config.Wifi{On: false}}

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPut, "/api/miners/set/wifi", nil)
	newTestRouter(t, cfg).ServeHTTP(w, r)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("status = %d, want %d when wifi updates are disabled", w.Code, http.StatusMethodNotAllowed)
	}
}

func TestRouter_stats(t *testing.T) {
	dir := t.TempDir()
	today := time.Now().UTC().Format("2006-01-02")
	writeRouteFixture(t, filepath.Join(dir, "data", "bitaxes", "10.0.0.1", today+".jsonl"),
		`{"ts":"2026-07-14T10:00:00Z","payload":{"hashRate":100000}}`+"\n")

	cfg := config.Config{
		Storage: config.StorageConfig{DataDir: dir},
		Bitaxes: []config.Bitaxe{{Ip: "10.0.0.1", Hostname: "bitaxe-1", Enabled: true}},
	}

	t.Run("known miner", func(t *testing.T) {
		w := httptest.NewRecorder()
		r := httptest.NewRequest(http.MethodGet, "/api/miners/bitaxe-1/stats", nil)
		newTestRouter(t, cfg).ServeHTTP(w, r)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
		}
	})

	t.Run("unknown miner", func(t *testing.T) {
		w := httptest.NewRecorder()
		r := httptest.NewRequest(http.MethodGet, "/api/miners/unknown/stats", nil)
		newTestRouter(t, cfg).ServeHTTP(w, r)

		if w.Code != http.StatusNotFound {
			t.Errorf("status = %d, want %d", w.Code, http.StatusNotFound)
		}
	})
}

func TestRouter_restart(t *testing.T) {
	restarted := false
	device := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		restarted = true
		w.WriteHeader(http.StatusOK)
	}))
	defer device.Close()

	cfg := config.Config{
		Endpoints: config.EndpointConfig{Restart: "restart", Timeout: time.Second},
		Bitaxes:   []config.Bitaxe{{Ip: serverAddr(device), Hostname: "bitaxe-1", Enabled: true}},
	}

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPost, "/api/miners/bitaxe-1/restart", nil)
	newTestRouter(t, cfg).ServeHTTP(w, r)

	if w.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusNoContent)
	}
	if !restarted {
		t.Error("expected the route to reach the device and trigger a restart")
	}
}

func writeRouteFixture(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("failed to create parent dir for fixture %s: %v", path, err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("failed to write fixture %s: %v", path, err)
	}
}
