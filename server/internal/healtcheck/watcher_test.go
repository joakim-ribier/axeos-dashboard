package healtcheck

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
)

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func serverAddr(server *httptest.Server) string {
	return strings.TrimPrefix(server.URL, "http://")
}

func TestWatcher_watch(t *testing.T) {
	aliveServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"hostname":"bitaxe-1","macAddr":"aa:bb","temp":55,"responseTime":10,"sharesAccepted":3}`))
	}))
	defer aliveServer.Close()

	malformedServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`not json`))
	}))
	defer malformedServer.Close()

	cfg := config.Config{
		Endpoints: config.EndpointConfig{Info: "api/system/info", Timeout: time.Second},
		Bitaxes: []config.Bitaxe{
			{Ip: serverAddr(aliveServer), Model: "bitaxe", Enabled: true},
			{Ip: serverAddr(malformedServer), Model: "bitaxe", Enabled: true},
			{Ip: "127.0.0.1:1", Model: "bitaxe", Enabled: true},
			{Ip: "127.0.0.1:2", Model: "bitaxe", Enabled: false},
		},
	}

	w := NewWatcher(testLogger(), cfg)
	w.Watch()

	tests := []struct {
		name    string
		ip      string
		wantOk  bool
		wantAlv bool
	}{
		{"alive miner", serverAddr(aliveServer), true, true},
		{"malformed response marks dead", serverAddr(malformedServer), true, false},
		{"unreachable miner marks dead", "127.0.0.1:1", true, false},
		{"disabled miner is never checked", "127.0.0.1:2", false, false},
		{"unknown ip has no status", "10.0.0.99", false, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			status, ok := w.GetStatus(tt.ip)
			if ok != tt.wantOk {
				t.Fatalf("GetStatus(%q) ok = %v, want %v", tt.ip, ok, tt.wantOk)
			}
			if ok && status.Alive != tt.wantAlv {
				t.Errorf("GetStatus(%q).Alive = %v, want %v", tt.ip, status.Alive, tt.wantAlv)
			}
		})
	}
}

func TestWatcher_watch_flagsMacMismatch(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"hostname":"bitaxe-1","macAddr":"ff:ff:ff:ff:ff:ff","temp":55}`))
	}))
	defer server.Close()

	ip := serverAddr(server)
	cfg := config.Config{
		Endpoints: config.EndpointConfig{Info: "api/system/info", Timeout: time.Second},
		Bitaxes: []config.Bitaxe{
			{Ip: ip, Mac: "AA:BB:CC:DD:EE:FF", Model: "bitaxe", Enabled: true},
		},
	}

	w := NewWatcher(testLogger(), cfg)
	w.Watch()

	status, ok := w.GetStatus(ip)
	if !ok {
		t.Fatal("expected a status for the configured ip")
	}
	if !status.Alive {
		t.Error("device did respond, Alive should still be true even on a mac mismatch")
	}
	if !status.MacMismatch {
		t.Error("MacMismatch = false, want true (configured aabbccddeeff != reported ffffffffffff)")
	}
	if status.ReportedMac != "ffffffffffff" {
		t.Errorf("ReportedMac = %q, want %q", status.ReportedMac, "ffffffffffff")
	}
}

func TestWatcher_watch_noMismatchWhenMacsAgree(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"hostname":"bitaxe-1","macAddr":"aa:bb:cc:dd:ee:ff","temp":55}`))
	}))
	defer server.Close()

	ip := serverAddr(server)
	cfg := config.Config{
		Endpoints: config.EndpointConfig{Info: "api/system/info", Timeout: time.Second},
		Bitaxes: []config.Bitaxe{
			{Ip: ip, Mac: "AA:BB:CC:DD:EE:FF", Model: "bitaxe", Enabled: true},
		},
	}

	w := NewWatcher(testLogger(), cfg)
	w.Watch()

	status, _ := w.GetStatus(ip)
	if status.MacMismatch {
		t.Error("MacMismatch = true, want false -- configured and reported mac agree (modulo formatting)")
	}
}

func TestWatcher_watch_noMismatchWhenNoMacConfigured(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"hostname":"bitaxe-1","macAddr":"ff:ff:ff:ff:ff:ff","temp":55}`))
	}))
	defer server.Close()

	ip := serverAddr(server)
	cfg := config.Config{
		Endpoints: config.EndpointConfig{Info: "api/system/info", Timeout: time.Second},
		Bitaxes: []config.Bitaxe{
			{Ip: ip, Model: "bitaxe", Enabled: true}, // no Mac configured
		},
	}

	w := NewWatcher(testLogger(), cfg)
	w.Watch()

	status, _ := w.GetStatus(ip)
	if status.MacMismatch {
		t.Error("MacMismatch = true, want false -- nothing to compare against without a configured mac")
	}
}
