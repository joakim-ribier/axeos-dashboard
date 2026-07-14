package axeos

import (
	"encoding/json"
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

func TestAxeOs_Restart(t *testing.T) {
	var gotMethod, gotPath string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMethod, gotPath = r.Method, r.URL.Path
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	cfg := config.Config{Endpoints: config.EndpointConfig{Restart: "api/system/restart", Timeout: time.Second}}
	miner := config.Bitaxe{Ip: serverAddr(server)}

	NewAxeOs(testLogger(), cfg).Restart(miner)

	if gotMethod != http.MethodPost {
		t.Errorf("method = %q, want %q", gotMethod, http.MethodPost)
	}
	if gotPath != "/api/system/restart" {
		t.Errorf("path = %q, want %q", gotPath, "/api/system/restart")
	}
}

func TestAxeOs_SwitchPool(t *testing.T) {
	tests := []struct {
		name               string
		target             config.PoolTarget
		restartAfterUpdate bool
		wantURL            string
		wantRestartCalled  bool
	}{
		{
			name:              "primary settings sent",
			target:            config.Primary,
			wantURL:           "primary.pool",
			wantRestartCalled: false,
		},
		{
			name:              "fallback settings sent",
			target:            config.Fallback,
			wantURL:           "fallback.pool",
			wantRestartCalled: false,
		},
		{
			name:               "restarts after update when configured",
			target:             config.Primary,
			restartAfterUpdate: true,
			wantURL:            "primary.pool",
			wantRestartCalled:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var gotSettings config.BitaxeServerSettings
			restartCalled := false

			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				switch r.URL.Path {
				case "/api/system":
					_ = json.NewDecoder(r.Body).Decode(&gotSettings)
					w.WriteHeader(http.StatusOK)
				case "/api/system/restart":
					restartCalled = true
					w.WriteHeader(http.StatusOK)
				default:
					t.Errorf("unexpected request path %q", r.URL.Path)
					w.WriteHeader(http.StatusNotFound)
				}
			}))
			defer server.Close()

			cfg := config.Config{Endpoints: config.EndpointConfig{
				System: "api/system", Restart: "api/system/restart", Timeout: time.Second,
			}}
			miner := config.Bitaxe{
				Ip: serverAddr(server), RestartAfterUpdate: tt.restartAfterUpdate,
				Url: "primary.pool", Port: 3333, User: "acct.primary",
				FallbackURL: "fallback.pool", FallbackPort: 4444, FallbackUser: "acct.fallback",
			}

			NewAxeOs(testLogger(), cfg).SwitchPool(miner, tt.target)

			if gotSettings.Url != tt.wantURL {
				t.Errorf("settings.Url = %q, want %q", gotSettings.Url, tt.wantURL)
			}
			if restartCalled != tt.wantRestartCalled {
				t.Errorf("restart called = %v, want %v", restartCalled, tt.wantRestartCalled)
			}
		})
	}

	t.Run("unknown target sends nothing", func(t *testing.T) {
		called := false
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			called = true
			w.WriteHeader(http.StatusOK)
		}))
		defer server.Close()

		cfg := config.Config{Endpoints: config.EndpointConfig{System: "api/system", Timeout: time.Second}}
		miner := config.Bitaxe{Ip: serverAddr(server)}

		NewAxeOs(testLogger(), cfg).SwitchPool(miner, config.PoolTarget("bogus"))

		if called {
			t.Error("no HTTP request should be sent for an unknown pool target")
		}
	})

	t.Run("does not restart when the settings update fails", func(t *testing.T) {
		restartCalled := false
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/api/system/restart" {
				restartCalled = true
			}
			w.WriteHeader(http.StatusInternalServerError)
		}))
		defer server.Close()

		cfg := config.Config{Endpoints: config.EndpointConfig{
			System: "api/system", Restart: "api/system/restart", Timeout: time.Second,
		}}
		miner := config.Bitaxe{Ip: serverAddr(server), RestartAfterUpdate: true}

		NewAxeOs(testLogger(), cfg).SwitchPool(miner, config.Primary)

		if restartCalled {
			t.Error("restart should not be attempted when the pool settings update fails")
		}
	})
}

func TestAxeOs_SetWifi(t *testing.T) {
	var gotSettings config.BitaxeWifiSettings
	restartCalled := false

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/system":
			_ = json.NewDecoder(r.Body).Decode(&gotSettings)
			w.WriteHeader(http.StatusOK)
		case "/api/system/restart":
			restartCalled = true
			w.WriteHeader(http.StatusOK)
		}
	}))
	defer server.Close()

	cfg := config.Config{
		Endpoints: config.EndpointConfig{System: "api/system", Restart: "api/system/restart", Timeout: time.Second},
		Wifi:      config.Wifi{Name: "my-ssid", Pwd: "secret"},
	}
	miner := config.Bitaxe{Ip: serverAddr(server), Hostname: "bitaxe-1", RestartAfterUpdate: true}

	NewAxeOs(testLogger(), cfg).SetWifi(miner)

	want := config.BitaxeWifiSettings{Name: "my-ssid", Pwd: "secret", Hostname: "bitaxe-1"}
	if gotSettings != want {
		t.Errorf("settings = %+v, want %+v", gotSettings, want)
	}
	if !restartCalled {
		t.Error("expected a restart after the wifi update since RestartAfterUpdate is true")
	}
}
