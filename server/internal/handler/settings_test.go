package handler

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/axeos"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
)

func TestMain(m *testing.M) {
	axeos.RestartDelay = 0 // don't actually pause between settings update and restart in tests
	os.Exit(m.Run())
}

func settingsTestLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func settingsTestServerAddr(server *httptest.Server) string {
	return strings.TrimPrefix(server.URL, "http://")
}

func TestSwitchPool_success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	cfg := config.Config{
		Endpoints: config.EndpointConfig{System: "api/system", Restart: "api/system/restart", Timeout: time.Second},
		Bitaxes: []config.Bitaxe{
			{Ip: settingsTestServerAddr(server), Enabled: true, Url: "primary.pool"},
		},
	}

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPut, "/api/miners/pool/primary/enable", nil)
	SwitchPool(settingsTestLogger(), cfg, config.Primary, w, r)

	if w.Code != http.StatusNoContent {
		t.Errorf("status = %d, want %d, body = %s", w.Code, http.StatusNoContent, w.Body.String())
	}
}

func TestSwitchPool_deviceFailureReturns502(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	cfg := config.Config{
		Endpoints: config.EndpointConfig{System: "api/system", Restart: "api/system/restart", Timeout: time.Second},
		Bitaxes: []config.Bitaxe{
			{Ip: settingsTestServerAddr(server), Enabled: true, Url: "primary.pool"},
		},
	}

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPut, "/api/miners/pool/primary/enable", nil)
	SwitchPool(settingsTestLogger(), cfg, config.Primary, w, r)

	if w.Code != http.StatusBadGateway {
		t.Fatalf("status = %d, want %d, body = %s", w.Code, http.StatusBadGateway, w.Body.String())
	}

	var got ErrorResponse
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if got.Message == "" {
		t.Error("Message = \"\", want an explanation of what failed")
	}
}

func TestRestart_success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	cfg := config.Config{Endpoints: config.EndpointConfig{Restart: "api/system/restart", Timeout: time.Second}}
	miner := config.Bitaxe{Ip: settingsTestServerAddr(server)}

	w := httptest.NewRecorder()
	Restart(miner, settingsTestLogger(), cfg, w)

	if w.Code != http.StatusNoContent {
		t.Errorf("status = %d, want %d, body = %s", w.Code, http.StatusNoContent, w.Body.String())
	}
}

func TestRestart_deviceFailureReturns502(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	cfg := config.Config{Endpoints: config.EndpointConfig{Restart: "api/system/restart", Timeout: time.Second}}
	miner := config.Bitaxe{Ip: settingsTestServerAddr(server)}

	w := httptest.NewRecorder()
	Restart(miner, settingsTestLogger(), cfg, w)

	if w.Code != http.StatusBadGateway {
		t.Errorf("status = %d, want %d, body = %s", w.Code, http.StatusBadGateway, w.Body.String())
	}
}
