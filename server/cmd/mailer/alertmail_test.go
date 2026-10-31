package main

import (
	"encoding/json"
	"io"
	"mime"
	"net/http"
	"net/http/httptest"
	"net/mail"
	"strings"
	"testing"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/alertmail"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/alerts"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/audit"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/mail/mailtest"
)

// subjectOf decodes a received mail's subject, and says whether it carries
// a text part and an HTML part with the logo.
func subjectOf(t *testing.T, got mailtest.Received) (subject string, htmlWithLogo bool) {
	t.Helper()
	msg, err := mail.ReadMessage(strings.NewReader(got.Data))
	if err != nil {
		t.Fatal(err)
	}
	subject, _ = new(mime.WordDecoder).DecodeHeader(msg.Header.Get("Subject"))
	body, _ := io.ReadAll(msg.Body)
	raw := strings.ToLower(string(body))
	return subject, strings.Contains(raw, "text/plain") &&
		strings.Contains(raw, "text/html") &&
		strings.Contains(raw, "content-id: <logo>")
}

func post(m *Mailer, path, body string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	m.Handler().ServeHTTP(w, httptest.NewRequest(http.MethodPost, path, strings.NewReader(body)))
	return w
}

func alertsBody(t *testing.T, events ...alerts.Event) string {
	t.Helper()
	data, err := json.Marshal(alertsMailRequest{Alerts: events})
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

func mailerWithServer(t *testing.T, server *mailtest.Server, to string) *Mailer {
	return newTestMailer(t, config.NotificationsConfig{
		Language: "en",
		Mail: config.MailConfig{
			SMTP: config.SMTPConfig{Host: server.Host, Port: server.Port, Security: config.SMTPNone, From: "axeos@example.com"},
			To:   []string{to},
		},
	})
}

func TestSendAlertsMail(t *testing.T) {
	server := mailtest.NewServer(t)
	m := mailerWithServer(t, server, "me@example.com")
	poll := time.Date(2026, 10, 30, 8, 53, 0, 0, time.UTC)

	w := post(m, "/api/mailer/alerts", alertsBody(t,
		alerts.Event{Timestamp: poll, Mac: "bb", IP: "10.0.0.2", Hostname: "garage", Type: alerts.TypeOffline, State: alerts.Raised},
		alerts.Event{Timestamp: poll, Mac: "aa", IP: "10.0.0.1", Hostname: "office", Type: alerts.TypeTempHigh, State: alerts.Raised, Value: 64, Threshold: 62},
	))

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	if subject, html := subjectOf(t, server.Next(t)); subject != "2 new alerts — AxeOS Dashboard" || !html {
		t.Errorf("subject = %q (html with logo: %v), want both alerts in one HTML mail", subject, html)
	}
	if state := alertmail.Load(m.config.Storage.MailDir()); state.LastSentAt.IsZero() || state.LastError != "" {
		t.Errorf("state = %+v, want the mail recorded as sent", state)
	}
	// A mail sent isn't audited.
	if entries, _ := m.auditLog.ReadRange(time.Now().Add(-time.Hour), time.Now().Add(time.Hour)); len(entries) != 0 {
		t.Errorf("audit = %+v, want nothing", entries)
	}
}

func TestSendAlertsMail_needsAlertsAndAServer(t *testing.T) {
	event := alerts.Event{Timestamp: time.Now(), Mac: "aa", Type: alerts.TypeOffline, State: alerts.Raised}

	if w := post(newTestMailer(t, config.NotificationsConfig{}), "/api/mailer/alerts", alertsBody(t, event)); w.Code != http.StatusBadRequest {
		t.Errorf("no server: status = %d, want 400", w.Code)
	}
	m := mailerWithServer(t, mailtest.NewServer(t), "me@example.com")
	for _, body := range []string{``, `{}`, `{"alerts":[]}`} {
		if w := post(m, "/api/mailer/alerts", body); w.Code != http.StatusBadRequest {
			t.Errorf("body %q: status = %d, want 400", body, w.Code)
		}
	}
}

func TestSendAlertsMail_aFailureIsRecorded(t *testing.T) {
	server := mailtest.NewServer(t, "nobody@example.com")
	m := mailerWithServer(t, server, "nobody@example.com")
	poll := time.Date(2026, 10, 30, 8, 53, 0, 0, time.UTC)

	w := post(m, "/api/mailer/alerts", alertsBody(t,
		alerts.Event{Timestamp: poll, Mac: "aa", IP: "10.0.0.1", Type: alerts.TypeOffline, State: alerts.Raised},
	))

	if w.Code != http.StatusBadGateway {
		t.Errorf("status = %d, want 502", w.Code)
	}
	if state := alertmail.Load(m.config.Storage.MailDir()); state.LastError == "" {
		t.Errorf("state = %+v, want the error kept", state)
	}
	entries, err := m.auditLog.ReadRange(time.Now().Add(-time.Hour), time.Now().Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 || entries[0].Type != audit.TypeAlertMail || entries[0].Error == "" ||
		len(entries[0].Changes) != 1 || entries[0].Changes[0].After != "2026-10-30T08:53:00Z" {
		t.Errorf("audit = %+v, want the failure with its poll", entries)
	}
}

func TestSendTestMail_alertExample(t *testing.T) {
	server := mailtest.NewServer(t)
	m := mailerWithServer(t, server, "me@example.com")

	w := post(m, "/api/mailer/test", `{"lang":"fr","kind":"alert"}`)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	if subject, html := subjectOf(t, server.Next(t)); subject != "3 nouvelles alertes — AxeOS Dashboard" || !html {
		t.Errorf("subject = %q (html with logo: %v), want the French example", subject, html)
	}
}
