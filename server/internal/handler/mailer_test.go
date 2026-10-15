package handler

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
)

// mailerAt is the config reaching the mailer s stands in for.
func mailerAt(s *httptest.Server) config.Config {
	return config.Config{Mailer: config.MailerConfig{Port: s.URL[strings.LastIndex(s.URL, ":")+1:]}}
}

// stoppedMailer is the config of a mailer that isn't running.
func stoppedMailer() config.Config {
	s := httptest.NewServer(http.NotFoundHandler())
	cfg := mailerAt(s)
	s.Close()
	return cfg
}

func getMailerStatus(t *testing.T, cfg config.Config) MailerStatusResponse {
	t.Helper()
	w := httptest.NewRecorder()
	MailerStatus(cfg, w, httptest.NewRequest(http.MethodGet, "/api/mailer/status", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 either way", w.Code)
	}
	var resp MailerStatusResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	return resp
}

func TestMailerStatus_online(t *testing.T) {
	mailer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/status" {
			http.NotFound(w, r)
			return
		}
		_, _ = w.Write([]byte(`{"startedAt":"2026-10-16T08:00:00Z","lastCheckAt":"2026-10-16T09:30:00Z"}`))
	}))
	defer mailer.Close()

	resp := getMailerStatus(t, mailerAt(mailer))

	if !resp.Online || resp.StartedAt == nil || resp.LastCheckAt == nil {
		t.Errorf("status = %+v, want online with its start and last check", resp)
	}
}

func TestMailerStatus_offline(t *testing.T) {
	if resp := getMailerStatus(t, stoppedMailer()); resp.Online {
		t.Errorf("status = %+v, want offline", resp)
	}
}

func TestSendTestMail_relaysTheMailersAnswer(t *testing.T) {
	var gotBody string
	mailer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/api/mail/test" {
			http.NotFound(w, r)
			return
		}
		b, _ := io.ReadAll(r.Body)
		gotBody = string(b)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadGateway)
		_, _ = w.Write([]byte(`{"error":"Bad Gateway","message":"535 bad credentials","code":502}`))
	}))
	defer mailer.Close()

	w := httptest.NewRecorder()
	SendTestMail(mailerAt(mailer), w, httptest.NewRequest(http.MethodPost, "/api/config/mail/test", strings.NewReader(`{"lang":"fr"}`)))

	if gotBody != `{"lang":"fr"}` {
		t.Errorf("mailer got %q, want the request as sent", gotBody)
	}
	if w.Code != http.StatusBadGateway || !strings.Contains(w.Body.String(), "535 bad credentials") {
		t.Errorf("status = %d, body = %s, want the mailer's own answer", w.Code, w.Body.String())
	}
}

func TestSendTestMail_mailerNotRunning(t *testing.T) {
	w := httptest.NewRecorder()
	SendTestMail(stoppedMailer(), w, httptest.NewRequest(http.MethodPost, "/api/config/mail/test", nil))

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("status = %d, want 503", w.Code)
	}
}
