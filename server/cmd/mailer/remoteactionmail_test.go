package main

import (
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/mail/mailtest"
)

const remoteActionBody = `{"action":"restart","miner":"Salon","status":"done","at":"2026-11-05T08:00:00Z"}`

func TestSendRemoteActionMail(t *testing.T) {
	server := mailtest.NewServer(t)
	m := mailerWithServer(t, server, "me@example.com")

	w := post(m, "/api/mailer/remote-action", remoteActionBody)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	subject, html := subjectOf(t, server.Next(t))
	if !strings.HasPrefix(subject, "Salon: ") || !strings.Contains(subject, "from the board") || !html {
		t.Errorf("subject = %q (html with logo: %v), want the miner's name in an HTML mail", subject, html)
	}
	// A mail sent isn't audited: the action itself already is.
	if entries, _ := m.auditLog.ReadRange(time.Now().Add(-time.Hour), time.Now().Add(time.Hour)); len(entries) != 0 {
		t.Errorf("audit = %+v, want nothing", entries)
	}
}

func TestSendRemoteActionMail_needsAnActionAndAServer(t *testing.T) {
	if w := post(newTestMailer(t, config.NotificationsConfig{}), "/api/mailer/remote-action", remoteActionBody); w.Code != http.StatusBadRequest {
		t.Errorf("no SMTP server: status = %d, want 400", w.Code)
	}
	m := mailerWithServer(t, mailtest.NewServer(t), "me@example.com")
	for _, body := range []string{`{}`, `not json`} {
		if w := post(m, "/api/mailer/remote-action", body); w.Code != http.StatusBadRequest {
			t.Errorf("body %q: status = %d, want 400", body, w.Code)
		}
	}
}

func TestSendRemoteActionMail_aFailureIsReported(t *testing.T) {
	m := mailerWithServer(t, mailtest.NewServer(t, "nobody@example.com"), "nobody@example.com")

	if w := post(m, "/api/mailer/remote-action", remoteActionBody); w.Code != http.StatusBadGateway {
		t.Errorf("status = %d, want 502", w.Code)
	}
}
