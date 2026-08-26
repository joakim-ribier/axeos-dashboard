package discovery

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"
)

// fakeDevice starts an httptest server that answers a fixed AxeOS-shaped
// response on the given endpoint path, and returns its host:port.
func fakeDevice(t *testing.T, endpoint string, resp deviceProbeResponse) string {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/"+endpoint {
			http.NotFound(w, r)
			return
		}
		_ = json.NewEncoder(w).Encode(resp)
	}))
	t.Cleanup(srv.Close)

	u, err := url.Parse(srv.URL)
	if err != nil {
		t.Fatalf("parse test server URL: %v", err)
	}
	return u.Host
}

func TestProbe_bitaxe(t *testing.T) {
	addr := fakeDevice(t, "api/system/info", deviceProbeResponse{
		Hostname:            "my-bitaxe",
		MacAddr:             "AA:BB:CC:DD:EE:FF",
		StratumURL:          "solo.atlaspool.io",
		StratumPort:         3333,
		StratumUser:         "wallet.worker",
		FallbackStratumURL:  "stratum.braiins.com",
		FallbackStratumPort: 3334,
		FallbackStratumUser: "wallet.worker2",
	})

	got, err := Probe(context.Background(), "api/system/info", time.Second, addr)
	if err != nil {
		t.Fatalf("Probe() error = %v", err)
	}

	if got.Ip != addr {
		t.Errorf("Ip = %q, want %q", got.Ip, addr)
	}
	if got.Hostname != "my-bitaxe" {
		t.Errorf("Hostname = %q, want %q", got.Hostname, "my-bitaxe")
	}
	if got.Mac != "AA:BB:CC:DD:EE:FF" {
		t.Errorf("Mac = %q, want %q", got.Mac, "AA:BB:CC:DD:EE:FF")
	}
	if got.Model != "bitaxe" {
		t.Errorf("Model = %q, want %q (no deviceModel field in response)", got.Model, "bitaxe")
	}
	if !got.Enabled {
		t.Error("Enabled = false, want true (new discoveries must default enabled)")
	}
	if got.Url != "solo.atlaspool.io" || got.Port != 3333 || got.User != "wallet.worker" {
		t.Errorf("primary pool = %q:%d/%q, want prefilled from device response", got.Url, got.Port, got.User)
	}
	if got.FallbackURL != "stratum.braiins.com" || got.FallbackPort != 3334 || got.FallbackUser != "wallet.worker2" {
		t.Errorf("fallback pool = %q:%d/%q, want prefilled from device response", got.FallbackURL, got.FallbackPort, got.FallbackUser)
	}
}

func TestProbe_nerdaxe(t *testing.T) {
	addr := fakeDevice(t, "api/system/info", deviceProbeResponse{
		Hostname:    "my-nerdaxe",
		MacAddr:     "11:22:33:44:55:66",
		DeviceModel: "NerdQAxe++",
	})

	got, err := Probe(context.Background(), "api/system/info", time.Second, addr)
	if err != nil {
		t.Fatalf("Probe() error = %v", err)
	}
	if got.Model != "nerdaxe" {
		t.Errorf("Model = %q, want %q (deviceModel field present)", got.Model, "nerdaxe")
	}
}

func TestProbe_notAnAxeOsDevice(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	}))
	defer srv.Close()
	u, _ := url.Parse(srv.URL)

	_, err := Probe(context.Background(), "api/system/info", time.Second, u.Host)
	if err == nil {
		t.Fatal("Probe() error = nil, want an error (no hostname/macAddr in response)")
	}
}

func TestProbe_unreachable(t *testing.T) {
	// 192.0.2.0/24 is reserved for documentation (TEST-NET-1, RFC 5737) --
	// guaranteed to never be routable, so this call fails fast-ish rather
	// than hanging, without depending on any real network state.
	_, err := Probe(context.Background(), "api/system/info", 200*time.Millisecond, "192.0.2.1")
	if err == nil {
		t.Fatal("Probe() error = nil, want an error for an unreachable host")
	}
}

func TestScan_nonRespondingHostsAreSkippedNotErrored(t *testing.T) {
	// 192.0.2.0/30 is reserved for documentation (TEST-NET-1, RFC 5737) --
	// guaranteed unreachable, so every probe in range fails. Scan must
	// still return a clean empty result, not propagate each per-host
	// failure as a Scan-level error.
	found, err := Scan(context.Background(), "api/system/info", 200*time.Millisecond, "192.0.2.0/30")
	if err != nil {
		t.Fatalf("Scan() error = %v, want nil (unreachable hosts must be skipped, not fail the scan)", err)
	}
	if len(found) != 0 {
		t.Errorf("Scan() found %d devices, want 0", len(found))
	}
}

func TestScan_rejectsRangeLargerThanA24(t *testing.T) {
	_, err := Scan(context.Background(), "api/system/info", time.Second, "10.0.0.0/16")
	if err == nil {
		t.Fatal("Scan() error = nil, want an error for a range wider than /24")
	}
}

func TestLocalCIDR(t *testing.T) {
	cidr, err := LocalCIDR()
	if err != nil {
		t.Fatalf("LocalCIDR() error = %v", err)
	}
	if !strings.HasSuffix(cidr, ".0/24") {
		t.Errorf("LocalCIDR() = %q, want a /24 CIDR", cidr)
	}
}

func TestHostsInCIDR(t *testing.T) {
	tests := []struct {
		name    string
		cidr    string
		wantLen int
		wantErr bool
	}{
		{name: "/24 excludes network and broadcast", cidr: "192.168.1.0/24", wantLen: 254},
		{name: "/30 excludes network and broadcast", cidr: "10.0.0.0/30", wantLen: 2},
		{name: "/32 keeps the single address", cidr: "10.0.0.5/32", wantLen: 1},
		{name: "invalid CIDR errors", cidr: "not-a-cidr", wantErr: true},
		{name: "IPv6 is rejected", cidr: "2001:db8::/64", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ips, err := hostsInCIDR(tt.cidr)
			if tt.wantErr {
				if err == nil {
					t.Fatal("hostsInCIDR() error = nil, want an error")
				}
				return
			}
			if err != nil {
				t.Fatalf("hostsInCIDR() error = %v", err)
			}
			if len(ips) != tt.wantLen {
				t.Errorf("hostsInCIDR() len = %d, want %d", len(ips), tt.wantLen)
			}
		})
	}
}
