package handler

import (
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
