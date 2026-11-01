package axeos

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
)

// fakeMiner answers GET /api/system/info with info, and records the
// PATCH /api/system it gets (nil when none) and whether it was restarted.
type fakeMiner struct {
	addr      string
	patched   *config.BitaxeServerSettings
	restarted bool
}

func newFakeMiner(t *testing.T, info string) *fakeMiner {
	t.Helper()
	m := &fakeMiner{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/system/info":
			_, _ = w.Write([]byte(info))
		case "/api/system":
			m.patched = &config.BitaxeServerSettings{}
			_ = json.NewDecoder(r.Body).Decode(m.patched)
		case "/api/system/restart":
			m.restarted = true
		default:
			t.Errorf("unexpected request path %q", r.URL.Path)
		}
	}))
	t.Cleanup(server.Close)
	m.addr = serverAddr(server)
	return m
}

func switchTestConfig() config.Config {
	return config.Config{Endpoints: config.EndpointConfig{
		Info: "api/system/info", System: "api/system", Restart: "api/system/restart", Timeout: time.Second,
	}}
}

// A bitaxe's info, as v2.15 reports it: useFallbackStratum as a number.
const bitaxeOnPrimary = `{"stratumURL":"solo.pool","stratumPort":3333,"stratumUser":"acct.solo",` +
	`"fallbackStratumURL":"pps.pool","fallbackStratumPort":3333,"fallbackStratumUser":"acct.pps",` +
	`"useFallbackStratum":0,"isUsingFallbackStratum":0,"macAddr":"AA:BB:CC:DD:EE:01"}`

const bitaxeOnFallback = `{"stratumURL":"solo.pool","stratumPort":3333,"stratumUser":"acct.solo",` +
	`"fallbackStratumURL":"pps.pool","fallbackStratumPort":3333,"fallbackStratumUser":"acct.pps",` +
	`"useFallbackStratum":1,"isUsingFallbackStratum":1,"macAddr":"AA:BB:CC:DD:EE:01"}`

const nerdaxeOnPrimary = `{"stratumURL":"solo.pool","stratumPort":3333,"stratumUser":"acct.solo",` +
	`"fallbackStratumURL":"pps.pool","fallbackStratumPort":3333,"fallbackStratumUser":"acct.pps",` +
	`"stratum":{"usingFallback":false},"macAddr":"AA:BB:CC:DD:EE:02"}`

const nerdaxeFailedOver = `{"stratumURL":"solo.pool","stratumPort":3333,"stratumUser":"acct.solo",` +
	`"fallbackStratumURL":"pps.pool","fallbackStratumPort":3333,"fallbackStratumUser":"acct.pps",` +
	`"stratum":{"usingFallback":true},"macAddr":"AA:BB:CC:DD:EE:02"}`

var (
	solo = config.Pool{URL: "solo.pool", Port: 3333}
	pps  = config.Pool{URL: "pps.pool", Port: 3333}
)

func TestAxeOs_SwitchToPool(t *testing.T) {
	slots := config.BitaxeServerSettings{
		Url: "solo.pool", Port: 3333, User: "acct.solo",
		FallbackURL: "pps.pool", FallbackPort: 3333, FallbackUser: "acct.pps",
	}
	swappedSlots := config.BitaxeServerSettings{
		Url: "pps.pool", Port: 3333, User: "acct.pps",
		FallbackURL: "solo.pool", FallbackPort: 3333, FallbackUser: "acct.solo",
	}
	withFallback := slots
	withFallback.UseFallbackStratum = true

	tests := []struct {
		name     string
		model    config.Model
		info     string
		pool     config.Pool
		wantWas  config.Pool
		wantSent *config.BitaxeServerSettings // nil: nothing sent, no restart
	}{
		{
			name:  "bitaxe holding the pool in its fallback slot selects that slot",
			model: config.ModelBitaxe, info: bitaxeOnPrimary, pool: pps,
			wantWas: solo, wantSent: &withFallback,
		},
		{
			name:  "bitaxe holding the pool in its primary slot selects that slot",
			model: config.ModelBitaxe, info: bitaxeOnFallback, pool: solo,
			wantWas: pps, wantSent: &slots,
		},
		{
			name:  "bitaxe already on the pool is left alone",
			model: config.ModelBitaxe, info: bitaxeOnFallback, pool: pps,
			wantWas: pps,
		},
		{
			name:  "nerdaxe holding the pool in its fallback slot gets it in its primary one",
			model: config.ModelNerdaxe, info: nerdaxeOnPrimary, pool: pps,
			wantWas: solo, wantSent: &swappedSlots,
		},
		{
			name:  "nerdaxe failed over to its fallback gets its slots back as they are",
			model: config.ModelNerdaxe, info: nerdaxeFailedOver, pool: solo,
			wantWas: pps, wantSent: &slots,
		},
		{
			name:  "nerdaxe already on the pool is left alone",
			model: config.ModelNerdaxe, info: nerdaxeOnPrimary, pool: solo,
			wantWas: solo,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			device := newFakeMiner(t, tt.info)
			miner := config.Bitaxe{Ip: device.addr, Model: tt.model}

			was, switched, err := NewAxeOs(testLogger(), switchTestConfig()).SwitchToPool(context.Background(), miner, tt.pool)
			if err != nil {
				t.Fatalf("SwitchToPool() error = %v, want nil", err)
			}
			if was != tt.wantWas {
				t.Errorf("was = %v, want %v", was, tt.wantWas)
			}
			if switched != (tt.wantSent != nil) {
				t.Errorf("switched = %v, want %v", switched, tt.wantSent != nil)
			}
			if tt.wantSent == nil {
				if device.patched != nil || device.restarted {
					t.Errorf("sent %+v (restarted: %v), want nothing", device.patched, device.restarted)
				}
				return
			}
			if device.patched == nil || *device.patched != *tt.wantSent {
				t.Errorf("sent %+v, want %+v", device.patched, *tt.wantSent)
			}
			if !device.restarted {
				t.Error("expected a restart to apply the switch")
			}
		})
	}

	t.Run("a miner without the pool gets nothing", func(t *testing.T) {
		device := newFakeMiner(t, bitaxeOnPrimary)
		miner := config.Bitaxe{Ip: device.addr, Model: config.ModelBitaxe}

		_, switched, err := NewAxeOs(testLogger(), switchTestConfig()).SwitchToPool(context.Background(), miner, config.Pool{URL: "other.pool", Port: 3333})

		if !errors.Is(err, ErrPoolNotHeld) {
			t.Errorf("error = %v, want ErrPoolNotHeld", err)
		}
		if switched || device.patched != nil || device.restarted {
			t.Error("nothing should be sent to a miner without the pool")
		}
	})

	t.Run("the same URL on another port is another pool", func(t *testing.T) {
		device := newFakeMiner(t, bitaxeOnPrimary)
		miner := config.Bitaxe{Ip: device.addr, Model: config.ModelBitaxe}

		_, _, err := NewAxeOs(testLogger(), switchTestConfig()).SwitchToPool(context.Background(), miner, config.Pool{URL: "pps.pool", Port: 4444})

		if !errors.Is(err, ErrPoolNotHeld) {
			t.Errorf("error = %v, want ErrPoolNotHeld", err)
		}
	})

	t.Run("a miner that can't be read gets nothing", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path != "/api/system/info" {
				t.Errorf("unexpected request %q: nothing should be sent", r.URL.Path)
			}
			w.WriteHeader(http.StatusInternalServerError)
		}))
		defer server.Close()

		_, switched, err := NewAxeOs(testLogger(), switchTestConfig()).SwitchToPool(context.Background(), config.Bitaxe{Ip: serverAddr(server)}, pps)

		if err == nil || errors.Is(err, ErrPoolNotHeld) || switched {
			t.Errorf("err = %v, switched = %v, want a read error", err, switched)
		}
	})
}

func TestAxeOs_ReadPools(t *testing.T) {
	tests := []struct {
		name    string
		model   config.Model
		info    string
		wantMac string
	}{
		// Regression: a bitaxe reports useFallbackStratum as a number (0/1),
		// which used to fail the decode into config.BitaxeServerSettings.
		{"a bitaxe tells its active slot with isUsingFallbackStratum", config.ModelBitaxe, bitaxeOnFallback, "AA:BB:CC:DD:EE:01"},
		{"a nerdaxe tells it under stratum", config.ModelNerdaxe, nerdaxeFailedOver, "AA:BB:CC:DD:EE:02"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			device := newFakeMiner(t, tt.info)

			got, err := NewAxeOs(testLogger(), switchTestConfig()).ReadPools(context.Background(), config.Bitaxe{Ip: device.addr, Model: tt.model})
			if err != nil {
				t.Fatalf("ReadPools() error = %v, want nil", err)
			}
			pools := got.Pools()
			if pools.Url != "solo.pool" || pools.FallbackUser != "acct.pps" || pools.MacAddr != tt.wantMac {
				t.Errorf("Pools() = %+v, want the device's pools and MAC", pools)
			}
			if got.Active() != config.Fallback {
				t.Errorf("Active() = %q, want fallback", got.Active())
			}
		})
	}
}
