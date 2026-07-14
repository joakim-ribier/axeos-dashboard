package config

import "testing"

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
		Url: "primary.pool", Port: 3333, User: "user.primary",
		FallbackURL: "fallback.pool", FallbackPort: 4444, FallbackUser: "user.fallback",
	}

	tests := []struct {
		name    string
		target  PoolTarget
		want    *BitaxeServerSettings
		wantErr bool
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

func TestBitaxe_GetWifiSettings(t *testing.T) {
	miner := Bitaxe{Hostname: "bitaxe-1"}
	wifi := Wifi{Name: "my-ssid", Pwd: "secret"}

	got := miner.GetWifiSettings(wifi)
	want := BitaxeWifiSettings{Name: "my-ssid", Pwd: "secret", Hostname: "bitaxe-1"}

	if got != want {
		t.Errorf("GetWifiSettings() = %+v, want %+v", got, want)
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
			name: "explicit boardsDir wins",
			s:    StorageConfig{DataDir: "/var/data", BoardsDir: "/custom/boards"},
			want: "/custom/boards",
		},
		{
			name: "falls back to dataDir/data/boards",
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
