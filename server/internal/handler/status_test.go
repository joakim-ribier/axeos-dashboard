package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
)

func TestRunStatus(t *testing.T) {
	now := time.Date(2026, 10, 16, 12, 0, 0, 0, time.UTC)
	tests := []struct {
		name     string
		last     time.Time
		interval time.Duration
		want     string
	}{
		{"no run yet", time.Time{}, 2 * time.Minute, StateUnknown},
		{"within its interval", now.Add(-time.Minute), 2 * time.Minute, StateOK},
		// Twice the interval, plus a margin: a loop a bit off the beat is fine.
		{"one run missed", now.Add(-4 * time.Minute), 2 * time.Minute, StateOK},
		{"two runs missed", now.Add(-4*time.Minute - 6*time.Second), 2 * time.Minute, StateLate},
		{"no interval to go by", now.Add(-48 * time.Hour), 0, StateOK},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := runStatus(now, tt.last, tt.interval).State; got != tt.want {
				t.Errorf("state = %q, want %q", got, tt.want)
			}
		})
	}
}

// statusConfig is a dashboard with one enabled miner whose last poll is
// polledAt (none when zero), reaching the mailer mailer points at.
func statusConfig(t *testing.T, polledAt time.Time, mailer config.Config) config.Config {
	t.Helper()
	t.Setenv(envDataRoot, "")
	cfg := mailer
	cfg.Storage = config.StorageConfig{DataDir: t.TempDir()}
	cfg.Feeder.Interval = 2 * time.Minute
	cfg.HealthCheck.Interval = time.Minute
	cfg.Firmware.CacheTTL = 24 * time.Hour
	cfg.Bitaxes = []config.Bitaxe{{Ip: "192.168.1.65", Mac: "aa:bb:cc:dd:ee:01", Enabled: true}}
	if !polledAt.IsZero() {
		dir := filepath.Join(cfg.Storage.BitaxesDir(), cfg.Bitaxes[0].StorageKey())
		if err := os.MkdirAll(dir, 0o755); err != nil {
			t.Fatal(err)
		}
		latest := `{"ts":"` + polledAt.UTC().Format(time.RFC3339) + `","payload":{}}`
		if err := os.WriteFile(filepath.Join(dir, "latest.json"), []byte(latest), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	return cfg
}

func getStatus(t *testing.T, cfg config.Config, startedAt time.Time) StatusResponse {
	t.Helper()
	w := httptest.NewRecorder()
	Status(cfg, nil, startedAt, w, httptest.NewRequest(http.MethodGet, "/api/status", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	var resp StatusResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	return resp
}

func TestStatus_everyServiceRunning(t *testing.T) {
	lastCheck := time.Now().Add(-20 * time.Second).UTC().Truncate(time.Second)
	mailer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/mailer/status" {
			http.NotFound(w, r)
			return
		}
		_, _ = w.Write([]byte(`{"startedAt":"2026-10-16T08:00:00Z","lastCheckAt":"` + lastCheck.Format(time.RFC3339) + `"}`))
	}))
	defer mailer.Close()
	polledAt := time.Now().Add(-time.Minute)
	cfg := statusConfig(t, polledAt, mailerAt(mailer))
	startedAt := time.Now().Add(-time.Hour)

	resp := getStatus(t, cfg, startedAt)
	s := resp.Services

	if s.DashboardAPI.State != StateOK || s.DashboardAPI.StartedAt == nil || s.DashboardAPI.Version == "" {
		t.Errorf("dashboardApi = %+v, want running, with its start and version", s.DashboardAPI)
	}
	if s.Feeder.State != StateOK || s.Feeder.Interval != "2m0s" || s.Feeder.LastRunAt == nil ||
		!s.Feeder.LastRunAt.Equal(polledAt.UTC().Truncate(time.Second)) {
		t.Errorf("feeder = %+v, want running, its last poll from latest.json", s.Feeder)
	}
	if s.Mailer.State != StateOK || s.Mailer.Interval != "1m0s" || s.Mailer.LastRunAt == nil ||
		!s.Mailer.LastRunAt.Equal(lastCheck) || s.Mailer.StartedAt == nil {
		t.Errorf("mailer = %+v, want running, as it answered", s.Mailer)
	}
	// No watcher, no firmware cache in this test: nothing to go by yet.
	if s.HealthCheck.State != StateUnknown || s.FirmwareCache.State != StateUnknown {
		t.Errorf("healthCheck = %+v, firmwareCache = %+v, want unknown", s.HealthCheck, s.FirmwareCache)
	}
}

func TestStatus_aStoppedLoopAndAnUnreachableMailer(t *testing.T) {
	cfg := statusConfig(t, time.Now().Add(-10*time.Minute), stoppedMailer())

	s := getStatus(t, cfg, time.Now()).Services

	if s.Feeder.State != StateLate {
		t.Errorf("feeder = %q, want late (no poll for 10 min, every 2)", s.Feeder.State)
	}
	if s.Mailer.State != StateOffline {
		t.Errorf("mailer = %q, want offline", s.Mailer.State)
	}
}

func TestStatus_aMailerWhoseLoopIsStuck(t *testing.T) {
	mailer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"startedAt":"2026-10-16T08:00:00Z","lastCheckAt":"2026-10-16T08:01:00Z"}`))
	}))
	defer mailer.Close()

	s := getStatus(t, statusConfig(t, time.Time{}, mailerAt(mailer)), time.Now()).Services

	if s.Mailer.State != StateLate {
		t.Errorf("mailer = %q, want late: it answers, but hasn't looked for a mail in ages", s.Mailer.State)
	}
	if s.Feeder.State != StateUnknown {
		t.Errorf("feeder = %q, want unknown: no poll written yet", s.Feeder.State)
	}
}

func TestStatus_theFirmwareCache(t *testing.T) {
	cfg := statusConfig(t, time.Time{}, stoppedMailer())
	cache := `{"models":{"bitaxe":{"version":"v2.10.0","checkedAt":"` +
		time.Now().Add(-3*time.Hour).UTC().Format(time.RFC3339) + `"}}}`
	if err := os.MkdirAll(cfg.Storage.BitaxesDir(), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(cfg.Storage.BitaxesDir(), "firmware_cache.json"), []byte(cache), 0o644); err != nil {
		t.Fatal(err)
	}

	s := getStatus(t, cfg, time.Now()).Services

	if s.FirmwareCache.State != StateOK || s.FirmwareCache.Interval != "24h0m0s" || s.FirmwareCache.LastRunAt == nil {
		t.Errorf("firmwareCache = %+v, want checked 3h ago, within its 24h", s.FirmwareCache)
	}
}

func TestStatus_remotePushConfigured(t *testing.T) {
	cfg := statusConfig(t, time.Time{}, stoppedMailer())
	if getStatus(t, cfg, time.Now()).RemotePushConfigured {
		t.Error("remotePushConfigured = true with no push URL nor key, want false")
	}

	cfg.Remote.PushURL = "https://hashboard.example.com"
	if getStatus(t, cfg, time.Now()).RemotePushConfigured {
		t.Error("remotePushConfigured = true with a push URL but no key, want false")
	}

	cfg.Remote.APIKey = "key"
	if !getStatus(t, cfg, time.Now()).RemotePushConfigured {
		t.Error("remotePushConfigured = false with a push URL and key, want true")
	}
}
