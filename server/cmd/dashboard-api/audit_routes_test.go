package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/appversion"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/audit"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/healtcheck"
)

func newAuditedRouter(t *testing.T, cfg config.Config) (http.Handler, *audit.Log) {
	t.Helper()
	log := audit.NewLog(t.TempDir())
	watcher := healtcheck.NewWatcher(testLogger(), cfg)
	versionChecker := appversion.NewChecker(testLogger(), "http://example.invalid", "dev")
	return NewRouter(testLogger(), cfg, watcher, versionChecker).WithAuditLog(log).Handler(), log
}

func recordedEntries(t *testing.T, log *audit.Log) []audit.Entry {
	t.Helper()
	entries, err := log.ReadRange(time.Now().Add(-time.Hour), time.Now().Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	return entries
}

func TestRouter_auditRecordsAMinerAction(t *testing.T) {
	device := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer device.Close()

	cfg := config.Config{
		Endpoints: config.EndpointConfig{Restart: "restart", Timeout: time.Second},
		Bitaxes:   []config.Bitaxe{{Ip: serverAddr(device), Hostname: "bitaxe-1", Enabled: true}},
	}
	router, log := newAuditedRouter(t, cfg)

	r := httptest.NewRequest(http.MethodPost, "/api/miners/bitaxe-1/restart", nil)
	r.Header.Set("User-Agent", "test-agent/1.0")
	router.ServeHTTP(httptest.NewRecorder(), r)

	entries := recordedEntries(t, log)
	if len(entries) != 1 {
		t.Fatalf("got %d entries, want 1", len(entries))
	}
	e := entries[0]
	if e.Source != audit.SourceAPI || e.Type != audit.TypeRestart || e.Status != http.StatusNoContent || e.Error != "" {
		t.Errorf("entry = %+v, want a successful API restart", e)
	}
	// Addressed by hostname, recorded by IP -- filterable like the scheduler's.
	if e.Target != serverAddr(device) {
		t.Errorf("target = %q, want the miner's IP %q", e.Target, serverAddr(device))
	}
	// httptest's default RemoteAddr is 192.0.2.1:1234 -- the port is dropped.
	if e.IP != "192.0.2.1" || e.UserAgent != "test-agent/1.0" || e.RequestID == "" {
		t.Errorf("who = %q / %q / %q, want the client's IP, User-Agent and a request ID", e.IP, e.UserAgent, e.RequestID)
	}
}

func TestRouter_auditRecordsAFailureWithItsMessage(t *testing.T) {
	device := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	addr := serverAddr(device)
	device.Close() // unreachable from here on

	cfg := config.Config{
		Endpoints: config.EndpointConfig{Restart: "restart", Timeout: time.Second},
		Bitaxes:   []config.Bitaxe{{Ip: addr, Enabled: true}},
	}
	router, log := newAuditedRouter(t, cfg)

	r := httptest.NewRequest(http.MethodPost, "/api/miners/"+addr+"/restart", nil)
	r.Header.Set("X-Forwarded-For", "192.168.1.42")
	router.ServeHTTP(httptest.NewRecorder(), r)

	entries := recordedEntries(t, log)
	if len(entries) != 1 {
		t.Fatalf("got %d entries, want 1", len(entries))
	}
	e := entries[0]
	if e.Status != http.StatusBadGateway || !strings.Contains(e.Error, addr) {
		t.Errorf("status %d, error %q, want 502 with the device error's message", e.Status, e.Error)
	}
	if e.IP != "192.168.1.42" {
		t.Errorf("ip = %q, want the X-Forwarded-For address", e.IP)
	}
}

func TestRouter_auditRecordsAPoolSwitchOnEveryMinerOnce(t *testing.T) {
	cfg := config.Config{
		Endpoints: config.EndpointConfig{System: "system", Restart: "restart", Timeout: time.Second},
	}
	router, log := newAuditedRouter(t, cfg)

	router.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPut, "/api/miners/pool/fallback/enable", nil))

	entries := recordedEntries(t, log)
	if len(entries) != 1 || entries[0].Type != audit.TypeSwitchFallback || entries[0].Target != "" {
		t.Errorf("entries = %+v, want one fallback switch with no target", entries)
	}
}

func TestRouter_auditIgnoresReads(t *testing.T) {
	router, log := newAuditedRouter(t, config.Config{})

	for _, path := range []string{"/api/info", "/api/config/miners", "/api/audit"} {
		router.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, path, nil))
	}

	if entries := recordedEntries(t, log); len(entries) != 0 {
		t.Errorf("got %d entries, want none for read-only routes", len(entries))
	}
}

func TestRouter_auditRecordsDataLeavingThePiAndNetworkScans(t *testing.T) {
	router, log := newAuditedRouter(t, config.Config{Storage: config.StorageConfig{DataDir: t.TempDir()}})

	// Invalid parameters on purpose: each route answers 400 straight away
	// (no real LAN scan, no zip) -- still recorded, with what was asked.
	for _, path := range []string{
		"/api/audit/export?type=restart",
		"/api/backups/download?months=not-a-month",
		"/api/config/discover?timeout=bad",
	} {
		router.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, path, nil))
	}

	entries := recordedEntries(t, log)
	want := []struct{ typ, query string }{
		// export's own entry is written after it answered, so it isn't in
		// the file it exported.
		{audit.TypeExportAudit, "type=restart"},
		{audit.TypeDownloadBackups, "months=not-a-month"},
		{audit.TypeDiscover, "timeout=bad"},
	}
	if len(entries) != len(want) {
		t.Fatalf("got %d entries, want %d: %+v", len(entries), len(want), entries)
	}
	for i, w := range want {
		if entries[i].Type != w.typ || entries[i].Query != w.query {
			t.Errorf("entries[%d] = %s %q, want %s %q", i, entries[i].Type, entries[i].Query, w.typ, w.query)
		}
	}
	if entries[1].Status != http.StatusBadRequest || entries[1].Error == "" {
		t.Errorf("download entry = %+v, want a 400 with its message", entries[1])
	}
}

func TestRouter_auditUnescapesTheQuery(t *testing.T) {
	router, log := newAuditedRouter(t, config.Config{Storage: config.StorageConfig{DataDir: t.TempDir()}})

	router.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet,
		"/api/audit/export?from=2026-10-09T00%3A00%3A00Z&to=2026-10-10T00%3A00%3A00Z", nil))

	entries := recordedEntries(t, log)
	if len(entries) != 1 || entries[0].Query != "from=2026-10-09T00:00:00Z&to=2026-10-10T00:00:00Z" {
		t.Errorf("entries = %+v, want the readable query", entries)
	}
}

func TestCappedBuffer(t *testing.T) {
	b := &cappedBuffer{max: 4}
	for _, chunk := range []string{"ab", "cdef", "gh"} {
		if n, err := b.Write([]byte(chunk)); n != len(chunk) || err != nil {
			t.Fatalf("Write(%q) = %d, %v, want the full length and no error", chunk, n, err)
		}
	}
	if got := b.buf.String(); got != "abcd" {
		t.Errorf("kept %q, want the first 4 bytes %q", got, "abcd")
	}
}
