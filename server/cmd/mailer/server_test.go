package main

import (
	"encoding/json"
	"io"
	"log/slog"
	"mime"
	"net/http"
	"net/http/httptest"
	"net/mail"
	"strings"
	"testing"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/mail/mailtest"
)

func newTestMailer(t *testing.T, notifications config.NotificationsConfig) *Mailer {
	t.Helper()
	cfg := config.Config{
		Storage:       config.StorageConfig{DataDir: t.TempDir()},
		Notifications: notifications,
	}
	return NewMailer(slog.New(slog.NewTextHandler(io.Discard, nil)), cfg)
}

func postTestMail(m *Mailer, lang string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	body := strings.NewReader(`{"lang":"` + lang + `"}`)
	m.Handler().ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/mailer/test", body))
	return w
}

func TestSendTestMail_needsAServerAndARecipient(t *testing.T) {
	smtp := config.SMTPConfig{Host: "smtp.example.com", Port: 587, Security: config.SMTPStartTLS, From: "axeos@example.com"}

	if w := postTestMail(newTestMailer(t, config.NotificationsConfig{}), "en"); w.Code != http.StatusBadRequest {
		t.Errorf("no server: status = %d, want 400", w.Code)
	}
	noRecipient := config.NotificationsConfig{Mail: config.MailConfig{SMTP: smtp}}
	if w := postTestMail(newTestMailer(t, noRecipient), "en"); w.Code != http.StatusBadRequest {
		t.Errorf("no recipient: status = %d, want 400", w.Code)
	}
}

func TestSendTestMail_sendsToEveryRecipientInTheUILanguage(t *testing.T) {
	server := mailtest.NewServer(t)
	m := newTestMailer(t, config.NotificationsConfig{Mail: config.MailConfig{
		SMTP: config.SMTPConfig{Host: server.Host, Port: server.Port, Security: config.SMTPNone, From: "axeos@example.com"},
		To:   []string{"me@example.com", "you@example.com"},
	}})

	w := postTestMail(m, "fr")

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	var resp testMailResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil || len(resp.SentTo) != 2 {
		t.Errorf("sentTo = %v (err %v), want both recipients", resp.SentTo, err)
	}
	got := server.Next(t)
	msg, err := mail.ReadMessage(strings.NewReader(got.Data))
	if err != nil {
		t.Fatal(err)
	}
	subject, _ := new(mime.WordDecoder).DecodeHeader(msg.Header.Get("Subject"))
	if subject != "AxeOS Dashboard — mail de test" {
		t.Errorf("subject = %q, want the French one", subject)
	}
}

func TestSendTestMail_reportsTheSMTPError(t *testing.T) {
	server := mailtest.NewServer(t, "nobody@example.com")
	m := newTestMailer(t, config.NotificationsConfig{Mail: config.MailConfig{
		SMTP: config.SMTPConfig{Host: server.Host, Port: server.Port, Security: config.SMTPNone, From: "axeos@example.com"},
		To:   []string{"nobody@example.com"},
	}})

	w := postTestMail(m, "en")

	var resp struct {
		Message string `json:"message"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	if w.Code != http.StatusBadGateway || !strings.Contains(resp.Message, "nobody@example.com") {
		t.Errorf("status = %d, body = %s, want a 502 whose message names the refused recipient", w.Code, w.Body.String())
	}
}

func TestStatus_saysWhenTheMailerLastLookedForAMail(t *testing.T) {
	m := newTestMailer(t, config.NotificationsConfig{})
	checkedAt := time.Date(2026, 10, 16, 9, 30, 0, 0, time.UTC)
	m.checked(checkedAt)

	w := httptest.NewRecorder()
	m.Handler().ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/mailer/status", nil))

	var resp statusResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp.StartedAt.IsZero() || resp.LastCheckAt == nil || !resp.LastCheckAt.Equal(checkedAt) {
		t.Errorf("status = %+v, want its start and last check", resp)
	}
}
