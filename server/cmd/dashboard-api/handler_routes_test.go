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

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/appversion"
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
	versionChecker := appversion.NewChecker(testLogger(), "http://example.invalid", "dev")
	return NewRouter(testLogger(), cfg, watcher, versionChecker).Handler()
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

func TestRouter_info(t *testing.T) {
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/info", nil)
	newTestRouter(t, config.Config{}).ServeHTTP(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}
}

func TestRouter_configMiners(t *testing.T) {
	cfg := config.Config{
		Bitaxes: []config.Bitaxe{{Ip: "10.0.0.1", Mac: "aabbccddeeff", Enabled: true}},
	}

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/config/miners", nil)
	newTestRouter(t, cfg).ServeHTTP(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
}

func TestRouter_saveMinersConfig_reflectedImmediatelyBySubsequentGet(t *testing.T) {
	dir := t.TempDir()
	cfg := config.Config{MinersFilePath: filepath.Join(dir, "miners.yml")}
	store := config.NewMinersStore(cfg.MinersFilePath, cfg.Bitaxes)

	watcher := healtcheck.NewWatcher(testLogger(), cfg)
	versionChecker := appversion.NewChecker(testLogger(), "http://example.invalid", "dev")
	router := NewRouter(testLogger(), cfg, watcher, versionChecker).WithMinersStore(store).Handler()

	body := `{"bitaxes":[{"ip":"10.0.0.5","mac":"aabbccddeeff","hostname":"new-miner","enabled":false}]}`
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPost, "/api/config/miners", strings.NewReader(body))
	router.ServeHTTP(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("POST status = %d, want %d, body = %s", w.Code, http.StatusOK, w.Body.String())
	}

	// Same router instance, no restart -- GET must already see the save,
	// even though nothing on disk needs to change mtime to trigger a
	// reload here (see MinersStore.Set, called right after the write).
	w2 := httptest.NewRecorder()
	r2 := httptest.NewRequest(http.MethodGet, "/api/config/miners", nil)
	router.ServeHTTP(w2, r2)

	if !strings.Contains(w2.Body.String(), "new-miner") {
		t.Errorf("GET /api/config/miners body = %s, want the just-saved miner reflected", w2.Body.String())
	}
}

func TestRouter_minersStore_picksUpExternalFileChangeOnNextRequest(t *testing.T) {
	dir := t.TempDir()
	minersPath := filepath.Join(dir, "miners.yml")
	cfg := config.Config{MinersFilePath: minersPath}
	store := config.NewMinersStore(cfg.MinersFilePath, cfg.Bitaxes)

	watcher := healtcheck.NewWatcher(testLogger(), cfg)
	versionChecker := appversion.NewChecker(testLogger(), "http://example.invalid", "dev")
	router := NewRouter(testLogger(), cfg, watcher, versionChecker).WithMinersStore(store).Handler()

	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/config/miners", nil))
	if strings.Contains(w.Body.String(), "hand-edited") {
		t.Fatalf("body = %s, want nothing before the file is written", w.Body.String())
	}

	// Nothing went through this process's own POST/Set -- this simulates
	// another process (or the operator by hand) writing miners.yml
	// directly. Only the mtime-based Reload() can catch this.
	if err := os.WriteFile(minersPath, []byte("bitaxes:\n  - ip: 10.0.0.1\n    mac: aabbccddeeff\n    hostname: hand-edited\n"), 0o644); err != nil {
		t.Fatalf("write miners file: %v", err)
	}

	w2 := httptest.NewRecorder()
	router.ServeHTTP(w2, httptest.NewRequest(http.MethodGet, "/api/config/miners", nil))
	if !strings.Contains(w2.Body.String(), "hand-edited") {
		t.Errorf("body = %s, want the externally-written miner picked up", w2.Body.String())
	}
}

func TestRouter_discover_tooLargeRangeReturnsBadRequest(t *testing.T) {
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/config/discover?cidr=10.0.0.0/8", nil)
	newTestRouter(t, config.Config{}).ServeHTTP(w, r)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
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

func TestRouter_stats(t *testing.T) {
	dir := t.TempDir()
	today := time.Now().UTC().Format("2006-01-02")
	writeRouteFixture(t, filepath.Join(dir, "data", "bitaxes", "aabbccddeeff", today+".jsonl"),
		`{"ts":"2026-07-14T10:00:00Z","payload":{"hashRate":100000}}`+"\n")

	cfg := config.Config{
		Storage: config.StorageConfig{DataDir: dir},
		Bitaxes: []config.Bitaxe{{Ip: "10.0.0.1", Mac: "aabbccddeeff", Hostname: "bitaxe-1", Enabled: true}},
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
