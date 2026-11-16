package main

import (
	"context"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/alertmail"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/alerts"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/audit"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/auditreport"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/mail/mailtest"
)

// A dev instance leaves the scheduled and alerts mails to the real install
// -- each would otherwise arrive twice. The same calls without an env, in
// mailer_test.go and alertmail_test.go, do send.

func TestRunAuditReport_notInDev(t *testing.T) {
	server := mailtest.NewServer(t)
	m := newTestMailer(t, dailyReport(fakeSMTP(server), "me@example.com"))
	m.config.Global.Env = "dev"
	if err := m.auditLog.Record(audit.Entry{
		Timestamp: time.Date(2026, 10, 15, 8, 0, 0, 0, time.UTC),
		Source:    audit.SourceAPI, Type: audit.TypeRestart, Target: "192.168.1.65", Status: 204,
	}); err != nil {
		t.Fatal(err)
	}

	m.runAuditReport(context.Background(), reportTime)

	if n := server.Pending(); n != 0 {
		t.Errorf("%d mail(s) sent, want none in dev", n)
	}
	if state := auditreport.Load(m.config.Storage.MailDir()); state != (auditreport.State{}) {
		t.Errorf("state = %+v, want nothing recorded", state)
	}
	if entries := reportEntries(t, m); len(entries) != 0 {
		t.Errorf("audit = %+v, want no report entry", entries)
	}
}

func TestSendAlertsMail_notInDev(t *testing.T) {
	server := mailtest.NewServer(t)
	m := mailerWithServer(t, server, "me@example.com")
	m.config.Global.Env = "dev"

	w := post(m, "/api/mailer/alerts", alertsBody(t, alerts.Event{
		Timestamp: time.Date(2026, 10, 30, 8, 53, 0, 0, time.UTC),
		Mac:       "aa", IP: "10.0.0.1", Hostname: "office", Type: alerts.TypeOffline, State: alerts.Raised,
	}))

	// OK all the same: nothing for the feeder to log as an error.
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	if n := server.Pending(); n != 0 {
		t.Errorf("%d mail(s) sent, want none in dev", n)
	}
	if state := alertmail.Load(m.config.Storage.MailDir()); !state.LastSentAt.IsZero() || state.LastError != "" {
		t.Errorf("state = %+v, want nothing recorded", state)
	}
}

// Every mail's subject names the instance that sent it -- the test mail
// still goes out in dev.
func TestSubject_startsWithTheEnv(t *testing.T) {
	t.Run("the test mail, in dev", func(t *testing.T) {
		server := mailtest.NewServer(t)
		m := mailerWithServer(t, server, "me@example.com")
		m.config.Global.Env = "dev"

		if w := postTestMail(m, "en"); w.Code != http.StatusOK {
			t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
		}
		if subject, _ := subjectOf(t, server.Next(t)); subject != "[dev] AxeOS · D#hashboard — test mail" {
			t.Errorf("subject = %q", subject)
		}
	})

	t.Run("the alerts mail, in prod", func(t *testing.T) {
		server := mailtest.NewServer(t)
		m := mailerWithServer(t, server, "me@example.com")
		m.config.Global.Env = "prod"

		w := post(m, "/api/mailer/alerts", alertsBody(t, alerts.Event{
			Timestamp: time.Date(2026, 10, 30, 8, 53, 0, 0, time.UTC),
			Mac:       "aa", IP: "10.0.0.1", Hostname: "office", Type: alerts.TypeOffline, State: alerts.Raised,
		}))
		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
		}
		if subject, _ := subjectOf(t, server.Next(t)); subject != "[prod] office: Offline — AxeOS · D#hashboard" {
			t.Errorf("subject = %q", subject)
		}
	})

	t.Run("the audit report, in prod", func(t *testing.T) {
		server := mailtest.NewServer(t)
		m := newTestMailer(t, dailyReport(fakeSMTP(server), "me@example.com"))
		m.config.Global.Env = "prod"
		if err := m.auditLog.Record(audit.Entry{
			Timestamp: time.Date(2026, 10, 15, 8, 0, 0, 0, time.UTC),
			Source:    audit.SourceAPI, Type: audit.TypeRestart, Target: "192.168.1.65", Status: 204,
		}); err != nil {
			t.Fatal(err)
		}

		m.runAuditReport(context.Background(), reportTime)

		if subject, _ := subjectOf(t, server.Next(t)); !strings.HasPrefix(subject, "[prod] AxeOS · D#hashboard — ") {
			t.Errorf("subject = %q", subject)
		}
	})
}
