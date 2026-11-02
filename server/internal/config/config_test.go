package config

import (
	"errors"
	"strings"
	"testing"
)

func TestBitaxeServerSettings_slots(t *testing.T) {
	s := BitaxeServerSettings{
		Url: "solo.pool", Port: 3333, User: "acct.solo",
		FallbackURL: "pps.pool", FallbackPort: 3333, FallbackUser: "acct.pps",
	}
	solo := Slot{Pool: Pool{URL: "solo.pool", Port: 3333}, User: "acct.solo"}
	pps := Slot{Pool: Pool{URL: "pps.pool", Port: 3333}, User: "acct.pps"}

	if s.Slot(Primary) != solo || s.Slot(Fallback) != pps {
		t.Errorf("Slot() = %+v / %+v, want %+v / %+v", s.Slot(Primary), s.Slot(Fallback), solo, pps)
	}

	holding := []struct {
		pool    Pool
		want    PoolTarget
		wantErr error
	}{
		{solo.Pool, Primary, nil},
		{pps.Pool, Fallback, nil},
		{Pool{URL: "pps.pool", Port: 4444}, "", ErrPoolNotHeld}, // another port, another pool
		{Pool{URL: "other.pool", Port: 3333}, "", ErrPoolNotHeld},
	}
	for _, h := range holding {
		if got, err := s.Holding(h.pool); got != h.want || !errors.Is(err, h.wantErr) {
			t.Errorf("Holding(%s) = %q, %v, want %q, %v", h.pool, got, err, h.want, h.wantErr)
		}
	}
}

func TestBitaxeServerSettings_Activating(t *testing.T) {
	s := BitaxeServerSettings{
		Url: "solo.pool", Port: 3333, User: "acct.solo",
		FallbackURL: "pps.pool", FallbackPort: 3333, FallbackUser: "acct.pps",
		UseFallbackStratum: true, // whatever it held: Activating decides it
	}
	inOrder := s
	inOrder.UseFallbackStratum = false
	onFallback := s

	tests := []struct {
		model  Model
		target PoolTarget
		want   BitaxeServerSettings
	}{
		{ModelBitaxe, Primary, inOrder},
		{ModelBitaxe, Fallback, onFallback},
		{ModelNerdaxe, Primary, inOrder},
		// Its slots swapped, with the flag Activating decides -- not the one s held.
		{ModelNerdaxe, Fallback, BitaxeServerSettings{
			Url: "pps.pool", Port: 3333, User: "acct.pps",
			FallbackURL: "solo.pool", FallbackPort: 3333, FallbackUser: "acct.solo",
		}},
	}
	for _, tt := range tests {
		if got := s.Activating(tt.model, tt.target); got != tt.want {
			t.Errorf("Activating(%s, %s) = %+v, want %+v", tt.model, tt.target, got, tt.want)
		}
	}
}

func TestBitaxe_WithSlots(t *testing.T) {
	b := Bitaxe{Ip: "10.0.0.1", Alias: "Prof", Url: "old.pool", Port: 1}
	s := BitaxeServerSettings{Url: "new.pool", Port: 3333, User: "u", FallbackURL: "fb.pool", FallbackPort: 4444, FallbackUser: "fu"}

	got := b.WithSlots(s)
	if got.Slots() != s || got.Ip != "10.0.0.1" || got.Alias != "Prof" {
		t.Errorf("WithSlots() = %+v, want its pools replaced, the rest untouched", got)
	}
	if b.Url != "old.pool" {
		t.Error("WithSlots() changed the miner it was called on")
	}
}

func TestConfig_GetMiners(t *testing.T) {
	cfg := Config{
		Bitaxes: []Bitaxe{
			{Ip: "10.0.0.1", Enabled: true},
			{Ip: "10.0.0.2", Enabled: false},
			{Ip: "10.0.0.3", Enabled: true},
		},
	}

	got := cfg.GetMiners()

	if len(got) != 2 {
		t.Fatalf("GetMiners() returned %d miners, want 2", len(got))
	}
	if got[0].Ip != "10.0.0.1" || got[1].Ip != "10.0.0.3" {
		t.Errorf("GetMiners() = %+v, want enabled miners in original order", got)
	}
}

func TestConfig_GetMinersFilterBy(t *testing.T) {
	cfg := Config{
		Bitaxes: []Bitaxe{
			{Ip: "10.0.0.1", Hostname: "bitaxe-1", Enabled: true},
			{Ip: "10.0.0.2", Hostname: "bitaxe-2", Enabled: true},
			{Ip: "10.0.0.3", Hostname: "bitaxe-3", Enabled: false},
		},
	}

	tests := []struct {
		name         string
		hostnameOrIp string
		wantIps      []string
	}{
		{
			name:         "empty filter returns all enabled",
			hostnameOrIp: "",
			wantIps:      []string{"10.0.0.1", "10.0.0.2"},
		},
		{
			name:         "match by ip",
			hostnameOrIp: "10.0.0.2",
			wantIps:      []string{"10.0.0.2"},
		},
		{
			name:         "match by hostname",
			hostnameOrIp: "bitaxe-1",
			wantIps:      []string{"10.0.0.1"},
		},
		{
			name:         "no match",
			hostnameOrIp: "unknown",
			wantIps:      nil,
		},
		{
			name:         "disabled miner is never matched",
			hostnameOrIp: "bitaxe-3",
			wantIps:      nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := cfg.GetMinersFilterBy(tt.hostnameOrIp)

			if len(got) != len(tt.wantIps) {
				t.Fatalf("GetMinersFilterBy(%q) returned %d miners, want %d", tt.hostnameOrIp, len(got), len(tt.wantIps))
			}
			for i, ip := range tt.wantIps {
				if got[i].Ip != ip {
					t.Errorf("GetMinersFilterBy(%q)[%d].Ip = %q, want %q", tt.hostnameOrIp, i, got[i].Ip, ip)
				}
			}
		})
	}
}

func TestBitaxe_GetPoolsSettings(t *testing.T) {
	miner := Bitaxe{
		Model: "bitaxe",
		Url:   "primary.pool", Port: 3333, User: "user.primary",
		FallbackURL: "fallback.pool", FallbackPort: 4444, FallbackUser: "user.fallback",
	}

	tests := []struct {
		name    string
		target  PoolTarget
		want    *BitaxeServerSettings
		wantErr bool
	}{
		{
			// Primary/fallback URL/port/user always stay in their own
			// fixed slots -- switching pools is entirely carried by
			// UseFallbackStratum, not by which pool's data sits in which
			// slot (see Activating's doc comment and
			// BitaxeServerSettings.UseFallbackStratum for why).
			name:   "primary requests useFallbackStratum=false",
			target: Primary,
			want: &BitaxeServerSettings{
				Url: "primary.pool", Port: 3333, User: "user.primary",
				FallbackURL: "fallback.pool", FallbackPort: 4444, FallbackUser: "user.fallback",
				UseFallbackStratum: false,
			},
		},
		{
			name:   "fallback requests useFallbackStratum=true, slots unchanged",
			target: Fallback,
			want: &BitaxeServerSettings{
				Url: "primary.pool", Port: 3333, User: "user.primary",
				FallbackURL: "fallback.pool", FallbackPort: 4444, FallbackUser: "user.fallback",
				UseFallbackStratum: true,
			},
		},
		{
			name:    "unknown target errors",
			target:  PoolTarget("bogus"),
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := miner.GetPoolsSettings(tt.target)

			if tt.wantErr {
				if err == nil {
					t.Fatalf("GetPoolsSettings(%q) error = nil, want error", tt.target)
				}
				return
			}
			if err != nil {
				t.Fatalf("GetPoolsSettings(%q) unexpected error: %v", tt.target, err)
			}
			if *got != *tt.want {
				t.Errorf("GetPoolsSettings(%q) = %+v, want %+v", tt.target, *got, *tt.want)
			}
		})
	}
}

func TestBitaxe_GetPoolsSettings_nerdaxeSwapsURLsInstead(t *testing.T) {
	// NerdQAxePlus firmware has no useFallbackStratum-style field -- its
	// failover manager always tries whichever pool is in the *primary*
	// slot first (see Activating's doc comment), so switching pools
	// means swapping which pool's data sits in that slot.
	miner := Bitaxe{
		Model: "nerdaxe",
		Url:   "primary.pool", Port: 3333, User: "user.primary",
		FallbackURL: "fallback.pool", FallbackPort: 4444, FallbackUser: "user.fallback",
	}

	tests := []struct {
		name   string
		target PoolTarget
		want   *BitaxeServerSettings
	}{
		{
			name:   "primary keeps fallback as fallback",
			target: Primary,
			want: &BitaxeServerSettings{
				Url: "primary.pool", Port: 3333, User: "user.primary",
				FallbackURL: "fallback.pool", FallbackPort: 4444, FallbackUser: "user.fallback",
			},
		},
		{
			name:   "fallback swaps primary and fallback",
			target: Fallback,
			want: &BitaxeServerSettings{
				Url: "fallback.pool", Port: 4444, User: "user.fallback",
				FallbackURL: "primary.pool", FallbackPort: 3333, FallbackUser: "user.primary",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := miner.GetPoolsSettings(tt.target)
			if err != nil {
				t.Fatalf("GetPoolsSettings(%q) unexpected error: %v", tt.target, err)
			}
			if *got != *tt.want {
				t.Errorf("GetPoolsSettings(%q) = %+v, want %+v", tt.target, *got, *tt.want)
			}
		})
	}
}

func TestConfig_MissingMacWarnings(t *testing.T) {
	cfg := Config{
		Bitaxes: []Bitaxe{
			{Ip: "10.0.0.1", Mac: "aabbccddeeff", Hostname: "configured", Enabled: true},
			{Ip: "10.0.0.2", Hostname: "missing-mac", Enabled: true},
			{Ip: "10.0.0.3", Hostname: "disabled-and-missing", Enabled: false},
		},
	}

	warnings := cfg.MissingMacWarnings()
	if len(warnings) != 1 {
		t.Fatalf("warnings = %v, want exactly 1 (disabled miners are never checked)", warnings)
	}
	if !strings.Contains(warnings[0], "10.0.0.2") {
		t.Errorf("warning = %q, want it to mention 10.0.0.2", warnings[0])
	}
}

func TestConfig_MissingMacWarnings_noneWhenAllConfigured(t *testing.T) {
	cfg := Config{
		Bitaxes: []Bitaxe{
			{Ip: "10.0.0.1", Mac: "aabbccddeeff", Enabled: true},
		},
	}
	if warnings := cfg.MissingMacWarnings(); len(warnings) != 0 {
		t.Errorf("warnings = %v, want none", warnings)
	}
}

func TestBitaxe_StorageKey(t *testing.T) {
	tests := []struct {
		name string
		mac  string
		want string
	}{
		{"already normalized", "aabbccddeeff", "aabbccddeeff"},
		{"colon-separated, mixed case", "AA:BB:CC:DD:EE:FF", "aabbccddeeff"},
		{"hyphen-separated", "aa-bb-cc-dd-ee-ff", "aabbccddeeff"},
		{"not configured", "", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b := Bitaxe{Ip: "10.0.0.1", Mac: tt.mac}
			if got := b.StorageKey(); got != tt.want {
				t.Errorf("StorageKey() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestBitaxe_DisplayName(t *testing.T) {
	tests := []struct {
		name     string
		hostname string
		alias    string
		want     string
	}{
		{"no alias falls back to hostname", "bitaxe-1", "", "bitaxe-1"},
		{"alias overrides hostname", "bitaxe-1", "Garage rig", "Garage rig"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b := Bitaxe{Hostname: tt.hostname, Alias: tt.alias}
			if got := b.DisplayName(); got != tt.want {
				t.Errorf("DisplayName() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestStorageConfig_BitaxesDir(t *testing.T) {
	s := StorageConfig{DataDir: "/var/data"}

	got := s.BitaxesDir()
	want := "/var/data/data/bitaxes"

	if got != want {
		t.Errorf("BitaxesDir() = %q, want %q", got, want)
	}
}

func TestStorageConfig_ResolveBoardsDir(t *testing.T) {
	tests := []struct {
		name string
		s    StorageConfig
		want string
	}{
		{
			name: "dataDir/data/boards",
			s:    StorageConfig{DataDir: "/var/data"},
			want: "/var/data/data/boards",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.s.ResolveBoardsDir(); got != tt.want {
				t.Errorf("ResolveBoardsDir() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestConfig_AlertThresholdsFor(t *testing.T) {
	common := AlertThresholds{TempHigh: 65}
	tests := []struct {
		name   string
		common AlertThresholds
		own    AlertThresholds
		want   AlertThresholds
	}{
		{"nothing set: the built-in ones", AlertThresholds{}, AlertThresholds{}, DefaultAlertThresholds},
		{"settings.yml's, the other built-in", common, AlertThresholds{}, AlertThresholds{TempHigh: 65, FanHigh: 75}},
		{"the miner's own over settings.yml's", common, AlertThresholds{TempHigh: 70, FanHigh: 95}, AlertThresholds{TempHigh: 70, FanHigh: 95}},
		{"the miner's own for one only", common, AlertThresholds{FanHigh: 95}, AlertThresholds{TempHigh: 65, FanHigh: 95}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var cfg Config
			AppSettingsFile{Alerts: AlertSettings{AlertThresholds: tt.common}}.ApplyTo(&cfg)
			if got := cfg.AlertThresholdsFor(Bitaxe{Alerts: tt.own}); got != tt.want {
				t.Errorf("AlertThresholdsFor() = %+v, want %+v", got, tt.want)
			}
		})
	}
}

func TestConfig_AlertMargins(t *testing.T) {
	tests := []struct {
		name  string
		saved AlertMargins
		want  AlertMargins
	}{
		{"nothing set: the built-in ones", AlertMargins{}, DefaultAlertMargins},
		{"settings.yml's", AlertMargins{Temp: 4, Fan: 10}, AlertMargins{Temp: 4, Fan: 10}},
		{"one set, the other built-in", AlertMargins{Fan: 10}, AlertMargins{Temp: 2, Fan: 10}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var cfg Config
			AppSettingsFile{Alerts: AlertSettings{AlertMargins: tt.saved}}.ApplyTo(&cfg)
			if got := cfg.AlertMargins(); got != tt.want {
				t.Errorf("AlertMargins() = %+v, want %+v", got, tt.want)
			}
		})
	}
}
