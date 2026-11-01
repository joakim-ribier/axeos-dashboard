package audit

import (
	"reflect"
	"testing"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
)

func miner() config.Bitaxe {
	return config.Bitaxe{
		Ip: "10.0.0.1", Mac: "aabbccddee01", Enabled: true,
		Url: "pool.a", Port: 3333, User: "bc1qa.w1",
		FallbackURL: "pool.b", FallbackPort: 3333, FallbackUser: "bc1qb.w1",
		Schedule: []config.CronSchedule{{Cron: "0 0 2 * * *", Action: config.ActionSwitchFallback}},
	}
}

func TestPoolSwap(t *testing.T) {
	m := miner() // pool.a primary, pool.b fallback
	slotsOf := func(url, user, fallbackURL, fallbackUser string) config.BitaxeServerSettings {
		return config.BitaxeServerSettings{
			Url: url, Port: 3333, User: user,
			FallbackURL: fallbackURL, FallbackPort: 3333, FallbackUser: fallbackUser,
		}
	}
	inOrder := slotsOf("pool.a", "bc1qa.w1", "pool.b", "bc1qb.w1")
	swapped := slotsOf("pool.b", "bc1qb.w1", "pool.a", "bc1qa.w1")

	cases := []struct {
		name          string
		before, after config.BitaxeServerSettings
		wantType      string
	}{
		{"ending on miners.yml's primary is a switch to primary", swapped, inOrder, TypeSwitchPrimary},
		{"ending on miners.yml's fallback is a switch to fallback", inOrder, swapped, TypeSwitchFallback},
		{
			"ending on a pool that's neither keeps the route's type",
			slotsOf("pool.b", "bc1qb.w1", "pool.c", "bc1qc.w1"),
			slotsOf("pool.c", "bc1qc.w1", "pool.b", "bc1qb.w1"),
			TypeSwitchFallback,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			e := PoolSwap(m, tc.before, tc.after)
			if e.Type != tc.wantType || e.Target != m.Ip {
				t.Errorf("entry = %s on %q, want %s on %q", e.Type, e.Target, tc.wantType, m.Ip)
			}
			want := PoolChanges(tc.before, tc.after)
			if len(e.Changes) == 0 || !reflect.DeepEqual(e.Changes, want) {
				t.Errorf("changes = %+v, want the slots before → after: %+v", e.Changes, want)
			}
		})
	}
}

func TestMinerChanges(t *testing.T) {
	cases := []struct {
		name   string
		change func(*config.Bitaxe)
		want   []Entry
	}{
		{"nothing sensitive: still said, under the save's own type", func(b *config.Bitaxe) { b.Alias = "Prof"; b.Hostname = "renamed" },
			[]Entry{{Type: TypeSaveMiners, Target: "10.0.0.1", Changes: []Change{
				{Field: "alias", Kind: ChangeChanged, After: "Prof"}, {Field: "hostname", Kind: ChangeChanged, After: "renamed"}}}}},
		{"nothing changed at all", func(b *config.Bitaxe) {}, nil},
		{"a pool's user", func(b *config.Bitaxe) { b.FallbackUser = "bc1qx.w1" },
			[]Entry{{Type: TypeMinerPool, Target: "10.0.0.1", Changes: []Change{{Field: "fallbackUser", Kind: ChangeChanged, Before: "bc1qb.w1", After: "bc1qx.w1"}}}}},
		{"a pool's url and port", func(b *config.Bitaxe) { b.Url, b.Port = "pool.x", 4444 },
			[]Entry{{Type: TypeMinerPool, Target: "10.0.0.1", Changes: []Change{
				{Field: "url", Kind: ChangeChanged, Before: "pool.a", After: "pool.x"}, {Field: "port", Kind: ChangeChanged, Before: "3333", After: "4444"}}}}},
		{"a job removed", func(b *config.Bitaxe) { b.Schedule = nil },
			[]Entry{{Type: TypeMinerSchedule, Target: "10.0.0.1", Changes: []Change{{Field: "scheduleRemoved", Kind: ChangeRemoved, Before: "0 0 2 * * * switch_fallback"}}}}},
		{"a job added, the other kept", func(b *config.Bitaxe) {
			b.Schedule = append(b.Schedule, config.CronSchedule{Cron: "0 0 0 * * WED", Action: config.ActionRestart})
		}, []Entry{{Type: TypeMinerSchedule, Target: "10.0.0.1", Changes: []Change{{Field: "scheduleAdded", Kind: ChangeAdded, After: "0 0 0 * * WED restart"}}}}},
		{"a job replaced: one removed, one added", func(b *config.Bitaxe) {
			b.Schedule = []config.CronSchedule{{Cron: "0 0 3 * * *", Action: config.ActionSwitchFallback}}
		}, []Entry{{Type: TypeMinerSchedule, Target: "10.0.0.1", Changes: []Change{
			{Field: "scheduleRemoved", Kind: ChangeRemoved, Before: "0 0 2 * * * switch_fallback"},
			{Field: "scheduleAdded", Kind: ChangeAdded, After: "0 0 3 * * * switch_fallback"},
		}}}},
		{"the IP", func(b *config.Bitaxe) { b.Ip = "10.0.0.9" },
			[]Entry{{Type: TypeMinerIdentity, Target: "10.0.0.9", Changes: []Change{{Field: "ip", Kind: ChangeChanged, Before: "10.0.0.1", After: "10.0.0.9"}}}}},
		{"disabled", func(b *config.Bitaxe) { b.Enabled = false },
			[]Entry{{Type: TypeMinerDisabled, Target: "10.0.0.1"}}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			after := miner()
			c.change(&after)
			if got := MinerChanges([]config.Bitaxe{miner()}, []config.Bitaxe{after}); !reflect.DeepEqual(got, c.want) {
				t.Errorf("got %+v, want %+v", got, c.want)
			}
		})
	}

	t.Run("a new miner, matched by MAC", func(t *testing.T) {
		added := miner()
		added.Mac, added.Ip = "aa:bb:cc:dd:ee:02", "10.0.0.2"
		got := MinerChanges([]config.Bitaxe{miner()}, []config.Bitaxe{miner(), added})
		want := []Entry{{Type: TypeMinerAdded, Target: "10.0.0.2", Changes: []Change{
			{Field: "url", Kind: ChangeChanged, After: "pool.a"},
			{Field: "port", Kind: ChangeChanged, After: "3333"},
			{Field: "user", Kind: ChangeChanged, After: "bc1qa.w1"},
			{Field: "fallbackUrl", Kind: ChangeChanged, After: "pool.b"},
			{Field: "fallbackPort", Kind: ChangeChanged, After: "3333"},
			{Field: "fallbackUser", Kind: ChangeChanged, After: "bc1qb.w1"},
			{Field: "scheduleAdded", Kind: ChangeAdded, After: "0 0 2 * * * switch_fallback"},
		}}}
		if !reflect.DeepEqual(got, want) {
			t.Errorf("got %+v, want %+v", got, want)
		}
	})

	t.Run("re-enabled", func(t *testing.T) {
		before := miner()
		before.Enabled = false
		got := MinerChanges([]config.Bitaxe{before}, []config.Bitaxe{miner()})
		if want := []Entry{{Type: TypeMinerEnabled, Target: "10.0.0.1"}}; !reflect.DeepEqual(got, want) {
			t.Errorf("got %+v, want %+v", got, want)
		}
	})
}

func TestSettingsChanges(t *testing.T) {
	var before, after config.AppSettingsFile
	before.Remote = config.RemoteConfig{PushURL: "https://hashboard.live/api/push", APIKey: "secret-1"}
	after.Remote = config.RemoteConfig{PushURL: "https://elsewhere.example/api/push", APIKey: "secret-2"}

	got := SettingsChanges(before, after)
	want := []Entry{{Type: TypeRemotePush, Changes: []Change{
		{Field: "pushURL", Kind: ChangeChanged, Before: "https://hashboard.live/api/push", After: "https://elsewhere.example/api/push"},
		// Changed, but its value is never written down.
		{Field: "apiKey", Kind: ChangeChanged},
	}}}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("got %+v, want %+v", got, want)
	}

	if got := SettingsChanges(after, after); got != nil {
		t.Errorf("nothing changed: got %+v, want nothing", got)
	}
}

func TestSettingsChanges_sharedData(t *testing.T) {
	var before, after config.AppSettingsFile
	before.Remote = config.RemoteConfig{SendPools: true}
	after.Remote = config.RemoteConfig{SendUser: true, SendIP: true}

	got := SettingsChanges(before, after)
	want := []Entry{{Type: TypeRemotePush, Changes: []Change{
		{Field: "sendUser", Kind: ChangeChanged, Before: "off", After: "on"},
		{Field: "sendPools", Kind: ChangeChanged, Before: "on", After: "off"},
		{Field: "sendIP", Kind: ChangeChanged, Before: "off", After: "on"},
	}}}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("got %+v, want %+v", got, want)
	}
}

func TestSettingsChanges_details(t *testing.T) {
	var before, after config.AppSettingsFile
	before.Electricity = config.ElectricityConfig{RatePerKwh: 0.1915, Devices: []config.PowerDevice{{Name: "Router", Power: 10}}}
	before.Pools.Dashboards = map[string]string{"pool.a": "https://pool.a/{user}"}
	after.Electricity = config.ElectricityConfig{RatePerKwh: 0.2, Devices: []config.PowerDevice{{Name: "Router", Power: 10}, {Name: "Extractor fan", Power: 30}}}
	after.Pools.Dashboards = map[string]string{}
	after.Firmware.Repos = map[config.Model]string{config.ModelBitaxe: "https://api.github.com/repos/fork/esp-miner/releases/latest"}

	got := SettingsChanges(before, after)
	want := []Entry{{Type: TypeSaveSettings, Changes: []Change{
		{Field: "ratePerKwh", Kind: ChangeChanged, Before: "0.1915", After: "0.2"},
		{Field: "deviceAdded", Kind: ChangeAdded, After: "Extractor fan (30 W)"},
		{Field: "poolDashboardRemoved", Kind: ChangeRemoved, Before: "pool.a: https://pool.a/{user}"},
		{Field: "firmwareRepoAdded", Kind: ChangeAdded, After: "bitaxe: https://api.github.com/repos/fork/esp-miner/releases/latest"},
	}}}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("got %+v, want %+v", got, want)
	}
}

func TestSettingsChanges_mail(t *testing.T) {
	var before, after config.AppSettingsFile
	before.Notifications.Mail = config.MailConfig{
		SMTP: config.SMTPConfig{Host: "smtp.old.example", Port: 587, Security: config.SMTPStartTLS, Username: "axeos", Password: "secret-1", From: "axeos@example.com"},
		To:   []string{"me@example.com"},
	}
	after.Notifications.Mail = config.MailConfig{
		SMTP: config.SMTPConfig{Host: "smtp.new.example", Port: 465, Security: config.SMTPTLS, Username: "axeos", Password: "secret-2", From: "axeos@example.com"},
		To:   []string{"me@example.com", "you@example.com"},
	}

	got := SettingsChanges(before, after)
	want := []Entry{{Type: TypeMailSettings, Changes: []Change{
		{Field: "smtpHost", Kind: ChangeChanged, Before: "smtp.old.example", After: "smtp.new.example"},
		{Field: "smtpPort", Kind: ChangeChanged, Before: "587", After: "465"},
		{Field: "smtpSecurity", Kind: ChangeChanged, Before: "starttls", After: "tls"},
		// Changed, but its value is never written down.
		{Field: "smtpPassword", Kind: ChangeChanged},
		{Field: "recipientAdded", Kind: ChangeAdded, After: "you@example.com"},
	}}}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("got %+v, want %+v", got, want)
	}

	if got := SettingsChanges(after, after); got != nil {
		t.Errorf("nothing changed: got %+v, want nothing", got)
	}
}

func TestSettingsChanges_alertsMail(t *testing.T) {
	var before, after config.AppSettingsFile
	after.Notifications.Alerts.Mail = true

	want := []Entry{{Type: TypeMailSettings, Changes: []Change{
		{Field: "alertsMail", Kind: ChangeChanged, Before: "off", After: "on"},
	}}}
	if got := SettingsChanges(before, after); !reflect.DeepEqual(got, want) {
		t.Errorf("got %+v, want %+v", got, want)
	}
}

func TestMinerChanges_alertThresholds(t *testing.T) {
	before := miner()
	before.Alerts.TempHigh = 70
	after := miner()
	after.Alerts.FanHigh = 95

	want := []Entry{{Type: TypeSaveMiners, Target: "10.0.0.1", Changes: []Change{
		{Field: "alertTempHigh", Kind: ChangeChanged, Before: "70"},
		{Field: "alertFanHigh", Kind: ChangeChanged, After: "95"},
	}}}
	if got := MinerChanges([]config.Bitaxe{before}, []config.Bitaxe{after}); !reflect.DeepEqual(got, want) {
		t.Errorf("got %+v, want %+v", got, want)
	}
}

func TestSettingsChanges_alertThresholds(t *testing.T) {
	var before, after config.AppSettingsFile
	before.Alerts = config.AlertThresholds{TempHigh: 62}
	after.Alerts = config.AlertThresholds{TempHigh: 65, FanHigh: 80}

	want := []Entry{{Type: TypeSaveSettings, Changes: []Change{
		{Field: "alertTempHigh", Kind: ChangeChanged, Before: "62", After: "65"},
		{Field: "alertFanHigh", Kind: ChangeChanged, After: "80"},
	}}}
	if got := SettingsChanges(before, after); !reflect.DeepEqual(got, want) {
		t.Errorf("got %+v, want %+v", got, want)
	}
}
