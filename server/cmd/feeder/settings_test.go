package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
)

type settingsHashboard struct {
	url    string
	mu     sync.Mutex
	status int
	bodies []string
	auths  []string
}

func newSettingsHashboard(t *testing.T) *settingsHashboard {
	t.Helper()
	h := &settingsHashboard{status: http.StatusNoContent}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/settings" {
			t.Errorf("unexpected push to %q", r.URL.Path)
		}
		body, _ := io.ReadAll(r.Body)
		h.mu.Lock()
		defer h.mu.Unlock()
		h.bodies = append(h.bodies, string(body))
		h.auths = append(h.auths, r.Header.Get("Authorization"))
		w.WriteHeader(h.status)
	}))
	t.Cleanup(server.Close)
	h.url = server.URL
	return h
}

func (h *settingsHashboard) pushes() []string {
	h.mu.Lock()
	defer h.mu.Unlock()
	return append([]string{}, h.bodies...)
}

func (h *settingsHashboard) answer(status int) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.status = status
}

func settingsFeeder(h *settingsHashboard, actions config.RemoteActionsConfig) *Feeder {
	return NewFeeder(testLogger(), config.Config{
		Remote: config.RemoteConfig{PushURL: h.url, APIKey: "test-key", Actions: actions},
	})
}

func pushSettingsNow(f *Feeder) {
	f.pushSettings()
	f.WaitForPushes()
}

func TestPushSettings_sendsWhatIsAllowedAndThePollInterval(t *testing.T) {
	h := newSettingsHashboard(t)

	pushSettingsNow(settingsFeeder(h, config.RemoteActionsConfig{Restart: true, SwitchPool: true, Mail: true}))

	pushes := h.pushes()
	want := `{"remote":{"actions":["restart","switch_primary","switch_fallback"],"pollIntervalSeconds":60}}`
	if len(pushes) != 1 || pushes[0] != want {
		t.Errorf("pushes = %v, want [%s]", pushes, want)
	}
	if h.auths[0] != "Bearer test-key" {
		t.Errorf("auth = %q", h.auths[0])
	}
}

// An empty list is what turns them off on the board: never null, never skipped.
func TestPushSettings_sendsAnEmptyListWhenEverythingIsOff(t *testing.T) {
	h := newSettingsHashboard(t)

	pushSettingsNow(settingsFeeder(h, config.RemoteActionsConfig{Mail: true}))

	pushes := h.pushes()
	want := `{"remote":{"actions":[],"pollIntervalSeconds":60}}`
	if len(pushes) != 1 || pushes[0] != want {
		t.Errorf("pushes = %v, want [%s]", pushes, want)
	}
}

func TestPushSettings_onlyWhenTheyChange(t *testing.T) {
	h := newSettingsHashboard(t)
	f := settingsFeeder(h, config.RemoteActionsConfig{Restart: true})

	pushSettingsNow(f)
	pushSettingsNow(f)
	if got := len(h.pushes()); got != 1 {
		t.Fatalf("pushes = %d, want 1 while nothing changed", got)
	}

	f.config.Remote.Actions.Restart = false
	pushSettingsNow(f)
	pushes := h.pushes()
	if len(pushes) != 2 || pushes[1] != `{"remote":{"actions":[],"pollIntervalSeconds":60}}` {
		t.Errorf("pushes = %v, want the toggle's change sent", pushes)
	}
}

func TestPushSettings_triedAgainAfterAFailure(t *testing.T) {
	h := newSettingsHashboard(t)
	h.answer(http.StatusNotFound)
	f := settingsFeeder(h, config.RemoteActionsConfig{Restart: true})

	pushSettingsNow(f)
	h.answer(http.StatusNoContent)
	pushSettingsNow(f)
	pushSettingsNow(f)

	if got := len(h.pushes()); got != 2 {
		t.Errorf("pushes = %d, want the failed one and its retry only", got)
	}
}

func TestPushSettings_sentAgainToAnotherBoard(t *testing.T) {
	h := newSettingsHashboard(t)
	f := settingsFeeder(h, config.RemoteActionsConfig{Restart: true})

	pushSettingsNow(f)
	f.config.Remote.APIKey = "another-key"
	pushSettingsNow(f)

	if got := len(h.pushes()); got != 2 {
		t.Fatalf("pushes = %d, want 2", got)
	}
	if h.auths[1] != "Bearer another-key" {
		t.Errorf("auth = %q", h.auths[1])
	}
}
