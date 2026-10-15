package main

import (
	"context"
	"mime"
	"net/mail"
	"strings"
	"testing"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/audit"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/auditreport"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/mail/mailtest"
)

// 01:00 UTC: the 15th's daily report is due.
var reportTime = time.Date(2026, 10, 16, 1, 0, 0, 0, time.UTC)

func dailyReport(smtp config.SMTPConfig, to ...string) config.NotificationsConfig {
	return config.NotificationsConfig{
		Mail:        config.MailConfig{SMTP: smtp, To: to},
		AuditReport: config.AuditReportConfig{Enabled: true, Frequency: config.ReportDaily, SkipIfEmpty: true},
	}
}

func fakeSMTP(server *mailtest.Server) config.SMTPConfig {
	return config.SMTPConfig{Host: server.Host, Port: server.Port, Security: config.SMTPNone, From: "axeos@example.com"}
}

// reportEntries is what the mailer recorded about its own reports.
func reportEntries(t *testing.T, m *Mailer) []audit.Entry {
	t.Helper()
	all, err := m.auditLog.ReadRange(reportTime.AddDate(0, 0, -2), reportTime.AddDate(0, 0, 1))
	if err != nil {
		t.Fatal(err)
	}
	var out []audit.Entry
	for _, e := range all {
		if e.Type == audit.TypeAuditReport {
			out = append(out, e)
		}
	}
	return out
}

func TestRunAuditReport_sendsTheDayAndRecordsIt(t *testing.T) {
	server := mailtest.NewServer(t)
	m := newTestMailer(t, dailyReport(fakeSMTP(server), "me@example.com"))
	m.config.Bitaxes = []config.Bitaxe{{Ip: "192.168.1.65", Hostname: "bitaxe-1", Alias: "salon"}}
	if err := m.auditLog.Record(audit.Entry{
		Timestamp: time.Date(2026, 10, 15, 8, 0, 0, 0, time.UTC),
		Source:    audit.SourceAPI, IP: "192.168.1.10", Type: audit.TypeRestart, Target: "192.168.1.65", Status: 204,
	}); err != nil {
		t.Fatal(err)
	}

	m.runAuditReport(context.Background(), reportTime)

	got := server.Next(t)
	msg, err := mail.ReadMessage(strings.NewReader(got.Data))
	if err != nil {
		t.Fatal(err)
	}
	subject, _ := new(mime.WordDecoder).DecodeHeader(msg.Header.Get("Subject"))
	if !strings.Contains(subject, "October 15, 2026") {
		t.Errorf("subject = %q, want the 15th", subject)
	}
	if !strings.Contains(got.Data, "salon (192.168.1.65)") {
		t.Errorf("the miner isn't named after miners.yml:\n%s", got.Data)
	}

	state := auditreport.Load(m.config.Storage.MailDir())
	if state.LastFrom != "2026-10-15" || state.LastTo != "2026-10-16" || state.LastError != "" || !state.LastSentAt.Equal(reportTime) {
		t.Errorf("state = %+v, want the 15th sent", state)
	}
	entries := reportEntries(t, m)
	if len(entries) != 1 || entries[0].Service != audit.ServiceMailer || entries[0].Error != "" {
		t.Fatalf("audit = %+v, want one report entry by the mailer", entries)
	}
	changes := map[string]string{}
	for _, c := range entries[0].Changes {
		changes[c.Field] = c.After
	}
	if changes["reportPeriod"] != "2026-10-15" || changes["sentTo"] != "me@example.com" {
		t.Errorf("changes = %v, want the period and its recipient", changes)
	}

	// Sent: not again the same day.
	m.runAuditReport(context.Background(), reportTime.Add(time.Hour))
	if n := len(reportEntries(t, m)); n != 1 {
		t.Errorf("got %d report entries, want the report sent once", n)
	}
}

func TestRunAuditReport_recordsAFailure(t *testing.T) {
	server := mailtest.NewServer(t, "nobody@example.com")
	n := dailyReport(fakeSMTP(server), "nobody@example.com")
	n.AuditReport.SkipIfEmpty = false
	m := newTestMailer(t, n)

	m.runAuditReport(context.Background(), reportTime)

	state := auditreport.Load(m.config.Storage.MailDir())
	if state.LastError == "" || state.LastTo != "" || !state.LastAttemptAt.Equal(reportTime) {
		t.Errorf("state = %+v, want the failure recorded and the period still to send", state)
	}
	entries := reportEntries(t, m)
	if len(entries) != 1 || !strings.Contains(entries[0].Error, "nobody@example.com") {
		t.Errorf("audit = %+v, want the failed report with the SMTP error", entries)
	}
}

func TestRunAuditReport_skipsAnEmptyDayWithoutATrace(t *testing.T) {
	// Nothing listens there: a send would fail and show in the state.
	m := newTestMailer(t, dailyReport(config.SMTPConfig{Host: "127.0.0.1", Port: 1, Security: config.SMTPNone, From: "axeos@example.com"}, "me@example.com"))

	m.runAuditReport(context.Background(), reportTime)

	state := auditreport.Load(m.config.Storage.MailDir())
	if state.LastError != "" || state.LastTo != "2026-10-16" {
		t.Errorf("state = %+v, want the 15th done without a send", state)
	}
	if entries := reportEntries(t, m); len(entries) != 0 {
		t.Errorf("audit = %+v, want no entry for a skipped day", entries)
	}
}
