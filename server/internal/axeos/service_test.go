package axeos

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

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
)

func TestMain(m *testing.M) {
	RestartDelay = 0 // don't actually pause between settings update and restart in tests
	os.Exit(m.Run())
}

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

	if err := NewAxeOs(testLogger(), cfg).Restart(miner); err != nil {
		t.Errorf("Restart() error = %v, want nil", err)
	}

	if gotMethod != http.MethodPost {
		t.Errorf("method = %q, want %q", gotMethod, http.MethodPost)
	}
	if gotPath != "/api/system/restart" {
		t.Errorf("path = %q, want %q", gotPath, "/api/system/restart")
	}
}

func TestAxeOs_Restart_returnsErrorWhenDeviceUnreachable(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	cfg := config.Config{Endpoints: config.EndpointConfig{Restart: "api/system/restart", Timeout: time.Second}}
	miner := config.Bitaxe{Ip: serverAddr(server)}

	if err := NewAxeOs(testLogger(), cfg).Restart(miner); err == nil {
		t.Error("Restart() error = nil, want an error when the device rejects the request")
	}
}

func TestAxeOs_SwitchPool(t *testing.T) {
	tests := []struct {
		name                   string
		target                 config.PoolTarget
		wantUseFallbackStratum bool
	}{
		{
			name:                   "primary sends useFallbackStratum=false, then restarts to apply it",
			target:                 config.Primary,
			wantUseFallbackStratum: false,
		},
		{
			name:                   "fallback sends useFallbackStratum=true, then restarts to apply it",
			target:                 config.Fallback,
			wantUseFallbackStratum: true,
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
				Ip:    serverAddr(server),
				Model: "bitaxe",
				Url:   "primary.pool", Port: 3333, User: "acct.primary",
				FallbackURL: "fallback.pool", FallbackPort: 4444, FallbackUser: "acct.fallback",
			}

			if err := NewAxeOs(testLogger(), cfg).SwitchPool(miner, tt.target); err != nil {
				t.Errorf("SwitchPool() error = %v, want nil", err)
			}

			// The primary/fallback URL slots never change -- only
			// UseFallbackStratum actually selects which pool is active
			// (see BitaxeServerSettings.UseFallbackStratum's doc comment).
			if gotSettings.Url != "primary.pool" || gotSettings.FallbackURL != "fallback.pool" {
				t.Errorf("settings = %+v, want primary/fallback URLs left in their own slots", gotSettings)
			}
			if gotSettings.UseFallbackStratum != tt.wantUseFallbackStratum {
				t.Errorf("settings.UseFallbackStratum = %v, want %v", gotSettings.UseFallbackStratum, tt.wantUseFallbackStratum)
			}
			if !restartCalled {
				t.Error("expected a restart after the pool switch to apply it")
			}
		})
	}

	t.Run("nerdaxe swaps the URL into the primary slot instead (no useFallbackStratum field)", func(t *testing.T) {
		var gotSettings config.BitaxeServerSettings
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/api/system" {
				_ = json.NewDecoder(r.Body).Decode(&gotSettings)
			}
			w.WriteHeader(http.StatusOK)
		}))
		defer server.Close()

		cfg := config.Config{Endpoints: config.EndpointConfig{
			System: "api/system", Restart: "api/system/restart", Timeout: time.Second,
		}}
		miner := config.Bitaxe{
			Ip:    serverAddr(server),
			Model: "nerdaxe",
			Url:   "primary.pool", Port: 3333, User: "acct.primary",
			FallbackURL: "fallback.pool", FallbackPort: 4444, FallbackUser: "acct.fallback",
		}

		if err := NewAxeOs(testLogger(), cfg).SwitchPool(miner, config.Fallback); err != nil {
			t.Fatalf("SwitchPool() error = %v, want nil", err)
		}

		if gotSettings.Url != "fallback.pool" || gotSettings.FallbackURL != "primary.pool" {
			t.Errorf("settings = %+v, want the fallback pool swapped into the primary slot", gotSettings)
		}
		if gotSettings.UseFallbackStratum {
			t.Error("UseFallbackStratum = true, want false (unused/not sent meaningfully on nerdaxe)")
		}
	})

	t.Run("unknown target sends nothing and returns an error", func(t *testing.T) {
		called := false
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			called = true
			w.WriteHeader(http.StatusOK)
		}))
		defer server.Close()

		cfg := config.Config{Endpoints: config.EndpointConfig{System: "api/system", Timeout: time.Second}}
		miner := config.Bitaxe{Ip: serverAddr(server)}

		err := NewAxeOs(testLogger(), cfg).SwitchPool(miner, config.PoolTarget("bogus"))

		if called {
			t.Error("no HTTP request should be sent for an unknown pool target")
		}
		if err == nil {
			t.Error("SwitchPool() error = nil, want an error for an unknown target")
		}
	})

	t.Run("pauses between the settings update and the restart", func(t *testing.T) {
		// Regression test: the device's HTTP 200 only means the new
		// settings were received, not persisted to flash -- restarting
		// immediately after was observed to reboot the miner back into
		// its old pool. RestartDelay must actually elapse between the
		// two calls.
		original := RestartDelay
		RestartDelay = 50 * time.Millisecond
		defer func() { RestartDelay = original }()

		var settingsAt, restartAt time.Time
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch r.URL.Path {
			case "/api/system":
				settingsAt = time.Now()
			case "/api/system/restart":
				restartAt = time.Now()
			}
			w.WriteHeader(http.StatusOK)
		}))
		defer server.Close()

		cfg := config.Config{Endpoints: config.EndpointConfig{
			System: "api/system", Restart: "api/system/restart", Timeout: time.Second,
		}}
		miner := config.Bitaxe{Ip: serverAddr(server), Url: "primary.pool"}

		if err := NewAxeOs(testLogger(), cfg).SwitchPool(miner, config.Primary); err != nil {
			t.Fatalf("SwitchPool() error = %v, want nil", err)
		}

		if gap := restartAt.Sub(settingsAt); gap < RestartDelay {
			t.Errorf("restart happened %v after the settings update, want at least %v", gap, RestartDelay)
		}
	})

	t.Run("does not restart, and returns an error, when the settings update fails", func(t *testing.T) {
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
		miner := config.Bitaxe{Ip: serverAddr(server)}

		err := NewAxeOs(testLogger(), cfg).SwitchPool(miner, config.Primary)

		if restartCalled {
			t.Error("restart should not be attempted when the pool settings update fails")
		}
		if err == nil {
			t.Error("SwitchPool() error = nil, want an error when the device rejects the settings update")
		}
	})

	t.Run("returns an error when the restart itself fails after a successful settings update", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/api/system" {
				w.WriteHeader(http.StatusOK)
				return
			}
			w.WriteHeader(http.StatusInternalServerError)
		}))
		defer server.Close()

		cfg := config.Config{Endpoints: config.EndpointConfig{
			System: "api/system", Restart: "api/system/restart", Timeout: time.Second,
		}}
		miner := config.Bitaxe{Ip: serverAddr(server), Url: "primary.pool"}

		err := NewAxeOs(testLogger(), cfg).SwitchPool(miner, config.Primary)

		if err == nil {
			t.Error("SwitchPool() error = nil, want an error when the restart itself fails")
		}
	})
}
