package main

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"slices"
	"testing"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/backup"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/handler"
)

func newBackupsConfig(t *testing.T) config.Config {
	t.Helper()
	cfg := config.Config{Storage: config.StorageConfig{DataDir: t.TempDir()}}
	bitaxes := cfg.Storage.BitaxesDir()
	writeRouteFixture(t, filepath.Join(bitaxes, "aa", "2026-08-03.jsonl"), "aug\n")
	writeRouteFixture(t, filepath.Join(bitaxes, "aa", "2026-09-12.jsonl"), "sep\n")
	writeRouteFixture(t, filepath.Join(bitaxes, "bb", "2026-09-12.jsonl"), "sep-bb\n")
	now := time.Date(2026, 10, 6, 10, 0, 0, 0, time.UTC)
	if _, err := backup.ArchiveCompletedDays(bitaxes, cfg.Storage.BackupsDir(), now); err != nil {
		t.Fatalf("ArchiveCompletedDays() error: %v", err)
	}
	return cfg
}

func getBackupsRoute(t *testing.T, cfg config.Config, url string) *httptest.ResponseRecorder {
	t.Helper()
	w := httptest.NewRecorder()
	newTestRouter(t, cfg).ServeHTTP(w, httptest.NewRequest(http.MethodGet, url, nil))
	return w
}

func zipEntryNames(t *testing.T, body []byte) []string {
	t.Helper()
	r, err := zip.NewReader(bytes.NewReader(body), int64(len(body)))
	if err != nil {
		t.Fatalf("response is not a zip: %v", err)
	}
	var names []string
	for _, f := range r.File {
		names = append(names, f.Name)
	}
	slices.Sort(names)
	return names
}

func TestRouter_listBackups(t *testing.T) {
	w := getBackupsRoute(t, newBackupsConfig(t), "/api/backups")

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}
	var got handler.BackupsResponse
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	var months []string
	for _, b := range got.Data {
		months = append(months, b.Month)
	}
	if want := []string{"2026-09", "2026-08"}; !slices.Equal(months, want) {
		t.Errorf("months = %v, want %v", months, want)
	}
	for _, b := range got.Data {
		if len(b.Checksum) != 32 {
			t.Errorf("%s checksum = %q, want an MD5", b.Month, b.Checksum)
		}
	}
}

func TestRouter_listBackups_noneYet(t *testing.T) {
	cfg := config.Config{Storage: config.StorageConfig{DataDir: t.TempDir()}}
	w := getBackupsRoute(t, cfg, "/api/backups")

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}
	if got := w.Body.String(); got != "{\"data\":[]}\n" {
		t.Errorf("body = %q, want an empty data array", got)
	}
}

func TestRouter_downloadBackups_oneMonth(t *testing.T) {
	w := getBackupsRoute(t, newBackupsConfig(t), "/api/backups/download?months=2026-09")

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}
	if got, want := w.Header().Get("Content-Disposition"), `attachment; filename="axeos-backup-2026-09.zip"`; got != want {
		t.Errorf("Content-Disposition = %q, want %q", got, want)
	}
	want := []string{"data/bitaxes/aa/2026-09-12.jsonl", "data/bitaxes/bb/2026-09-12.jsonl"}
	if got := zipEntryNames(t, w.Body.Bytes()); !slices.Equal(got, want) {
		t.Errorf("entries = %v, want %v", got, want)
	}
}

func TestRouter_downloadBackups_mergesMonths(t *testing.T) {
	w := getBackupsRoute(t, newBackupsConfig(t), "/api/backups/download?months=2026-09,2026-08,2026-09")

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}
	if got, want := w.Header().Get("Content-Disposition"), `attachment; filename="axeos-backup-2026-08_2026-09.zip"`; got != want {
		t.Errorf("Content-Disposition = %q, want %q", got, want)
	}
	want := []string{
		"data/bitaxes/aa/2026-08-03.jsonl",
		"data/bitaxes/aa/2026-09-12.jsonl",
		"data/bitaxes/bb/2026-09-12.jsonl",
	}
	if got := zipEntryNames(t, w.Body.Bytes()); !slices.Equal(got, want) {
		t.Errorf("entries = %v, want %v", got, want)
	}
}

func TestRouter_downloadBackups_errors(t *testing.T) {
	cfg := newBackupsConfig(t)
	tests := []struct {
		url  string
		want int
	}{
		{"/api/backups/download", http.StatusBadRequest},
		{"/api/backups/download?months=", http.StatusBadRequest},
		{"/api/backups/download?months=2026-09,nope", http.StatusBadRequest},
		{"/api/backups/download?months=2026-13", http.StatusBadRequest},
		{"/api/backups/download?months=..%2F..%2Fdashboard", http.StatusBadRequest},
		{"/api/backups/download?months=2026-09,2026-07", http.StatusNotFound},
	}
	for _, tt := range tests {
		if w := getBackupsRoute(t, cfg, tt.url); w.Code != tt.want {
			t.Errorf("GET %s status = %d, want %d", tt.url, w.Code, tt.want)
		}
	}
}
