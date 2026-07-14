package firmware

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
)

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func TestLoadCache_noFile(t *testing.T) {
	got := LoadCache(t.TempDir())

	if got.Models == nil {
		t.Fatal("LoadCache() Models = nil, want an initialized empty map")
	}
	if len(got.Models) != 0 {
		t.Errorf("LoadCache() Models = %+v, want empty", got.Models)
	}
}

func TestLoadCache_corruptedFile(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, cacheFile), []byte("not json"), 0o644); err != nil {
		t.Fatal(err)
	}

	got := LoadCache(dir)

	if got.Models == nil || len(got.Models) != 0 {
		t.Errorf("LoadCache() = %+v, want an empty map when the cache file is corrupted", got)
	}
}

func TestSaveToDisk_LoadCache_roundTrip(t *testing.T) {
	dir := t.TempDir()
	checkedAt := time.Date(2026, 7, 14, 10, 0, 0, 0, time.UTC)
	want := Cache{Models: map[string]ModelCache{
		"bitaxe": {Version: "v2.12.2", CheckedAt: checkedAt},
	}}

	if err := saveToDisk(dir, want); err != nil {
		t.Fatalf("saveToDisk() unexpected error: %v", err)
	}

	got := LoadCache(dir)

	if got.Models["bitaxe"].Version != "v2.12.2" {
		t.Errorf("Models[bitaxe].Version = %q, want %q", got.Models["bitaxe"].Version, "v2.12.2")
	}
	if !got.Models["bitaxe"].CheckedAt.Equal(checkedAt) {
		t.Errorf("Models[bitaxe].CheckedAt = %v, want %v", got.Models["bitaxe"].CheckedAt, checkedAt)
	}
}

func TestCheckAndCache_skipsFetchWhenFresh(t *testing.T) {
	dir := t.TempDir()
	called := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	if err := saveToDisk(dir, Cache{Models: map[string]ModelCache{
		"bitaxe": {Version: "v1.0.0", CheckedAt: time.Now()},
	}}); err != nil {
		t.Fatal(err)
	}

	CheckAndCache("bitaxe", map[string]string{"bitaxe": server.URL}, time.Hour, dir, testLogger())

	if called {
		t.Error("CheckAndCache() called the firmware server even though the cached entry is within TTL")
	}
}

func TestCheckAndCache_fetchesWhenStale(t *testing.T) {
	dir := t.TempDir()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{"tag_name": "v9.9.9"})
	}))
	defer server.Close()

	if err := saveToDisk(dir, Cache{Models: map[string]ModelCache{
		"bitaxe": {Version: "v1.0.0", CheckedAt: time.Now().Add(-2 * time.Hour)},
	}}); err != nil {
		t.Fatal(err)
	}

	CheckAndCache("bitaxe", map[string]string{"bitaxe": server.URL}, time.Hour, dir, testLogger())

	got := LoadCache(dir)
	if got.Models["bitaxe"].Version != "v9.9.9" {
		t.Errorf("Models[bitaxe].Version = %q, want %q after a stale cache triggers a refetch", got.Models["bitaxe"].Version, "v9.9.9")
	}
}

func TestCheckAndCache_noCacheEntryFetches(t *testing.T) {
	dir := t.TempDir()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{"tag_name": "v3.0.0"})
	}))
	defer server.Close()

	CheckAndCache("bitaxe", map[string]string{"bitaxe": server.URL}, time.Hour, dir, testLogger())

	got := LoadCache(dir)
	if got.Models["bitaxe"].Version != "v3.0.0" {
		t.Errorf("Models[bitaxe].Version = %q, want %q", got.Models["bitaxe"].Version, "v3.0.0")
	}
}

func TestCheckAndCache_fetchErrorLeavesCacheUntouched(t *testing.T) {
	dir := t.TempDir()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	CheckAndCache("bitaxe", map[string]string{"bitaxe": server.URL}, time.Hour, dir, testLogger())

	got := LoadCache(dir)
	if _, ok := got.Models["bitaxe"]; ok {
		t.Errorf("Models[bitaxe] = %+v, want no entry when the fetch fails", got.Models["bitaxe"])
	}
}

func TestCheckAndCache_unknownModelDoesNotPanic(t *testing.T) {
	dir := t.TempDir()

	CheckAndCache("unknown-model", map[string]string{"bitaxe": "http://example.invalid"}, time.Hour, dir, testLogger())

	got := LoadCache(dir)
	if len(got.Models) != 0 {
		t.Errorf("Models = %+v, want empty when the model has no configured repo", got.Models)
	}
}
