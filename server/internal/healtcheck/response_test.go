package healtcheck

import "testing"

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
				Ping:                   4.2,
				IsUsingFallbackStratum: false,
			},
			want: AxeOs{
				Hostname: "nerdaxe-1", MacAddr: "cc:dd", Temp: 60.1,
				URL: "primary.pool", FallbackURL: "fallback.pool",
				SharesAccepted: 7, Ping: 4.2, UsingFallback: false,
			},
		},
		{
			name: "using fallback stratum",
			n: Nerdaxe{
				MinerCommon:            MinerCommon{Hostname: "nerdaxe-2"},
				Ping:                   9.9,
				IsUsingFallbackStratum: true,
			},
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
