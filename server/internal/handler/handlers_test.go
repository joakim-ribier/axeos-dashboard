package handler

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/appversion"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/hashboardaccess"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/healtcheck"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/model"
)

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

// testVersionChecker returns a Checker for a "dev" build, which always
// reports StatusUnknown without ever making a network call -- handler
// tests only care that the field gets threaded through, not the outcome
// of a real GitHub check.
func testVersionChecker() *appversion.Checker {
	return appversion.NewChecker(testLogger(), "http://example.invalid", "dev")
}

// testAccessChecker returns a hashboardaccess.Checker rooted at a fresh,
// empty temp dir (no accounts/sessions) -- a board is "private, no session"
// by default, which is fine for handler tests that don't specifically
// exercise the public/private flag.
func testAccessChecker(t *testing.T) *hashboardaccess.Checker {
	t.Helper()
	return hashboardaccess.New(t.TempDir())
}

func withURLParams(r *http.Request, params map[string]string) *http.Request {
	rctx := chi.NewRouteContext()
	for k, v := range params {
		rctx.URLParams.Add(k, v)
	}
	return r.WithContext(context.WithValue(r.Context(), chi.RouteCtxKey, rctx))
}

func TestListMiners(t *testing.T) {
	dir := t.TempDir()
	t.Setenv(envDataRoot, dir)

	writeTestFile(t, filepath.Join(dir, "aabbccddeeff", "latest.json"), `{"ts":"2026-07-14T10:00:00Z","payload":{"hashRate":500000,"version":"v2.0"}}`)
	// 10.0.0.2 has no mac: configured — it must be skipped, not error out.

	cfg := config.Config{
		Bitaxes: []config.Bitaxe{
			{Ip: "10.0.0.1", Mac: "aabbccddeeff", Enabled: true},
			{Ip: "10.0.0.2", Enabled: true},
		},
	}
	watcher := healtcheck.NewWatcher(testLogger(), cfg)

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/miners", nil)

	ListMiners(cfg, watcher, w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}

	var got model.MinersResponse
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if got.Configured != 2 {
		t.Errorf("Configured = %d, want 2", got.Configured)
	}
	if got.Total != 1 {
		t.Errorf("Total = %d, want 1 (the miner without a data file is skipped)", got.Total)
	}
	if len(got.Miners) != 1 || got.Miners[0].IP != "10.0.0.1" {
		t.Errorf("Miners = %+v, want a single entry for 10.0.0.1", got.Miners)
	}
}

func TestListMiners_surfacesMacMismatchAsError(t *testing.T) {
	dir := t.TempDir()
	t.Setenv(envDataRoot, dir)

	writeTestFile(t, filepath.Join(dir, "aabbccddeeff", "latest.json"), `{"ts":"2026-07-14T10:00:00Z","payload":{"hashRate":500000}}`)

	bitaxeServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"hostname":"bitaxe-1","macAddr":"ff:ff:ff:ff:ff:ff"}`))
	}))
	defer bitaxeServer.Close()

	cfg := config.Config{
		Endpoints: config.EndpointConfig{Info: "api/system/info", Timeout: time.Second},
		Bitaxes: []config.Bitaxe{
			{Ip: strings.TrimPrefix(bitaxeServer.URL, "http://"), Mac: "aabbccddeeff", Enabled: true},
		},
	}
	watcher := healtcheck.NewWatcher(testLogger(), cfg)
	watcher.Watch() // populate a real MacMismatch status, same as production's background loop

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/miners", nil)
	ListMiners(cfg, watcher, w, r)

	var got model.MinersResponse
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(got.Miners) != 1 {
		t.Fatalf("Miners = %+v, want 1 entry", got.Miners)
	}
	if got.Miners[0].Error == "" {
		t.Error("Error is empty, want it populated on a mac mismatch")
	}
}

func TestListMiners_surfacesMacMismatchEvenWithNoStoredDataYet(t *testing.T) {
	dir := t.TempDir()
	t.Setenv(envDataRoot, dir)
	// No latest.json is ever written under the configured mac -- simulates a
	// mismatch that has existed since the very first poll (wrong mac typed
	// in from the start, or swapped with another miner's).

	bitaxeServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"hostname":"bitaxe-1","macAddr":"ff:ff:ff:ff:ff:ff"}`))
	}))
	defer bitaxeServer.Close()

	cfg := config.Config{
		Endpoints: config.EndpointConfig{Info: "api/system/info", Timeout: time.Second},
		Bitaxes: []config.Bitaxe{
			{Ip: strings.TrimPrefix(bitaxeServer.URL, "http://"), Mac: "aabbccddeeff", Hostname: "bitaxe-1", Enabled: true},
		},
	}
	watcher := healtcheck.NewWatcher(testLogger(), cfg)
	watcher.Watch()

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/miners", nil)
	ListMiners(cfg, watcher, w, r)

	var got model.MinersResponse
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if got.Total != 1 {
		t.Fatalf("Total = %d, want 1 -- the miner must not silently vanish", got.Total)
	}
	if got.Miners[0].Error == "" {
		t.Error("Error is empty, want it populated")
	}
	if got.Miners[0].Hostname != "bitaxe-1" {
		t.Errorf("Hostname = %q, want the configured hostname to still come through", got.Miners[0].Hostname)
	}
}

func TestStats(t *testing.T) {
	dir := t.TempDir()
	t.Setenv(envDataRoot, dir)

	today := time.Now().UTC().Format("2006-01-02")
	writeTestFile(t, filepath.Join(dir, "aabbccddeeff", today+".jsonl"),
		`{"ts":"2026-07-14T10:00:00Z","payload":{"hashRate":100000}}`+"\n"+
			`{"ts":"2026-07-14T10:05:00Z","payload":{"hashRate":110000}}`+"\n")

	miner := config.Bitaxe{Ip: "10.0.0.1", Mac: "aabbccddeeff"}
	cfg := config.Config{}

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/miners/10.0.0.1/stats", nil)

	Stats(miner, cfg, w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}
	var got StatsResponse
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if got.Total != 2 {
		t.Errorf("Total = %d, want 2", got.Total)
	}
}

func TestStats_noDataFileToday(t *testing.T) {
	dir := t.TempDir()
	t.Setenv(envDataRoot, dir)

	miner := config.Bitaxe{Ip: "10.0.0.1", Mac: "aabbccddeeff"}
	cfg := config.Config{}

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/miners/10.0.0.1/stats", nil)

	Stats(miner, cfg, w, r)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want %d when today's file does not exist yet", w.Code, http.StatusInternalServerError)
	}
}

func TestStats_noMacConfigured(t *testing.T) {
	dir := t.TempDir()
	t.Setenv(envDataRoot, dir)

	miner := config.Bitaxe{Ip: "10.0.0.1"} // no mac: set in dashboard.yml yet
	cfg := config.Config{}

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/miners/10.0.0.1/stats", nil)

	Stats(miner, cfg, w, r)

	if w.Code != http.StatusNotFound {
		t.Errorf("status = %d, want %d when no mac is configured for this miner", w.Code, http.StatusNotFound)
	}
}

func TestSyntheticBitaxe(t *testing.T) {
	t.Run("Mac is always the directory name", func(t *testing.T) {
		raw := latestFileStructure{IP: "10.0.0.1", Hostname: "bitaxe-1", Model: "bitaxe"}
		got := syntheticBitaxe(raw, "aabbccddeeff")

		if got.Mac != "aabbccddeeff" {
			t.Errorf("Mac = %q, want the directory name", got.Mac)
		}
		if got.Ip != "10.0.0.1" {
			t.Errorf("Ip = %q, want the pushed file's real network address", got.Ip)
		}
	})

	t.Run("Ip stays empty for older data with no embedded ip -- never falls back to the (MAC) directory name", func(t *testing.T) {
		raw := latestFileStructure{Hostname: "bitaxe-1"}
		got := syntheticBitaxe(raw, "aabbccddeeff")

		if got.Ip != "" {
			t.Errorf("Ip = %q, want empty rather than falling back to the MAC-named directory", got.Ip)
		}
		if got.Mac != "aabbccddeeff" {
			t.Errorf("Mac = %q, want the directory name regardless", got.Mac)
		}
	})
}

func TestListRemoteMiners(t *testing.T) {
	dir := t.TempDir()
	writeTestFile(t, filepath.Join(dir, "demo", "bitaxes", "10.0.0.1", "latest.json"),
		`{"ts":"2026-07-14T10:00:00Z","ip":"10.0.0.1","hostname":"bitaxe-1","payload":{"hashRate":500000}}`)

	cfg := config.Config{Storage: config.StorageConfig{BoardsDir: dir}}

	t.Run("board found", func(t *testing.T) {
		w := httptest.NewRecorder()
		r := withURLParams(httptest.NewRequest(http.MethodGet, "/api/demo/miners/", nil), map[string]string{"boardId": "demo"})

		ListRemoteMiners(cfg, testAccessChecker(t))(w, r)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
		}
		var got model.MinersResponse
		if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if got.Total != 1 || got.Miners[0].Hostname != "bitaxe-1" {
			t.Errorf("got %+v, want a single miner bitaxe-1", got)
		}
		if got.BoardPublic {
			t.Error("BoardPublic = true, want false (no accounts/demo.json fixture -> defaults private)")
		}
	})

	t.Run("board marked public", func(t *testing.T) {
		accessDir := t.TempDir()
		writeAccessFixture(t, filepath.Join(accessDir, "accounts", "demo.json"), `{"public":true}`)
		accessChecker := hashboardaccess.New(accessDir)

		w := httptest.NewRecorder()
		r := withURLParams(httptest.NewRequest(http.MethodGet, "/api/demo/miners/", nil), map[string]string{"boardId": "demo"})

		ListRemoteMiners(cfg, accessChecker)(w, r)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
		}
		var got model.MinersResponse
		if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if !got.BoardPublic {
			t.Error("BoardPublic = false, want true")
		}
	})

	t.Run("board not found", func(t *testing.T) {
		w := httptest.NewRecorder()
		r := withURLParams(httptest.NewRequest(http.MethodGet, "/api/unknown/miners/", nil), map[string]string{"boardId": "unknown"})

		ListRemoteMiners(cfg, testAccessChecker(t))(w, r)

		if w.Code != http.StatusNotFound {
			t.Errorf("status = %d, want %d for an unknown board", w.Code, http.StatusNotFound)
		}
	})
}

func TestResolveMacByIP(t *testing.T) {
	dir := t.TempDir()
	writeTestFile(t, filepath.Join(dir, "aabbccddee01", "latest.json"), `{"ip":"10.0.0.1","payload":{}}`)
	writeTestFile(t, filepath.Join(dir, "aabbccddee02", "latest.json"), `{"ip":"10.0.0.2","payload":{}}`)

	t.Run("finds the directory whose latest.json reports the ip", func(t *testing.T) {
		mac, err := resolveMacByIP(dir, "10.0.0.2")
		if err != nil {
			t.Fatal(err)
		}
		if mac != "aabbccddee02" {
			t.Errorf("mac = %q, want %q", mac, "aabbccddee02")
		}
	})

	t.Run("no match returns empty string, no error", func(t *testing.T) {
		mac, err := resolveMacByIP(dir, "10.0.0.99")
		if err != nil {
			t.Fatal(err)
		}
		if mac != "" {
			t.Errorf("mac = %q, want empty", mac)
		}
	})

	t.Run("missing root dir returns empty string, no error", func(t *testing.T) {
		mac, err := resolveMacByIP(filepath.Join(dir, "does-not-exist"), "10.0.0.1")
		if err != nil {
			t.Fatal(err)
		}
		if mac != "" {
			t.Errorf("mac = %q, want empty", mac)
		}
	})
}

func TestRemoteStats(t *testing.T) {
	dir := t.TempDir()
	today := time.Now().UTC().Format("2006-01-02")
	// The directory is named by MAC (the storage key); latest.json's
	// embedded ip is what RemoteStats' resolveMacByIP actually matches on.
	minerDir := filepath.Join(dir, "demo", "bitaxes", "aabbccddeeff")
	writeTestFile(t, filepath.Join(minerDir, "latest.json"),
		`{"ts":"2026-07-14T10:00:00Z","ip":"10.0.0.1","payload":{"hashRate":100000}}`)
	writeTestFile(t, filepath.Join(minerDir, today+".jsonl"),
		`{"ts":"2026-07-14T10:00:00Z","ip":"10.0.0.1","payload":{"hashRate":100000}}`+"\n")

	cfg := config.Config{Storage: config.StorageConfig{BoardsDir: dir}}

	t.Run("success", func(t *testing.T) {
		w := httptest.NewRecorder()
		r := withURLParams(httptest.NewRequest(http.MethodGet, "/api/demo/10.0.0.1/stats", nil),
			map[string]string{"boardId": "demo", "ip": "10.0.0.1"})

		RemoteStats(cfg)(w, r)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
		}
		var got StatsResponse
		if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if got.Total != 1 {
			t.Errorf("Total = %d, want 1", got.Total)
		}
	})

	t.Run("missing ip param", func(t *testing.T) {
		w := httptest.NewRecorder()
		r := withURLParams(httptest.NewRequest(http.MethodGet, "/api/demo//stats", nil),
			map[string]string{"boardId": "demo"})

		RemoteStats(cfg)(w, r)

		if w.Code != http.StatusBadRequest {
			t.Errorf("status = %d, want %d when ip is missing", w.Code, http.StatusBadRequest)
		}
	})

	t.Run("unknown ip returns 404", func(t *testing.T) {
		w := httptest.NewRecorder()
		r := withURLParams(httptest.NewRequest(http.MethodGet, "/api/demo/10.0.0.99/stats", nil),
			map[string]string{"boardId": "demo", "ip": "10.0.0.99"})

		RemoteStats(cfg)(w, r)

		if w.Code != http.StatusNotFound {
			t.Errorf("status = %d, want %d for an ip with no matching miner", w.Code, http.StatusNotFound)
		}
	})
}
