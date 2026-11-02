package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/audit"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
)

// syncDevice answers GET /api/system/info with info -- as a bitaxe would,
// useFallbackStratum as a number.
func syncDevice(t *testing.T, info string) string {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/info" {
			t.Errorf("unexpected request %q: the check only reads", r.URL.Path)
		}
		_, _ = w.Write([]byte(info))
	}))
	t.Cleanup(server.Close)
	return settingsTestServerAddr(server)
}

const syncInfo = `{"macAddr":"AA:BB:CC:DD:EE:01","useFallbackStratum":0,` +
	`"stratumURL":"solo.pool","stratumPort":3333,"stratumUser":"acct.solo",` +
	`"fallbackStratumURL":"pps.pool","fallbackStratumPort":3333,"fallbackStratumUser":"acct.pps-NEW"}`

func syncMiner(ip string) config.Bitaxe {
	return config.Bitaxe{
		Ip: ip, Mac: "aa:bb:cc:dd:ee:01", Hostname: "bitaxe-1", Alias: "Prof", Enabled: true, Model: config.ModelBitaxe,
		Url: "solo.pool", Port: 3333, User: "acct.solo",
		FallbackURL: "pps.pool", FallbackPort: 3333, FallbackUser: "acct.pps",
		Schedule: []config.CronSchedule{{Cron: "0 0 0 * * WED", Action: config.ActionRestart}},
	}
}

func runMinersSync(t *testing.T, miners ...config.Bitaxe) minersSyncResponse {
	t.Helper()
	cfg := config.Config{
		Endpoints: config.EndpointConfig{Info: "info", Timeout: time.Second},
		Bitaxes:   miners,
	}
	w := httptest.NewRecorder()
	MinersSync(settingsTestLogger(), cfg, w, httptest.NewRequest(http.MethodGet, "/api/config/miners/sync", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200, body = %s", w.Code, w.Body.String())
	}
	var got minersSyncResponse
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	return got
}

func TestMinersSync(t *testing.T) {
	t.Run("reports each differing field and the entry to save, the rest of it untouched", func(t *testing.T) {
		miner := syncMiner(syncDevice(t, syncInfo))

		got := runMinersSync(t, miner)

		if len(got.Miners) != 1 {
			t.Fatalf("miners = %+v, want 1", got.Miners)
		}
		m := got.Miners[0]
		if m.Ip != miner.Ip || m.Mac != miner.Mac || m.Device == nil || m.Device.FallbackUser != "acct.pps-NEW" || m.Error != "" {
			t.Errorf("miner = %+v, want its IP, MAC and the pools read off it", m)
		}
		want := []audit.Change{{Field: "fallbackUser", Kind: audit.ChangeChanged, Before: "acct.pps", After: "acct.pps-NEW"}}
		if len(m.Changes) != 1 || m.Changes[0] != want[0] {
			t.Errorf("changes = %+v, want %+v", m.Changes, want)
		}
		if len(got.Bitaxes) != 1 {
			t.Fatalf("bitaxes = %+v, want the one entry to sync", got.Bitaxes)
		}
		synced := got.Bitaxes[0]
		if synced.FallbackUser != "acct.pps-NEW" || synced.Alias != "Prof" || len(synced.Schedule) != 1 || synced.Url != "solo.pool" {
			t.Errorf("entry to save = %+v, want only its fallback user changed", synced)
		}
	})

	t.Run("a miner matching the dashboard has nothing to sync", func(t *testing.T) {
		miner := syncMiner(syncDevice(t, syncInfo))
		miner.FallbackUser = "acct.pps-NEW"

		got := runMinersSync(t, miner)

		if len(got.Miners) != 1 || len(got.Miners[0].Changes) != 0 || got.Miners[0].Device == nil {
			t.Errorf("miners = %+v, want it reported, read, without changes", got.Miners)
		}
		if len(got.Bitaxes) != 0 {
			t.Errorf("bitaxes = %+v, want none", got.Bitaxes)
		}
	})

	t.Run("another device at the miner's IP is never read as it", func(t *testing.T) {
		miner := syncMiner(syncDevice(t, syncInfo))
		miner.Mac = "11:22:33:44:55:66"

		got := runMinersSync(t, miner)

		if m := got.Miners[0]; m.Error == "" || m.Device != nil || len(m.Changes) != 0 {
			t.Errorf("miner = %+v, want an error and nothing read", m)
		}
		if len(got.Bitaxes) != 0 {
			t.Errorf("bitaxes = %+v, want none", got.Bitaxes)
		}
	})

	t.Run("an unreachable miner is reported, not synced", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
		addr := settingsTestServerAddr(server)
		server.Close()

		got := runMinersSync(t, syncMiner(addr))

		if m := got.Miners[0]; m.Error == "" || m.Device != nil {
			t.Errorf("miner = %+v, want an error", m)
		}
	})

	t.Run("only enabled miners are checked", func(t *testing.T) {
		miner := syncMiner(syncDevice(t, syncInfo))
		disabled := syncMiner("192.0.2.1")
		disabled.Mac, disabled.Enabled = "aa:bb:cc:dd:ee:02", false

		got := runMinersSync(t, miner, disabled)

		if len(got.Miners) != 1 || got.Miners[0].Ip != miner.Ip {
			t.Errorf("miners = %+v, want the enabled one alone", got.Miners)
		}
	})
}
