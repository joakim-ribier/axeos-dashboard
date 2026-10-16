package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/audit"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/auditreport"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/mail"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/mailtemplate"
)

// Mailer sends the dashboard's scheduled mails -- the audit report for now
// -- from what the other processes leave on disk: the audit log
// (dashboard-api) and settings.yml. A process of its own, so a slow or
// failing SMTP server never touches the polling (feeder) nor the UI
// (dashboard-api).
type Mailer struct {
	logger           *slog.Logger
	config           config.Config
	auditLog         *audit.Log
	appSettingsStore *config.AppSettingsStore
	minersStore      *config.MinersStore

	startedAt   time.Time
	mu          sync.Mutex
	lastCheckAt time.Time
}

func NewMailer(logger *slog.Logger, cfg config.Config) *Mailer {
	return &Mailer{
		logger:    logger.With("namespace", "mailer"),
		config:    cfg,
		auditLog:  audit.NewLog(cfg.Storage.AuditDir()),
		startedAt: time.Now(),
	}
}

func (m *Mailer) lastCheck() time.Time {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.lastCheckAt
}

func (m *Mailer) checked(at time.Time) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.lastCheckAt = at
}

// WithAppSettingsStore attaches the store the mail settings are re-read
// from before every check, so a change saved from the Notifications page
// applies within the minute, without a restart.
func (m *Mailer) WithAppSettingsStore(store *config.AppSettingsStore) *Mailer {
	m.appSettingsStore = store
	return m
}

// WithMinersStore attaches the store miners.yml is re-read from, to name
// the miners the mails mention.
func (m *Mailer) WithMinersStore(store *config.MinersStore) *Mailer {
	m.minersStore = store
	return m
}

// minerNames maps each configured miner's IP to its display name (alias,
// else hostname), as miners.yml stands right now.
func (m *Mailer) minerNames() map[string]string {
	bitaxes := m.config.Bitaxes
	if m.minersStore != nil {
		reloaded, err := m.minersStore.Reload()
		if err != nil {
			m.logger.Error("failed to reload miners config", "error", err)
		}
		bitaxes = reloaded
	}
	names := make(map[string]string, len(bitaxes))
	for _, b := range bitaxes {
		name := b.Alias
		if name == "" {
			name = b.Hostname
		}
		names[b.Ip] = name
	}
	return names
}

// Run serves the mailer's API and checks every minute whether a mail is
// due, until the process is asked to stop.
func (m *Mailer) Run() error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// Listening before anything else: a port already taken is most likely
	// another mailer running, and two would send every report twice.
	addr := m.config.Mailer.Address()
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("mailer API on %s: %w", addr, err)
	}
	server := &http.Server{Handler: m.Handler(), ReadHeaderTimeout: 10 * time.Second}
	go func() {
		if err := server.Serve(listener); err != nil && !errors.Is(err, http.ErrServerClosed) {
			m.logger.Error("mailer API stopped", "error", err)
		}
	}()
	m.logger.Info("mailer API listening on " + addr)
	m.installTemplates()

	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	for {
		now := time.Now()
		m.runAuditReport(ctx, now)
		m.checked(now)

		select {
		case <-ctx.Done():
			shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			_ = server.Shutdown(shutdownCtx)
			m.logger.Info("Mailer stopped")
			return nil
		case <-ticker.C:
		}
	}
}

// template is name's template in lang, read again from its file on every
// send so an edit applies right away -- the built-in one if the file is
// broken, which is logged: the mail still goes out.
func (m *Mailer) template(name, lang string) mailtemplate.Template {
	t, err := mailtemplate.Load(m.config.MailTemplatesDir, name, lang)
	if err != nil {
		m.logger.Error("mail template unusable, the built-in one is used instead", "error", err)
	}
	return t
}

// installTemplates writes the built-in templates missing from the
// templates folder, for the operator to edit -- never over one already
// there.
func (m *Mailer) installTemplates() {
	dir := m.config.MailTemplatesDir
	if dir == "" {
		return
	}
	written, err := mailtemplate.Install(dir)
	if err != nil {
		m.logger.Error("failed to install the mail templates", "dir", dir, "error", err)
	}
	if len(written) > 0 {
		m.logger.Info("Mail templates installed", "dir", dir, "files", written)
	}
}

// notifications is the notifications config as it stands in settings.yml
// right now.
func (m *Mailer) notifications() config.NotificationsConfig {
	if m.appSettingsStore == nil {
		return m.config.Notifications
	}
	settings, err := m.appSettingsStore.Reload()
	if err != nil {
		m.logger.Error("failed to reload app settings", "error", err)
	}
	return settings.Notifications
}

// runAuditReport mails the audit of the period that just closed once it's
// due (see auditreport.Due), and records how it went for the Notifications
// page.
func (m *Mailer) runAuditReport(ctx context.Context, now time.Time) {
	settings := m.notifications()
	dir := m.config.Storage.MailDir()
	state := auditreport.Load(dir)
	period, due := auditreport.Due(now, settings, state)
	if !due {
		return
	}
	from, to := period.From.Format("2006-01-02"), period.To.Format("2006-01-02")
	// What the report covered, its last day included -- To is excluded.
	last := period.To.AddDate(0, 0, -1).Format("2006-01-02")

	sent := false
	entries, err := m.auditLog.ReadRange(period.From, period.To)
	if err == nil {
		var msg mail.Message
		msg, err = auditreport.Build(settings, period, entries, m.minerNames(), m.template(mailtemplate.AuditReport, settings.Language), now)
		switch {
		case errors.Is(err, auditreport.ErrNothingToSend):
			err = nil
		case err == nil:
			err = mail.Send(ctx, settings.Mail.SMTP, msg)
			sent = err == nil
		}
	}
	// Like the nightly backup: a report sent, or one that failed, is
	// recorded -- a period skipped for having nothing to say isn't.
	if sent || err != nil {
		m.recordAuditReport(now, from, last, settings.Mail.To, err)
	}

	state.LastAttemptAt = now
	if err != nil {
		m.logger.Error("failed to send the audit report", "from", from, "to", last, "error", err)
		state.LastError = err.Error()
	} else {
		m.logger.Info("Audit report sent", "from", from, "to", last)
		state.LastError = ""
		state.LastFrom, state.LastTo = from, to
		state.LastSentAt = now
	}
	if err := auditreport.Save(dir, state); err != nil {
		m.logger.Error("failed to save the audit report state", "error", err)
	}
}

// recordAuditReport writes the report's own entry in the audit: the period
// it covered (last day included) and who it went to -- or the error.
func (m *Mailer) recordAuditReport(now time.Time, from, last string, to []string, sendErr error) {
	period := from
	if last != from {
		period = from + " → " + last
	}
	entry := audit.Entry{
		Timestamp: now,
		Source:    audit.SourceSystem,
		Service:   audit.ServiceMailer,
		Type:      audit.TypeAuditReport,
		Changes:   []audit.Change{{Field: "reportPeriod", Kind: audit.ChangeAdded, After: period}},
	}
	for _, r := range to {
		entry.Changes = append(entry.Changes, audit.Change{Field: "sentTo", Kind: audit.ChangeAdded, After: r})
	}
	if sendErr != nil {
		entry.Error = sendErr.Error()
	}
	if err := m.auditLog.Record(entry); err != nil {
		m.logger.Error("failed to record audit entry", "type", audit.TypeAuditReport, "error", err)
	}
}
