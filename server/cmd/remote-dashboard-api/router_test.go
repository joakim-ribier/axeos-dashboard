package main

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/appversion"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/hashboardaccess"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/model"
)

// testVersionChecker returns a Checker for a "dev" build, which always
// reports StatusUnknown without ever making a network call.
func testVersionChecker() *appversion.Checker {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	return appversion.NewChecker(logger, "http://example.invalid", "dev")
}

func writeFixture(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("failed to create parent dir for fixture %s: %v", path, err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("failed to write fixture %s: %v", path, err)
	}
}

// publicAccessChecker returns a hashboardaccess.Checker rooted at a fresh
// hashboard data dir where boardID is marked public, so router tests can
// exercise the miners/stats routes without needing a real session cookie.
func publicAccessChecker(t *testing.T, boardID string) *hashboardaccess.Checker {
	t.Helper()
	dir := t.TempDir()
	writeFixture(t, filepath.Join(dir, "accounts", boardID+".json"), `{"public":true}`)
	return hashboardaccess.New(dir)
}

func TestNewRouter_listMiners(t *testing.T) {
	dir := t.TempDir()
	writeFixture(t, filepath.Join(dir, "demo", "bitaxes", "10.0.0.1", "latest.json"),
		`{"ts":"2026-07-14T10:00:00Z","ip":"10.0.0.1","hostname":"bitaxe-1","payload":{"hashRate":500000}}`)

	cfg := config.Config{Storage: config.StorageConfig{BoardsDir: dir}}
	router := NewRouter(cfg, testVersionChecker(), publicAccessChecker(t, "demo"))

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/demo/miners", nil)
	router.ServeHTTP(w, r)

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
}

func TestNewRouter_stats(t *testing.T) {
	dir := t.TempDir()
	today := time.Now().UTC().Format("2006-01-02")
	// Directory is named by MAC; latest.json's embedded ip is what the ip
	// URL param actually resolves against.
	minerDir := filepath.Join(dir, "demo", "bitaxes", "aabbccddeeff")
	writeFixture(t, filepath.Join(minerDir, "latest.json"),
		`{"ts":"2026-07-14T10:00:00Z","ip":"10.0.0.1","payload":{"hashRate":100000}}`)
	writeFixture(t, filepath.Join(minerDir, today+".jsonl"),
		`{"ts":"2026-07-14T10:00:00Z","ip":"10.0.0.1","payload":{"hashRate":100000}}`+"\n")

	cfg := config.Config{Storage: config.StorageConfig{BoardsDir: dir}}
	router := NewRouter(cfg, testVersionChecker(), publicAccessChecker(t, "demo"))

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/demo/10.0.0.1/stats", nil)
	router.ServeHTTP(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}
	var got struct {
		Total int `json:"total"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if got.Total != 1 {
		t.Errorf("Total = %d, want 1", got.Total)
	}
}

// privateAccessChecker returns a Checker rooted at an empty data dir, so
// every board is treated as private with no valid session -- used to prove
// /api/info is reachable regardless of board access, unlike /api/{boardId}/miners.
func privateAccessChecker(t *testing.T) *hashboardaccess.Checker {
	t.Helper()
	return hashboardaccess.New(t.TempDir())
}

func TestNewRouter_infoNotGatedByBoardAccess(t *testing.T) {
	cfg := config.Config{HashboardURL: "https://hashboard.live"}
	router := NewRouter(cfg, testVersionChecker(), privateAccessChecker(t))

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/info", nil)
	router.ServeHTTP(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}
	var got model.InfoResponse
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if got.HashboardURL != "https://hashboard.live" {
		t.Errorf("HashboardURL = %q, want %q", got.HashboardURL, "https://hashboard.live")
	}
}

func TestNewRouter_unknownPath(t *testing.T) {
	router := NewRouter(config.Config{}, testVersionChecker(), publicAccessChecker(t, "demo"))

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/demo/unknown", nil)
	router.ServeHTTP(w, r)

	if w.Code != http.StatusNotFound {
		t.Errorf("status = %d, want %d for an unmatched route", w.Code, http.StatusNotFound)
	}
}
