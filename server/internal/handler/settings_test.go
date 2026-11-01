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

// A nerdaxe running miners.yml's pools the other way round (pps in its
// primary slot): what each switch from the UI sends it.
func TestSwitchPool_poolsSent(t *testing.T) {
	tests := []struct {
		name            string
		model           config.Model
		target          config.PoolTarget
		wantURL         string
		wantFallbackURL string
		wantUseFallback bool
	}{
		{
			name:            "nerdaxe to fallback swaps the device's two slots",
			model:           config.ModelNerdaxe,
			target:          config.Fallback,
			wantURL:         "solo.pool",
			wantFallbackURL: "pps.pool",
		},
		{
			name:            "nerdaxe to primary puts miners.yml's primary in the primary slot",
			model:           config.ModelNerdaxe,
			target:          config.Primary,
			wantURL:         "solo.pool",
			wantFallbackURL: "pps.pool",
		},
		{
			name:            "bitaxe to fallback keeps its slots and sets useFallbackStratum",
			model:           config.ModelBitaxe,
			target:          config.Fallback,
			wantURL:         "solo.pool",
			wantFallbackURL: "pps.pool",
			wantUseFallback: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var got config.BitaxeServerSettings
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				switch r.URL.Path {
				case "/api/system/info":
					_, _ = w.Write([]byte(`{"stratumURL":"pps.pool","stratumPort":3333,"stratumUser":"acct.pps",` +
						`"fallbackStratumURL":"solo.pool","fallbackStratumPort":3333,"fallbackStratumUser":"acct.solo"}`))
				case "/api/system":
					_ = json.NewDecoder(r.Body).Decode(&got)
				}
			}))
			defer server.Close()

			cfg := config.Config{
				Endpoints: config.EndpointConfig{
					Info: "api/system/info", System: "api/system", Restart: "api/system/restart", Timeout: time.Second,
				},
				Bitaxes: []config.Bitaxe{{
					Ip: settingsTestServerAddr(server), Enabled: true, Model: tt.model,
					Url: "solo.pool", Port: 3333, User: "acct.solo",
					FallbackURL: "pps.pool", FallbackPort: 3333, FallbackUser: "acct.pps",
				}},
			}

			w := httptest.NewRecorder()
			r := httptest.NewRequest(http.MethodPut, "/api/miners/pool/"+string(tt.target)+"/enable", nil)
			SwitchPool(settingsTestLogger(), cfg, tt.target, w, r)

			if w.Code != http.StatusNoContent {
				t.Fatalf("status = %d, want %d, body = %s", w.Code, http.StatusNoContent, w.Body.String())
			}
			if got.Url != tt.wantURL || got.FallbackURL != tt.wantFallbackURL || got.UseFallbackStratum != tt.wantUseFallback {
				t.Errorf("settings = %+v, want url %q, fallback %q, useFallbackStratum %v",
					got, tt.wantURL, tt.wantFallbackURL, tt.wantUseFallback)
			}
		})
	}
}
