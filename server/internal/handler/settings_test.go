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

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/audit"
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
	// A bitaxe on its fallback pool.
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/system/info" {
			_, _ = w.Write([]byte(`{"stratumURL":"primary.pool","stratumPort":3333,` +
				`"fallbackStratumURL":"fallback.pool","fallbackStratumPort":3333,"isUsingFallbackStratum":1}`))
		}
	}))
	defer server.Close()

	cfg := config.Config{
		Endpoints: config.EndpointConfig{Info: "api/system/info", System: "api/system", Restart: "api/system/restart", Timeout: time.Second},
		Bitaxes: []config.Bitaxe{
			{Ip: settingsTestServerAddr(server), Enabled: true, Model: config.ModelBitaxe},
		},
	}

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPut, "/api/miners/pool/primary/enable", nil)
	entries := SwitchPool(settingsTestLogger(), cfg, config.Primary, w, r)

	if w.Code != http.StatusNoContent {
		t.Errorf("status = %d, want %d, body = %s", w.Code, http.StatusNoContent, w.Body.String())
	}
	want := audit.Change{Field: "pool", Kind: audit.ChangeChanged, Before: "fallback.pool:3333", After: "primary.pool:3333"}
	if len(entries) != 1 || entries[0].Type != audit.TypeSwitchPrimary || entries[0].Status != http.StatusNoContent ||
		len(entries[0].Changes) != 1 || entries[0].Changes[0] != want {
		t.Errorf("entries = %+v, want one switch_primary with %+v", entries, want)
	}
}

func TestSwitchPool_deviceFailureReturns502(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	cfg := config.Config{
		Endpoints: config.EndpointConfig{Info: "api/system/info", System: "api/system", Restart: "api/system/restart", Timeout: time.Second},
		Bitaxes: []config.Bitaxe{
			{Ip: settingsTestServerAddr(server), Enabled: true, Url: "primary.pool"},
		},
	}

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPut, "/api/miners/pool/primary/enable", nil)
	entries := SwitchPool(settingsTestLogger(), cfg, config.Primary, w, r)

	if w.Code != http.StatusBadGateway {
		t.Fatalf("status = %d, want %d, body = %s", w.Code, http.StatusBadGateway, w.Body.String())
	}
	if len(entries) != 1 || entries[0].Status != http.StatusBadGateway || entries[0].Error == "" {
		t.Errorf("entries = %+v, want the miner's failed switch, with why", entries)
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

// A miner holding miners.yml's pools the other way round (pps in its
// primary slot): a switch from the UI goes by the device's own slots.
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
			name:            "nerdaxe to primary keeps the device's slots as they are",
			model:           config.ModelNerdaxe,
			target:          config.Primary,
			wantURL:         "pps.pool",
			wantFallbackURL: "solo.pool",
		},
		{
			name:            "bitaxe to fallback keeps the device's slots and sets useFallbackStratum",
			model:           config.ModelBitaxe,
			target:          config.Fallback,
			wantURL:         "pps.pool",
			wantFallbackURL: "solo.pool",
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

// poolSwitchDevice answers like a bitaxe with info's pools, on its primary
// slot, and accepts the switch.
func poolSwitchDevice(t *testing.T, info string) string {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/info" {
			_, _ = w.Write([]byte(info))
		}
	}))
	t.Cleanup(server.Close)
	return settingsTestServerAddr(server)
}

func TestSwitchToPool_requiresThePool(t *testing.T) {
	for _, query := range []string{"", "?url=pps.pool", "?port=3333", "?url=pps.pool&port=x"} {
		w := httptest.NewRecorder()
		entries := SwitchToPool(settingsTestLogger(), config.Config{}, w, httptest.NewRequest(http.MethodPut, "/api/miners/pool/switch"+query, nil))

		if w.Code != http.StatusBadRequest || entries != nil {
			t.Errorf("%q: status = %d, entries = %v, want 400 and nothing", query, w.Code, entries)
		}
	}
}

func TestSwitchToPool_reportsEachMiner(t *testing.T) {
	const onSolo = `{"stratumURL":"solo.pool","stratumPort":3333,"fallbackStratumURL":"pps.pool","fallbackStratumPort":3333,"useFallbackStratum":0,"isUsingFallbackStratum":0}`
	const onPPS = `{"stratumURL":"solo.pool","stratumPort":3333,"fallbackStratumURL":"pps.pool","fallbackStratumPort":3333,"useFallbackStratum":1,"isUsingFallbackStratum":1}`
	const without = `{"stratumURL":"solo.pool","stratumPort":3333,"fallbackStratumURL":"other.pool","fallbackStratumPort":3333,"isUsingFallbackStratum":0}`
	unreachable := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	unreachableAddr := settingsTestServerAddr(unreachable)
	unreachable.Close()

	ips := map[string]string{
		"switched": poolSwitchDevice(t, onSolo),
		"already":  poolSwitchDevice(t, onPPS),
		"missing":  poolSwitchDevice(t, without),
		"failed":   unreachableAddr,
	}
	cfg := config.Config{
		Endpoints: config.EndpointConfig{Info: "info", System: "system", Restart: "restart", Timeout: time.Second},
		Bitaxes: []config.Bitaxe{
			{Ip: ips["switched"], Enabled: true, Model: config.ModelBitaxe},
			{Ip: ips["already"], Enabled: true, Model: config.ModelBitaxe},
			{Ip: ips["missing"], Enabled: true, Model: config.ModelBitaxe},
			{Ip: ips["failed"], Enabled: true, Model: config.ModelBitaxe},
			{Ip: "192.0.2.1", Enabled: false, Model: config.ModelBitaxe},
		},
	}

	w := httptest.NewRecorder()
	entries := SwitchToPool(settingsTestLogger(), cfg, w, httptest.NewRequest(http.MethodPut, "/api/miners/pool/switch?url=pps.pool&port=3333", nil))

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200, body = %s", w.Code, w.Body.String())
	}
	var resp PoolSwitchResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if len(resp.Miners) != 4 {
		t.Fatalf("miners = %+v, want the 4 enabled ones", resp.Miners)
	}
	for _, r := range resp.Miners {
		if ips[r.Status] != r.Ip {
			t.Errorf("%s: status %q, want the one its device calls for", r.Ip, r.Status)
		}
		if (r.Status == "failed") != (r.Error != "") {
			t.Errorf("%s: error %q, want one only when it failed", r.Ip, r.Error)
		}
	}

	// One audit entry per miner something was sent to, or tried.
	if len(entries) != 2 {
		t.Fatalf("entries = %+v, want the switched and the failed one", entries)
	}
	for _, e := range entries {
		switch e.Target {
		case ips["switched"]:
			want := audit.Change{Field: "pool", Kind: audit.ChangeChanged, Before: "solo.pool:3333", After: "pps.pool:3333"}
			if e.Type != audit.TypeSwitchPool || e.Status != http.StatusOK || len(e.Changes) != 1 || e.Changes[0] != want {
				t.Errorf("switched entry = %+v, want a switch_pool with the pool it left", e)
			}
		case ips["failed"]:
			if e.Type != audit.TypeSwitchPool || e.Status != http.StatusBadGateway || e.Error == "" {
				t.Errorf("failed entry = %+v, want a switch_pool 502 with its error", e)
			}
		default:
			t.Errorf("unexpected entry %+v", e)
		}
	}
}
