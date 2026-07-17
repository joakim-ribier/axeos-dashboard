package handler

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/healtcheck"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/model"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/version"
)

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
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

	writeTestFile(t, filepath.Join(dir, "10.0.0.1", "latest.json"), `{"ts":"2026-07-14T10:00:00Z","payload":{"hashRate":500000,"version":"v2.0"}}`)
	// 10.0.0.2 is configured but has no data file yet — it must be skipped, not error out.

	cfg := config.Config{
		Bitaxes: []config.Bitaxe{
			{Ip: "10.0.0.1", Enabled: true},
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
	if got.BuildSHA != version.GitSHA {
		t.Errorf("BuildSHA = %q, want %q", got.BuildSHA, version.GitSHA)
	}
}

func TestStats(t *testing.T) {
	dir := t.TempDir()
	t.Setenv(envDataRoot, dir)

	today := time.Now().UTC().Format("2006-01-02")
	writeTestFile(t, filepath.Join(dir, "10.0.0.1", today+".jsonl"),
		`{"ts":"2026-07-14T10:00:00Z","payload":{"hashRate":100000}}`+"\n"+
			`{"ts":"2026-07-14T10:05:00Z","payload":{"hashRate":110000}}`+"\n")

	miner := config.Bitaxe{Ip: "10.0.0.1"}
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

	miner := config.Bitaxe{Ip: "10.0.0.1"}
	cfg := config.Config{}

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/miners/10.0.0.1/stats", nil)

	Stats(miner, cfg, w, r)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want %d when today's file does not exist yet", w.Code, http.StatusInternalServerError)
	}
}

func TestListRemoteMiners(t *testing.T) {
	dir := t.TempDir()
	writeTestFile(t, filepath.Join(dir, "demo", "bitaxes", "10.0.0.1", "latest.json"),
		`{"ts":"2026-07-14T10:00:00Z","ip":"10.0.0.1","hostname":"bitaxe-1","payload":{"hashRate":500000}}`)

	cfg := config.Config{Storage: config.StorageConfig{BoardsDir: dir}}

	t.Run("board found", func(t *testing.T) {
		w := httptest.NewRecorder()
		r := withURLParams(httptest.NewRequest(http.MethodGet, "/api/demo/miners/", nil), map[string]string{"boardId": "demo"})

		ListRemoteMiners(cfg)(w, r)

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
		if got.BuildSHA != version.GitSHA {
			t.Errorf("BuildSHA = %q, want %q", got.BuildSHA, version.GitSHA)
		}
	})

	t.Run("board not found", func(t *testing.T) {
		w := httptest.NewRecorder()
		r := withURLParams(httptest.NewRequest(http.MethodGet, "/api/unknown/miners/", nil), map[string]string{"boardId": "unknown"})

		ListRemoteMiners(cfg)(w, r)

		if w.Code != http.StatusNotFound {
			t.Errorf("status = %d, want %d for an unknown board", w.Code, http.StatusNotFound)
		}
	})
}

func TestRemoteStats(t *testing.T) {
	dir := t.TempDir()
	today := time.Now().UTC().Format("2006-01-02")
	writeTestFile(t, filepath.Join(dir, "demo", "bitaxes", "10.0.0.1", today+".jsonl"),
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
}
