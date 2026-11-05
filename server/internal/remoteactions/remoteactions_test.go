package remoteactions

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/audit"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/axeos"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/remoteactionmail"
)

func init() {
	axeos.RestartDelay = 0 // don't actually pause between settings update and restart in tests
}

const (
	minerKey = "aabbccddee01"
	apiKey   = "test-key"
)

const bitaxeOnPrimary = `{"stratumURL":"solo.pool","stratumPort":3333,"stratumUser":"acct.solo",` +
	`"fallbackStratumURL":"pps.pool","fallbackStratumPort":3333,"fallbackStratumUser":"acct.pps",` +
	`"useFallbackStratum":0,"isUsingFallbackStratum":0,"macAddr":"AA:BB:CC:DD:EE:01"}`

type fakeMiner struct {
	addr     string
	status   int
	restarts atomic.Int32
	mu       sync.Mutex
	patched  *config.BitaxeServerSettings
}

func newFakeMiner(t *testing.T) *fakeMiner {
	t.Helper()
	m := &fakeMiner{status: http.StatusOK}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/system/info":
			_, _ = w.Write([]byte(bitaxeOnPrimary))
		case "/api/system":
			m.mu.Lock()
			defer m.mu.Unlock()
			m.patched = &config.BitaxeServerSettings{}
			_ = json.NewDecoder(r.Body).Decode(m.patched)
		case "/api/system/restart":
			m.restarts.Add(1)
			w.WriteHeader(m.status)
		}
	}))
	t.Cleanup(server.Close)
	m.addr = strings.TrimPrefix(server.URL, "http://")
	return m
}

type fakeHashboard struct {
	url      string
	polls    atomic.Int32
	mu       sync.Mutex
	path     string
	auth     string
	status   int
	response string
}

func newFakeHashboard(t *testing.T, response string) *fakeHashboard {
	t.Helper()
	h := &fakeHashboard{status: http.StatusOK, response: response}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h.polls.Add(1)
		h.mu.Lock()
		defer h.mu.Unlock()
		h.path, h.auth = r.URL.Path, r.Header.Get("Authorization")
		w.WriteHeader(h.status)
		_, _ = w.Write([]byte(h.response))
	}))
	t.Cleanup(server.Close)
	h.url = server.URL
	return h
}

func pendingBody(t *testing.T, actions ...Action) string {
	t.Helper()
	body, err := json.Marshal(map[string]any{"actions": actions})
	if err != nil {
		t.Fatal(err)
	}
	return string(body)
}

func request(action string) Action {
	return Action{
		ID: strings.Repeat("a", 32), StorageKey: minerKey, Action: action, CreatedAt: time.Now(),
		RequestedBy: RequestedBy{IP: "203.0.113.7", UserAgent: "phone"},
	}
}

type setup struct {
	cfg      config.Config
	auditLog *audit.Log
	poller   *Poller
}

func newSetup(t *testing.T, h *fakeHashboard, m *fakeMiner, actions config.RemoteActionsConfig) *setup {
	t.Helper()
	s := &setup{
		auditLog: audit.NewLog(t.TempDir()),
		cfg: config.Config{
			Remote: config.RemoteConfig{PushURL: h.url + "/api/push", APIKey: apiKey, Actions: actions},
			Endpoints: config.EndpointConfig{
				Info: "api/system/info", System: "api/system", Restart: "api/system/restart", Timeout: time.Second,
			},
		},
	}
	if m != nil {
		s.cfg.Bitaxes = []config.Bitaxe{{Ip: m.addr, Mac: "aa:bb:cc:dd:ee:01", Model: "bitaxe", Hostname: "m1", Alias: "Salon", Enabled: true}}
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	s.poller = New(logger, func() config.Config { return s.cfg }, s.auditLog)
	return s
}

func (s *setup) entries(t *testing.T) []audit.Entry {
	t.Helper()
	entries, err := s.auditLog.ReadRange(time.Now().Add(-time.Hour), time.Now().Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	return entries
}

func TestPoll_asksNothingWhileNoActionIsAllowed(t *testing.T) {
	h := newFakeHashboard(t, pendingBody(t, request("restart")))
	m := newFakeMiner(t)

	// The mail toggle alone allows nothing.
	s := newSetup(t, h, m, config.RemoteActionsConfig{Mail: true})
	s.poller.Poll(context.Background())

	if got := h.polls.Load(); got != 0 {
		t.Errorf("hashboard asked %d times, want never", got)
	}
	if got := m.restarts.Load(); got != 0 {
		t.Errorf("miner restarted %d times, want never", got)
	}
}

func TestPoll_asksNothingWithoutHashboard(t *testing.T) {
	h := newFakeHashboard(t, pendingBody(t))
	s := newSetup(t, h, newFakeMiner(t), config.RemoteActionsConfig{Restart: true})
	s.cfg.Remote.APIKey = ""

	s.poller.Poll(context.Background())

	if got := h.polls.Load(); got != 0 {
		t.Errorf("hashboard asked %d times, want never", got)
	}
}

// The toggles are the kill switch: read again on every poll.
func TestPoll_stopsAsSoonAsTheToggleIsOff(t *testing.T) {
	h := newFakeHashboard(t, pendingBody(t))
	s := newSetup(t, h, newFakeMiner(t), config.RemoteActionsConfig{Restart: true})

	s.poller.Poll(context.Background())
	s.cfg.Remote.Actions.Restart = false
	s.poller.Poll(context.Background())

	if got := h.polls.Load(); got != 1 {
		t.Errorf("hashboard asked %d times, want once", got)
	}
}

func TestPoll_restartsAndAudits(t *testing.T) {
	h := newFakeHashboard(t, pendingBody(t, request("restart")))
	m := newFakeMiner(t)
	s := newSetup(t, h, m, config.RemoteActionsConfig{Restart: true})

	s.poller.Poll(context.Background())

	if h.path != "/api/actions/pending" || h.auth != "Bearer "+apiKey {
		t.Errorf("asked %q with %q", h.path, h.auth)
	}
	if got := m.restarts.Load(); got != 1 {
		t.Errorf("miner restarted %d times, want once", got)
	}
	entries := s.entries(t)
	if len(entries) != 1 {
		t.Fatalf("audit = %+v, want one entry", entries)
	}
	e := entries[0]
	if e.Type != "restart" || e.Source != audit.SourceSystem || e.Service != audit.ServiceRemote || e.Target != m.addr {
		t.Errorf("audit entry = %+v", e)
	}
	if e.IP != "203.0.113.7" || e.UserAgent != "phone" || e.Error != "" {
		t.Errorf("audit entry = %+v, want who asked and no error", e)
	}
}

func TestPoll_switchUsesThePoolsTheDeviceHolds(t *testing.T) {
	h := newFakeHashboard(t, pendingBody(t, request("switch_fallback")))
	m := newFakeMiner(t)
	s := newSetup(t, h, m, config.RemoteActionsConfig{SwitchPool: true})

	s.poller.Poll(context.Background())

	m.mu.Lock()
	defer m.mu.Unlock()
	if m.patched == nil || !m.patched.UseFallbackStratum {
		t.Fatalf("patched = %+v, want the fallback slot activated", m.patched)
	}
	if m.patched.Url != "solo.pool" || m.patched.FallbackURL != "pps.pool" {
		t.Errorf("patched = %+v, want the device's own pools", m.patched)
	}
	if got := m.restarts.Load(); got != 1 {
		t.Errorf("miner restarted %d times, want once", got)
	}
	if entries := s.entries(t); len(entries) != 1 || entries[0].Type != "switch_fallback" || entries[0].Error != "" {
		t.Errorf("audit = %+v", entries)
	}
}

func TestPoll_refusesAndAudits(t *testing.T) {
	tests := []struct {
		name    string
		actions config.RemoteActionsConfig
		action  Action
		disable bool
		wantErr string
	}{
		{"restart not allowed", config.RemoteActionsConfig{SwitchPool: true}, request("restart"), false, "action not allowed from the board"},
		{"switch not allowed", config.RemoteActionsConfig{Restart: true}, request("switch_primary"), false, "action not allowed from the board"},
		{"miner not ours", config.RemoteActionsConfig{Restart: true}, Action{ID: "x", StorageKey: "ffffffffffff", Action: "restart"}, false, "unknown or disabled miner"},
		{"disabled miner", config.RemoteActionsConfig{Restart: true}, request("restart"), true, "unknown or disabled miner"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := newFakeHashboard(t, pendingBody(t, tt.action))
			m := newFakeMiner(t)
			s := newSetup(t, h, m, tt.actions)
			s.cfg.Bitaxes[0].Enabled = !tt.disable

			s.poller.Poll(context.Background())

			if got := m.restarts.Load(); got != 0 {
				t.Errorf("miner restarted %d times, want never", got)
			}
			if m.patched != nil {
				t.Errorf("patched = %+v, want nothing", m.patched)
			}
			if entries := s.entries(t); len(entries) != 1 || entries[0].Error != tt.wantErr {
				t.Errorf("audit = %+v, want the error %q", entries, tt.wantErr)
			}
		})
	}
}

func TestPoll_unknownActionDoesNothing(t *testing.T) {
	h := newFakeHashboard(t, pendingBody(t, request("set_pool")))
	m := newFakeMiner(t)
	s := newSetup(t, h, m, config.RemoteActionsConfig{Restart: true, SwitchPool: true})

	s.poller.Poll(context.Background())

	if got := m.restarts.Load(); got != 0 || m.patched != nil {
		t.Errorf("restarts = %d, patched = %+v, want nothing", got, m.patched)
	}
}

// Nothing hashboard sends is an address: a storage key naming another host, or
// fields added to a request, reach nobody.
func TestPoll_neverCallsAnAddressFromHashboard(t *testing.T) {
	var hits atomic.Int32
	evil := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { hits.Add(1) }))
	defer evil.Close()
	addr := strings.TrimPrefix(evil.URL, "http://")

	body := `{"actions":[` +
		`{"id":"x","storageKey":"` + addr + `","action":"restart"},` +
		`{"id":"y","storageKey":"` + minerKey + `","action":"switch_primary","ip":"` + addr + `","url":"` + addr + `","stratumURL":"` + addr + `"}]}`
	h := newFakeHashboard(t, body)
	m := newFakeMiner(t)
	s := newSetup(t, h, m, config.RemoteActionsConfig{Restart: true, SwitchPool: true})

	s.poller.Poll(context.Background())

	if got := hits.Load(); got != 0 {
		t.Errorf("the address from hashboard got %d requests", got)
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.patched != nil && (m.patched.Url != "solo.pool" || m.patched.FallbackURL != "pps.pool") {
		t.Errorf("patched = %+v, want the device's own pools", m.patched)
	}
}

// A hashboard handing out requests in a loop can't keep a miner rebooting.
func TestPoll_oneActionPerMinerWhateverHashboardSends(t *testing.T) {
	second := request("restart")
	second.ID = strings.Repeat("b", 32)
	h := newFakeHashboard(t, pendingBody(t, request("restart"), second))
	m := newFakeMiner(t)
	s := newSetup(t, h, m, config.RemoteActionsConfig{Restart: true})

	s.poller.Poll(context.Background())
	s.poller.Poll(context.Background())

	if got := m.restarts.Load(); got != 1 {
		t.Errorf("miner restarted %d times, want once", got)
	}
	entries := s.entries(t)
	if len(entries) != 4 {
		t.Fatalf("audit = %+v, want all 4 requests recorded", entries)
	}
	refused := 0
	for _, e := range entries {
		if e.Error == "another action on this miner just ran" {
			refused++
		}
	}
	if refused != 3 {
		t.Errorf("refused = %d, want 3", refused)
	}
}

func TestPoll_theCooldownIsPerMinerAndEnds(t *testing.T) {
	h := newFakeHashboard(t, pendingBody(t, request("restart")))
	m := newFakeMiner(t)
	other := newFakeMiner(t)
	s := newSetup(t, h, m, config.RemoteActionsConfig{Restart: true})
	s.cfg.Bitaxes = append(s.cfg.Bitaxes, config.Bitaxe{Ip: other.addr, Mac: "aa:bb:cc:dd:ee:02", Model: "bitaxe", Enabled: true})

	s.poller.Poll(context.Background())

	otherRequest := request("restart")
	otherRequest.StorageKey = "aabbccddee02"
	h.mu.Lock()
	h.response = pendingBody(t, otherRequest)
	h.mu.Unlock()
	s.poller.Poll(context.Background())
	if got := other.restarts.Load(); got != 1 {
		t.Errorf("other miner restarted %d times, want once", got)
	}

	s.poller.mu.Lock()
	s.poller.lastAction[minerKey] = time.Now().Add(-actionCooldown)
	s.poller.mu.Unlock()
	h.mu.Lock()
	h.response = pendingBody(t, request("restart"))
	h.mu.Unlock()
	s.poller.Poll(context.Background())
	if got := m.restarts.Load(); got != 2 {
		t.Errorf("miner restarted %d times, want twice once the cooldown is over", got)
	}
}

func TestPoll_boundsWhatHashboardSaysAboutTheRequester(t *testing.T) {
	long := strings.Repeat("é", maxRequestedBy+50)
	a := request("restart")
	a.RequestedBy = RequestedBy{IP: long, UserAgent: long}
	h := newFakeHashboard(t, pendingBody(t, a))
	s := newSetup(t, h, newFakeMiner(t), config.RemoteActionsConfig{Restart: true})

	s.poller.Poll(context.Background())

	entries := s.entries(t)
	if len(entries) != 1 {
		t.Fatalf("audit = %+v", entries)
	}
	want := strings.Repeat("é", maxRequestedBy)
	if entries[0].IP != want || entries[0].UserAgent != want {
		t.Errorf("IP %d runes, User-Agent %d runes, want %d", len([]rune(entries[0].IP)), len([]rune(entries[0].UserAgent)), maxRequestedBy)
	}
}

func TestPoll_badResponsesDoNothing(t *testing.T) {
	action, err := json.Marshal(request("restart"))
	if err != nil {
		t.Fatal(err)
	}
	padded := func(size int) string {
		return `{"padding":"` + strings.Repeat("x", size) + `","actions":[` + string(action) + `]}`
	}
	tests := []struct {
		name         string
		status       int
		body         string
		wantRestarts int32
	}{
		{"a padded response within the bound (control)", http.StatusOK, padded(1024), 1},
		{"response past 1 Mio", http.StatusOK, padded(maxResponseBytes), 0},
		{"not JSON", http.StatusOK, `<html>`, 0},
		{"error status", http.StatusInternalServerError, padded(0), 0},
		{"unauthorized", http.StatusUnauthorized, padded(0), 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := newFakeHashboard(t, tt.body)
			h.status = tt.status
			m := newFakeMiner(t)
			s := newSetup(t, h, m, config.RemoteActionsConfig{Restart: true})

			s.poller.Poll(context.Background())

			if got := m.restarts.Load(); got != tt.wantRestarts {
				t.Errorf("miner restarted %d times, want %d", got, tt.wantRestarts)
			}
		})
	}
}

func TestPoll_aFailedRestartIsAudited(t *testing.T) {
	h := newFakeHashboard(t, pendingBody(t, request("restart")))
	m := newFakeMiner(t)
	m.status = http.StatusInternalServerError
	s := newSetup(t, h, m, config.RemoteActionsConfig{Restart: true})

	s.poller.Poll(context.Background())

	if entries := s.entries(t); len(entries) != 1 || entries[0].Error == "" {
		t.Errorf("audit = %+v, want the error recorded", entries)
	}
}

func fakeMailer(t *testing.T) (string, <-chan string) {
	t.Helper()
	bodies := make(chan string, 4)
	server := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/mailer/remote-action" {
			t.Errorf("mailer asked %q", r.URL.Path)
		}
		body, _ := io.ReadAll(r.Body)
		bodies <- string(body)
	}))
	t.Cleanup(server.Close)
	return server.URL[strings.LastIndex(server.URL, ":")+1:], bodies
}

func TestPoll_mailsTheOutcomeWhenAsked(t *testing.T) {
	tests := []struct {
		name       string
		actions    config.RemoteActionsConfig
		minerFails bool
		wantStatus string
	}{
		{"done", config.RemoteActionsConfig{Restart: true, Mail: true}, false, statusDone},
		{"failed", config.RemoteActionsConfig{Restart: true, Mail: true}, true, statusFailed},
		{"rejected", config.RemoteActionsConfig{SwitchPool: true, Mail: true}, false, statusRejected},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := newFakeHashboard(t, pendingBody(t, request("restart")))
			m := newFakeMiner(t)
			if tt.minerFails {
				m.status = http.StatusInternalServerError
			}
			s := newSetup(t, h, m, tt.actions)
			port, bodies := fakeMailer(t)
			s.cfg.Mailer.Port = port

			s.poller.Poll(context.Background())

			select {
			case body := <-bodies:
				var event remoteactionmail.Event
				if err := json.Unmarshal([]byte(body), &event); err != nil {
					t.Fatal(err)
				}
				if event.Action != "restart" || event.Miner != "Salon" || event.Status != tt.wantStatus {
					t.Errorf("event = %+v, want the miner's name and %q", event, tt.wantStatus)
				}
				if strings.Contains(body, m.addr) || strings.Contains(body, "203.0.113.7") {
					t.Errorf("mail event = %s, want no address in it", body)
				}
			case <-time.After(5 * time.Second):
				t.Fatal("the mailer wasn't called")
			}
		})
	}
}

func TestPoll_noMailWhenOff(t *testing.T) {
	h := newFakeHashboard(t, pendingBody(t, request("restart")))
	s := newSetup(t, h, newFakeMiner(t), config.RemoteActionsConfig{Restart: true})
	port, bodies := fakeMailer(t)
	s.cfg.Mailer.Port = port

	s.poller.Poll(context.Background())

	select {
	case body := <-bodies:
		t.Errorf("mail sent: %s", body)
	case <-time.After(100 * time.Millisecond):
	}
}

func TestIsAction(t *testing.T) {
	for action, want := range map[string]bool{
		"restart": true, "switch_primary": true, "switch_fallback": true,
		"": false, "set_pool": false, "RESTART": false, "restart ": false,
	} {
		if got := IsAction(action); got != want {
			t.Errorf("IsAction(%q) = %v, want %v", action, got, want)
		}
	}
}

func TestAPIURL(t *testing.T) {
	for pushURL, want := range map[string]string{
		"https://hashboard.live/api/push":  "https://hashboard.live/api/actions/pending",
		"https://hashboard.live/api/push/": "https://hashboard.live/api/actions/pending",
	} {
		if got := apiURL(pushURL, "/actions/pending"); got != want {
			t.Errorf("apiURL(%q) = %q, want %q", pushURL, got, want)
		}
	}
}
