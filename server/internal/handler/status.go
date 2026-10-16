package handler

import (
	"encoding/json"
	"net/http"
	"path/filepath"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/firmware"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/healtcheck"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/version"
)

// A service's state, worked out here once so every view -- this
// dashboard's, a board's later -- shows the same.
const (
	StateOK      = "ok"
	StateLate    = "late"    // nothing within twice its interval: stuck, or stopped
	StateOffline = "offline" // didn't answer at all
	StateUnknown = "unknown" // no run to go by yet
)

// mailerCheckInterval is how often the mailer looks for a mail to send.
const mailerCheckInterval = time.Minute

var mailerStatusClient = &http.Client{Timeout: 3 * time.Second}

type ServiceStatus struct {
	State     string     `json:"state"`
	Interval  string     `json:"interval,omitempty"`
	LastRunAt *time.Time `json:"lastRunAt,omitempty"`
	StartedAt *time.Time `json:"startedAt,omitempty"`
	Version   string     `json:"version,omitempty"`
}

type ServicesStatus struct {
	DashboardAPI ServiceStatus `json:"dashboardApi"`
	Feeder       ServiceStatus `json:"feeder"`
	HealthCheck  ServiceStatus `json:"healthCheck"`
	Mailer       ServiceStatus `json:"mailer"`
	// FirmwareCache is the feeder's check for new firmware releases, once
	// per its TTL.
	FirmwareCache ServiceStatus `json:"firmwareCache"`
}

type StatusResponse struct {
	CheckedAt time.Time      `json:"checkedAt"`
	Services  ServicesStatus `json:"services"`
}

// Status is how every process of this dashboard is doing, in one answer.
//
// @Summary Services status
// @Description How each process is doing -- dashboard-api, the feeder (its last poll), the health check, the mailer, the firmware cache: ok, late (nothing within twice its interval), offline (didn't answer) or unknown (no run yet).
// @Tags Status
// @Produce json
// @Success 200 {object} handler.StatusResponse
// @Router /api/status [get]
func Status(cfg config.Config, watcher *healtcheck.Watcher, startedAt time.Time, w http.ResponseWriter, r *http.Request) {
	now := time.Now()
	root := getDataRoot(cfg.Storage)

	// The feeder's last poll and the health check's last check, across the
	// enabled miners: the most recent of each.
	var lastPoll, lastCheck time.Time
	for _, miner := range cfg.GetMiners() {
		if key := miner.StorageKey(); key != "" {
			if raw, err := decodeLatestJSON(filepath.Join(root, key, "latest.json")); err == nil {
				if ts, err := time.Parse(time.RFC3339, raw.Timestamp); err == nil && ts.After(lastPoll) {
					lastPoll = ts
				}
			}
		}
		if watcher != nil {
			if s, ok := watcher.GetStatus(miner.Ip); ok && s.CheckedAt.After(lastCheck) {
				lastCheck = s.CheckedAt
			}
		}
	}

	resp := StatusResponse{
		CheckedAt: now.UTC(),
		Services: ServicesStatus{
			DashboardAPI: ServiceStatus{
				State:     StateOK,
				StartedAt: utcPtr(startedAt),
				Version:   version.GitSHA,
			},
			Feeder:        runStatus(now, lastPoll, cfg.Feeder.Interval),
			HealthCheck:   runStatus(now, lastCheck, cfg.HealthCheck.Interval),
			Mailer:        mailerStatus(r, cfg, now),
			FirmwareCache: runStatus(now, firmware.LatestCheck(firmware.LoadCache(root)), cfg.Firmware.CacheTTL),
		},
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

// runStatus is a loop's state from its last run: late once nothing ran
// within twice its interval (a generous margin -- loops aren't perfectly on
// the beat, and this is meant to catch one that's stuck).
func runStatus(now, last time.Time, interval time.Duration) ServiceStatus {
	s := ServiceStatus{State: StateOK, LastRunAt: utcPtr(last)}
	if interval > 0 {
		s.Interval = interval.String()
	}
	switch {
	case last.IsZero():
		s.State = StateUnknown
	case interval > 0 && now.Sub(last) > 2*interval+5*time.Second:
		s.State = StateLate
	}
	return s
}

// mailerStatus asks the mailer, on the loopback (see config.MailerConfig).
func mailerStatus(r *http.Request, cfg config.Config, now time.Time) ServiceStatus {
	offline := ServiceStatus{State: StateOffline, Interval: mailerCheckInterval.String()}
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, "http://"+cfg.Mailer.Address()+"/api/mailer/status", nil)
	if err != nil {
		return offline
	}
	res, err := mailerStatusClient.Do(req)
	if err != nil {
		return offline
	}
	defer func() { _ = res.Body.Close() }()
	var answer struct {
		StartedAt   time.Time `json:"startedAt"`
		LastCheckAt time.Time `json:"lastCheckAt"`
	}
	if res.StatusCode != http.StatusOK || json.NewDecoder(res.Body).Decode(&answer) != nil {
		return offline
	}
	s := runStatus(now, answer.LastCheckAt, mailerCheckInterval)
	s.StartedAt = utcPtr(answer.StartedAt)
	return s
}

// utcPtr is t in UTC, nil when it's zero -- left out of the JSON.
func utcPtr(t time.Time) *time.Time {
	if t.IsZero() {
		return nil
	}
	u := t.UTC()
	return &u
}
