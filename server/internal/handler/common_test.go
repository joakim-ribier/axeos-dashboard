package handler

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
)

func TestPoolDashboardURL(t *testing.T) {
	dashboards := map[string]string{
		"stratum.braiins.com": "https://pool.braiins.com/mining/overview/{user}",
	}

	tests := []struct {
		name        string
		stratumURL  string
		stratumUser string
		want        string
	}{
		{
			name:        "known pool substitutes account before first dot",
			stratumURL:  "stratum.braiins.com",
			stratumUser: "myaccount.worker1",
			want:        "https://pool.braiins.com/mining/overview/myaccount",
		},
		{
			name:        "known pool with no dot in user",
			stratumURL:  "stratum.braiins.com",
			stratumUser: "myaccount",
			want:        "https://pool.braiins.com/mining/overview/myaccount",
		},
		{
			name:        "unknown pool returns empty",
			stratumURL:  "unknown.pool",
			stratumUser: "myaccount",
			want:        "",
		},
		{
			name:        "empty user returns empty even for known pool",
			stratumURL:  "stratum.braiins.com",
			stratumUser: "",
			want:        "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := poolDashboardURL(tt.stratumURL, tt.stratumUser, dashboards); got != tt.want {
				t.Errorf("poolDashboardURL(%q, %q) = %q, want %q", tt.stratumURL, tt.stratumUser, got, tt.want)
			}
		})
	}
}

func TestPayloadStructure_getResponseTime(t *testing.T) {
	tests := []struct {
		name  string
		p     PayloadStructure
		miner config.Bitaxe
		want  float64
	}{
		{
			name:  "bitaxe uses ResponseTime",
			p:     PayloadStructure{ResponseTime: 12.5, Ping: 99},
			miner: config.Bitaxe{Model: "bitaxe"},
			want:  12.5,
		},
		{
			name:  "nerdaxe uses Ping",
			p:     PayloadStructure{ResponseTime: 12.5, Ping: 99},
			miner: config.Bitaxe{Model: "nerdaxe"},
			want:  99,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.p.getResponseTime(tt.miner); got != tt.want {
				t.Errorf("getResponseTime() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestPayloadStructure_getIsUsingFallbackStratum(t *testing.T) {
	tests := []struct {
		name  string
		p     PayloadStructure
		miner config.Bitaxe
		want  int64
	}{
		{
			name:  "bitaxe uses IsUsingFallbackStratum directly",
			p:     PayloadStructure{IsUsingFallbackStratum: 1},
			miner: config.Bitaxe{Model: "bitaxe"},
			want:  1,
		},
		{
			name:  "nerdaxe using fallback maps true to 1",
			p:     PayloadStructure{StratumConfig: StratumConfig{UsingFallback: true}},
			miner: config.Bitaxe{Model: "nerdaxe"},
			want:  1,
		},
		{
			name:  "nerdaxe not using fallback maps false to 0",
			p:     PayloadStructure{StratumConfig: StratumConfig{UsingFallback: false}},
			miner: config.Bitaxe{Model: "nerdaxe"},
			want:  0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.p.getIsUsingFallbackStratum(tt.miner); got != tt.want {
				t.Errorf("getIsUsingFallbackStratum() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestPayloadStructure_getBlockFound(t *testing.T) {
	tests := []struct {
		name string
		p    PayloadStructure
		want int64
	}{
		{name: "nerdaxe foundBlocks takes priority", p: PayloadStructure{FoundBlocks: 3, BlockFound: 1}, want: 3},
		{name: "bitaxe blockFound used when foundBlocks is zero", p: PayloadStructure{FoundBlocks: 0, BlockFound: 2}, want: 2},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.p.getBlockFound(); got != tt.want {
				t.Errorf("getBlockFound() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestPayloadStructure_getDeviceModel(t *testing.T) {
	tests := []struct {
		name  string
		p     PayloadStructure
		miner config.Bitaxe
		want  string
	}{
		{
			name:  "deviceModel from payload wins",
			p:     PayloadStructure{DeviceModel: "NerdQAxe++", BoardVersion: "602"},
			miner: config.Bitaxe{Model: "bitaxe"},
			want:  "NerdQAxe++",
		},
		{
			name:  "falls back to Bitaxe + boardVersion",
			p:     PayloadStructure{BoardVersion: "602"},
			miner: config.Bitaxe{Model: "bitaxe"},
			want:  "Bitaxe 602",
		},
		{
			name:  "falls back to config model",
			p:     PayloadStructure{},
			miner: config.Bitaxe{Model: "bitaxe"},
			want:  "bitaxe",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.p.getDeviceModel(tt.miner); got != tt.want {
				t.Errorf("getDeviceModel() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestToMinerInfo(t *testing.T) {
	miner := config.Bitaxe{Ip: "10.0.0.1", Hostname: "bitaxe-1", Model: "bitaxe"}
	dashboards := map[string]string{"pool.example": "https://dash.example/{user}"}

	tests := []struct {
		name           string
		raw            latestFileStructure
		latestFirmware string
		wantHashRateTH float64
		wantEnergyJPTh float64
		wantUpdateAvl  bool
	}{
		{
			name: "converts GH/s to TH/s and computes energy per TH",
			raw: latestFileStructure{
				Timestamp: "2026-07-14T10:00:00Z",
				Payload: PayloadStructure{
					Version: "v2.0", HashRate: 500_000, Power: 15,
					StratumURL: "pool.example", StratumUser: "acct.worker",
				},
			},
			latestFirmware: "v2.0",
			wantHashRateTH: 500,
			wantEnergyJPTh: 15.0 / 500.0,
			wantUpdateAvl:  false,
		},
		{
			name: "update available when versions differ",
			raw: latestFileStructure{
				Payload: PayloadStructure{Version: "v1.0", HashRate: 0, Power: 10},
			},
			latestFirmware: "v2.0",
			wantHashRateTH: 0,
			wantEnergyJPTh: 0, // zero hashrate avoids division and stays 0
			wantUpdateAvl:  true,
		},
		{
			name: "no update info when latest firmware unknown",
			raw: latestFileStructure{
				Payload: PayloadStructure{Version: "v1.0"},
			},
			latestFirmware: "",
			wantUpdateAvl:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := toMinerInfo(tt.raw, miner, tt.latestFirmware, "", dashboards)

			if got.HashRateTHs != tt.wantHashRateTH {
				t.Errorf("HashRateTHs = %v, want %v", got.HashRateTHs, tt.wantHashRateTH)
			}
			if got.EnergyJPerTh != tt.wantEnergyJPTh {
				t.Errorf("EnergyJPerTh = %v, want %v", got.EnergyJPerTh, tt.wantEnergyJPTh)
			}
			if got.UpdateAvailable != tt.wantUpdateAvl {
				t.Errorf("UpdateAvailable = %v, want %v", got.UpdateAvailable, tt.wantUpdateAvl)
			}
			if got.IP != miner.Ip || got.Hostname != miner.Hostname {
				t.Errorf("IP/Hostname = %q/%q, want %q/%q", got.IP, got.Hostname, miner.Ip, miner.Hostname)
			}
		})
	}

	t.Run("resolves stratum dashboard url", func(t *testing.T) {
		raw := latestFileStructure{
			Payload: PayloadStructure{StratumURL: "pool.example", StratumUser: "acct.worker"},
		}
		got := toMinerInfo(raw, miner, "", "", dashboards)
		want := "https://dash.example/acct"
		if got.StratumDashboardURL != want {
			t.Errorf("StratumDashboardURL = %q, want %q", got.StratumDashboardURL, want)
		}
	})

	t.Run("resolves firmware release url", func(t *testing.T) {
		raw := latestFileStructure{Payload: PayloadStructure{Version: "v1.0"}}
		got := toMinerInfo(raw, miner, "v2.0", "https://api.github.com/repos/bitaxeorg/esp-miner/releases/latest", dashboards)
		want := "https://github.com/bitaxeorg/esp-miner/releases/latest"
		if got.ReleaseURL != want {
			t.Errorf("ReleaseURL = %q, want %q", got.ReleaseURL, want)
		}
	})

	t.Run("empty firmware release url when repo not configured", func(t *testing.T) {
		raw := latestFileStructure{Payload: PayloadStructure{Version: "v1.0"}}
		got := toMinerInfo(raw, miner, "v2.0", "", dashboards)
		if got.ReleaseURL != "" {
			t.Errorf("ReleaseURL = %q, want empty", got.ReleaseURL)
		}
	})
}

func TestFirmwareReleaseURL(t *testing.T) {
	tests := []struct {
		name   string
		apiURL string
		want   string
	}{
		{
			name:   "converts github api releases url",
			apiURL: "https://api.github.com/repos/bitaxeorg/esp-miner/releases/latest",
			want:   "https://github.com/bitaxeorg/esp-miner/releases/latest",
		},
		{
			name:   "empty when not a github api url",
			apiURL: "",
			want:   "",
		},
		{
			name:   "empty when url does not match expected github api shape",
			apiURL: "https://example.com/releases/latest",
			want:   "",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := firmwareReleaseURL(tt.apiURL); got != tt.want {
				t.Errorf("firmwareReleaseURL(%q) = %q, want %q", tt.apiURL, got, tt.want)
			}
		})
	}
}

func TestDecodeLatestJSON(t *testing.T) {
	dir := t.TempDir()

	t.Run("valid file", func(t *testing.T) {
		path := filepath.Join(dir, "latest.json")
		writeTestFile(t, path, `{"ts":"2026-07-14T10:00:00Z","payload":{"hashRate":123}}`)

		got, err := decodeLatestJSON(path)
		if err != nil {
			t.Fatalf("decodeLatestJSON() unexpected error: %v", err)
		}
		if got.Timestamp != "2026-07-14T10:00:00Z" || got.Payload.HashRate != 123 {
			t.Errorf("decodeLatestJSON() = %+v, unexpected content", got)
		}
	})

	t.Run("missing file", func(t *testing.T) {
		if _, err := decodeLatestJSON(filepath.Join(dir, "missing.json")); err == nil {
			t.Fatal("decodeLatestJSON() error = nil, want error for missing file")
		}
	})

	t.Run("corrupted json", func(t *testing.T) {
		path := filepath.Join(dir, "corrupted.json")
		writeTestFile(t, path, `{not valid json`)

		if _, err := decodeLatestJSON(path); err == nil {
			t.Fatal("decodeLatestJSON() error = nil, want error for corrupted JSON")
		}
	})
}

func TestDecodeJSONL(t *testing.T) {
	dir := t.TempDir()

	t.Run("valid entries, blank and malformed lines skipped", func(t *testing.T) {
		path := filepath.Join(dir, "day.jsonl")
		writeTestFile(t, path, `{"ts":"2026-07-14T10:00:00Z"}

not valid json
{"ts":"2026-07-14T10:01:00Z"}
`)

		got, err := decodeJSONL(path)
		if err != nil {
			t.Fatalf("decodeJSONL() unexpected error: %v", err)
		}
		if len(got) != 2 {
			t.Fatalf("decodeJSONL() returned %d entries, want 2 (malformed/blank lines skipped)", len(got))
		}
		if got[0].Timestamp != "2026-07-14T10:00:00Z" || got[1].Timestamp != "2026-07-14T10:01:00Z" {
			t.Errorf("decodeJSONL() = %+v, unexpected content", got)
		}
	})

	t.Run("missing file", func(t *testing.T) {
		if _, err := decodeJSONL(filepath.Join(dir, "missing.jsonl")); err == nil {
			t.Fatal("decodeJSONL() error = nil, want error for missing file")
		}
	})
}

func TestDecodeAlertJSONL(t *testing.T) {
	dir := t.TempDir()

	t.Run("keeps only lines with a non-empty alerts array", func(t *testing.T) {
		path := filepath.Join(dir, "day.jsonl")
		writeTestFile(t, path, `{"ts":"2026-07-14T10:00:00Z","payload":{"temp":51.4}}

not valid json
{"ts":"2026-07-14T10:01:00Z","payload":{"temp":51.4},"alerts":[]}
{"ts":"2026-07-14T10:02:00Z","payload":{"temp":66.3},"alerts":[{"type":"tempHigh","value":66.3,"threshold":62}]}
`)

		got, err := decodeAlertJSONL(path)
		if err != nil {
			t.Fatalf("decodeAlertJSONL() unexpected error: %v", err)
		}
		if len(got) != 1 {
			t.Fatalf("decodeAlertJSONL() returned %d entries, want 1 (no-alert/malformed/blank lines skipped)", len(got))
		}
		if got[0].Timestamp != "2026-07-14T10:02:00Z" || got[0].Alerts[0].Type != "tempHigh" {
			t.Errorf("decodeAlertJSONL() = %+v, unexpected content", got)
		}
	})

	t.Run("missing file", func(t *testing.T) {
		if _, err := decodeAlertJSONL(filepath.Join(dir, "missing.jsonl")); err == nil {
			t.Fatal("decodeAlertJSONL() error = nil, want error for missing file")
		}
	})
}

func writeTestFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("failed to create parent dir for fixture %s: %v", path, err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("failed to write fixture %s: %v", path, err)
	}
}
