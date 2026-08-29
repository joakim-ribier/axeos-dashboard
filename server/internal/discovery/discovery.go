// internal/discovery/discovery.go
package discovery

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
)

// maxScanHosts caps a single scan to a /24 (254 usable hosts) -- enough for
// any home/lab network this tool targets, and small enough that a scan
// stays cheap and never accidentally sweeps a much larger range than the
// operator intended.
const maxScanHosts = 254

// scanConcurrency bounds how many hosts are probed at once.
const scanConcurrency = 40

// DefaultProbeTimeout is used when the caller doesn't override it. Kept
// short and decoupled from endpoints.timeout (tuned for polling real,
// already-known devices) -- a scan spends most of its time waiting out
// hosts that never answer at all (nothing listening, or no device at that
// address), so per-host timeout dominates total scan time:
// ceil(maxScanHosts/scanConcurrency) rounds * timeout.
const DefaultProbeTimeout = 1 * time.Second

// MaxProbeTimeout bounds how far a caller can raise the per-host timeout
// (e.g. to retry a scan that found nothing, in case the network is just
// slow). Sized to keep a worst-case full scan comfortably under the
// dashboard-api router's 30s request timeout:
// ceil(maxScanHosts/scanConcurrency) * MaxProbeTimeout = 7 * 3s = 21s.
const MaxProbeTimeout = 3 * time.Second

// deviceProbeResponse is the minimal shape read back from a device's own
// GET /api/system/info -- just enough to identify it and pre-fill a Bitaxe
// entry. Mirrors the same field names other packages already decode from
// this same endpoint (see handler.PayloadStructure, healtcheck.MinerCommon),
// duplicated locally rather than imported to keep this package decoupled,
// the same way feeder.go and watcher.go each keep their own minimal decode
// structs instead of sharing one.
type deviceProbeResponse struct {
	Hostname string `json:"hostname"`
	MacAddr  string `json:"macAddr"`

	// Field names mirror config.BitaxeServerSettings (the shape this same
	// device accepts back on a PATCH to update these settings) -- the
	// device's own GET /api/system/info echoes its current pool config
	// under the identical keys.
	StratumURL          string `json:"stratumURL"`
	StratumPort         int    `json:"stratumPort"`
	StratumUser         string `json:"stratumUser"`
	FallbackStratumURL  string `json:"fallbackStratumURL"`
	FallbackStratumPort int    `json:"fallbackStratumPort"`
	FallbackStratumUser string `json:"fallbackStratumUser"`

	// DeviceModel is only ever present on a NerdAxe response (see
	// handler.PayloadStructure.getDeviceModel) -- its absence is the
	// heuristic used to tell the two device families apart during
	// discovery, since the operator hasn't told us the model yet.
	DeviceModel string `json:"deviceModel"`
}

func (r deviceProbeResponse) guessModel() config.Model {
	if r.DeviceModel != "" {
		return config.ModelNerdaxe
	}
	return config.ModelBitaxe
}

// toBitaxe builds a ready-to-save config.Bitaxe entry from what the device
// itself reports -- hostname, mac, guessed model, and whatever pool it's
// already pointed at (a freshly flashed or previously configured device
// often already has one), so the operator only has to review, not retype.
func (r deviceProbeResponse) toBitaxe(ip string) config.Bitaxe {
	return config.Bitaxe{
		Ip:           ip,
		Mac:          r.MacAddr,
		Hostname:     r.Hostname,
		Model:        r.guessModel(),
		Enabled:      true,
		Url:          r.StratumURL,
		Port:         r.StratumPort,
		User:         r.StratumUser,
		FallbackURL:  r.FallbackStratumURL,
		FallbackPort: r.FallbackStratumPort,
		FallbackUser: r.FallbackStratumUser,
	}
}

// Probe checks a single IP for an AxeOS device. On success it returns a
// config.Bitaxe entry pre-filled from the device's own response -- shaped
// exactly like a miners.yml entry, ready to be reviewed and saved as-is.
func Probe(ctx context.Context, endpoint string, timeout time.Duration, ip string) (config.Bitaxe, error) {
	client := &http.Client{Timeout: timeout}
	url := fmt.Sprintf("http://%s/%s", ip, endpoint)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return config.Bitaxe{}, err
	}

	resp, err := client.Do(req)
	if err != nil {
		return config.Bitaxe{}, fmt.Errorf("%s: %w", ip, err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return config.Bitaxe{}, fmt.Errorf("%s returned %s", ip, resp.Status)
	}

	var probe deviceProbeResponse
	if err := json.NewDecoder(resp.Body).Decode(&probe); err != nil {
		return config.Bitaxe{}, fmt.Errorf("%s: invalid response: %w", ip, err)
	}
	if probe.Hostname == "" || probe.MacAddr == "" {
		return config.Bitaxe{}, fmt.Errorf("%s: not an AxeOS device", ip)
	}

	return probe.toBitaxe(ip), nil
}

// Scan probes every host in cidr concurrently and returns a config.Bitaxe
// entry for each one that answers as an AxeOS device. Order is not
// guaranteed (probes run in parallel).
func Scan(ctx context.Context, endpoint string, timeout time.Duration, cidr string) ([]config.Bitaxe, error) {
	ips, err := hostsInCIDR(cidr)
	if err != nil {
		return nil, err
	}
	if len(ips) > maxScanHosts {
		return nil, fmt.Errorf("range too large (%d hosts) -- pass a /24 or smaller", len(ips))
	}

	var (
		wg    sync.WaitGroup
		mu    sync.Mutex
		found []config.Bitaxe
		sem   = make(chan struct{}, scanConcurrency)
	)

	for _, ip := range ips {
		wg.Add(1)
		sem <- struct{}{}
		go func(ip string) {
			defer wg.Done()
			defer func() { <-sem }()

			b, err := Probe(ctx, endpoint, timeout, ip)
			if err != nil {
				return
			}
			mu.Lock()
			found = append(found, b)
			mu.Unlock()
		}(ip)
	}

	wg.Wait()
	return found, nil
}

// LocalCIDR returns the /24 of the first non-loopback IPv4 network
// interface found -- used to pre-fill the scan range in the UI so a
// first-time user doesn't have to know or type their own subnet.
func LocalCIDR() (string, error) {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return "", err
	}
	for _, addr := range addrs {
		ipNet, ok := addr.(*net.IPNet)
		if !ok || ipNet.IP.IsLoopback() {
			continue
		}
		ip4 := ipNet.IP.To4()
		if ip4 == nil {
			continue
		}
		return fmt.Sprintf("%d.%d.%d.0/24", ip4[0], ip4[1], ip4[2]), nil
	}
	return "", fmt.Errorf("no local IPv4 network interface found")
}

// hostsInCIDR expands a CIDR into every usable host address, excluding the
// network and broadcast addresses for anything wider than a /31.
func hostsInCIDR(cidr string) ([]string, error) {
	ip, ipNet, err := net.ParseCIDR(cidr)
	if err != nil {
		return nil, fmt.Errorf("invalid CIDR %q: %w", cidr, err)
	}
	if ip.To4() == nil {
		return nil, fmt.Errorf("only IPv4 is supported")
	}

	// Reject an oversized range by its mask alone, before ever expanding it
	// into a slice -- a /8 is 16M+ addresses, too expensive to enumerate
	// just to then throw away for being over maxScanHosts.
	if ones, bits := ipNet.Mask.Size(); bits-ones > 8 {
		return nil, fmt.Errorf("range too large (/%d) -- pass a /24 or smaller", ones)
	}

	var ips []string
	for cur := cloneIP(ipNet.IP.To4()); ipNet.Contains(cur); incIP(cur) {
		ips = append(ips, cur.String())
	}

	if ones, bits := ipNet.Mask.Size(); bits-ones >= 2 && len(ips) >= 2 {
		ips = ips[1 : len(ips)-1] // drop network + broadcast addresses
	}
	return ips, nil
}

func cloneIP(ip net.IP) net.IP {
	dup := make(net.IP, len(ip))
	copy(dup, ip)
	return dup
}

func incIP(ip net.IP) {
	for i := len(ip) - 1; i >= 0; i-- {
		ip[i]++
		if ip[i] != 0 {
			break
		}
	}
}
