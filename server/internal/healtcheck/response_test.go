package healtcheck

import (
	"testing"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
)

func TestBitaxe_ToAxeOs(t *testing.T) {
	tests := []struct {
		name string
		b    Bitaxe
		want AxeOs
	}{
		{
			name: "using primary stratum",
			b: Bitaxe{
				MinerCommon: MinerCommon{
					Hostname: "bitaxe-1", MacAddr: "aa:bb", Temp: 55.5,
					StratumURL: "primary.pool", FallbackStratumURL: "fallback.pool",
					SharesAccepted: 42,
				},
				ResponseTime:           12.3,
				IsUsingFallbackStratum: 0,
			},
			want: AxeOs{
				Hostname: "bitaxe-1", MacAddr: "aa:bb", Temp: 55.5,
				URL: "primary.pool", FallbackURL: "fallback.pool",
				SharesAccepted: 42, Ping: 12.3, UsingFallback: false,
			},
		},
		{
			name: "using fallback stratum",
			b: Bitaxe{
				MinerCommon:            MinerCommon{Hostname: "bitaxe-2"},
				ResponseTime:           7.0,
				IsUsingFallbackStratum: 1,
			},
			want: AxeOs{Hostname: "bitaxe-2", Ping: 7.0, UsingFallback: true},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.b.ToAxeOs(); got != tt.want {
				t.Errorf("ToAxeOs() = %+v, want %+v", got, tt.want)
			}
		})
	}
}

func TestNerdaxe_ToAxeOs(t *testing.T) {
	tests := []struct {
		name string
		n    Nerdaxe
		want AxeOs
	}{
		{
			name: "using primary stratum",
			n: Nerdaxe{
				MinerCommon: MinerCommon{
					Hostname: "nerdaxe-1", MacAddr: "cc:dd", Temp: 60.1,
					StratumURL: "primary.pool", FallbackStratumURL: "fallback.pool",
					SharesAccepted: 7,
				},
				Ping: 4.2,
			},
			want: AxeOs{
				Hostname: "nerdaxe-1", MacAddr: "cc:dd", Temp: 60.1,
				URL: "primary.pool", FallbackURL: "fallback.pool",
				SharesAccepted: 7, Ping: 4.2, UsingFallback: false,
			},
		},
		{
			name: "using fallback stratum",
			n: func() Nerdaxe {
				n := Nerdaxe{MinerCommon: MinerCommon{Hostname: "nerdaxe-2"}, Ping: 9.9}
				n.Stratum.UsingFallback = true
				return n
			}(),
			want: AxeOs{Hostname: "nerdaxe-2", Ping: 9.9, UsingFallback: true},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.n.ToAxeOs(); got != tt.want {
				t.Errorf("ToAxeOs() = %+v, want %+v", got, tt.want)
			}
		})
	}
}

// Decoded from each model's real /api/system/info shape -- the nerdaxe's
// flag sits in a nested "stratum" object, which a struct literal never
// exercised: it was read as a "stratum.usingFallback" key, always false.
func TestParseAxeOsDeviceResponse_usingFallback(t *testing.T) {
	tests := []struct {
		name  string
		model config.Model
		info  string
	}{
		{"bitaxe", config.ModelBitaxe, `{"isUsingFallbackStratum":1}`},
		{"nerdaxe", config.ModelNerdaxe, `{"stratum":{"usingFallback":true}}`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parseAxeOsDeviceResponse([]byte(tt.info), tt.model)
			if err != nil {
				t.Fatalf("parse error = %v", err)
			}
			if !got.ToAxeOs().UsingFallback {
				t.Error("UsingFallback = false, want true")
			}
		})
	}
}
