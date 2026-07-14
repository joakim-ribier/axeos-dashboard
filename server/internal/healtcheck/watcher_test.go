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
	w.watch()

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
