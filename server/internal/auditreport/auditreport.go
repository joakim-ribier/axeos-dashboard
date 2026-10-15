// Package auditreport is the mail summing up the audit since the previous
// one: when it's due, what it says, and the record of when it last went
// out.
package auditreport

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/audit"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/mail"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/mailtemplate"
)

// SendHour is when, UTC, a due report goes out: at night, the period it
// covers just closed. Everything here is UTC, like the audit's own days --
// a report never depends on where its reader happens to be.
const SendHour = 1

// RetryAfter is how long a failed send waits before the next try -- a
// wrong password must not hammer the SMTP server every minute.
const RetryAfter = time.Hour

const (
	stateFile  = "audit-report.json"
	dateLayout = "2006-01-02"
)

// Period is the days a report covers: From included, To excluded, both
// UTC midnights.
type Period struct {
	From, To time.Time
}

// OneDay reports whether the period is a single day.
func (p Period) OneDay() bool {
	return p.From.AddDate(0, 0, 1).Equal(p.To)
}

// State is when the report last went out, kept on disk so a restart
// neither sends a period twice nor skips one.
type State struct {
	// LastFrom/LastTo is the period last mailed ("2006-01-02", To
	// excluded) -- or skipped, when it had nothing to say and SkipIfEmpty
	// is on.
	LastFrom      string    `json:"lastFrom,omitempty"`
	LastTo        string    `json:"lastTo,omitempty"`
	LastSentAt    time.Time `json:"lastSentAt,omitzero"`
	LastAttemptAt time.Time `json:"lastAttemptAt,omitzero"`
	LastError     string    `json:"lastError,omitempty"`
}

// Load reads the state from dir -- the zero State if there's none yet.
func Load(dir string) State {
	var s State
	data, err := os.ReadFile(filepath.Join(dir, stateFile))
	if err != nil {
		return s
	}
	_ = json.Unmarshal(data, &s)
	return s
}

// Save writes the state to dir.
func Save(dir string, s State) error {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	tmp := filepath.Join(dir, stateFile+".tmp")
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, filepath.Join(dir, stateFile))
}

// Due says which period's report should go out at now, if any. From
// SendHour on, on a night the frequency sends (every one, every other one,
// Sunday to Monday, the 1st), the period that just closed -- unless it
// already went out, or failed less than RetryAfter ago.
func Due(now time.Time, n config.NotificationsConfig, s State) (Period, bool) {
	if !n.AuditReport.Enabled || !n.Mail.SMTP.Configured() || len(n.Mail.To) == 0 {
		return Period{}, false
	}
	utc := now.UTC()
	if utc.Hour() < SendHour {
		return Period{}, false
	}
	today := time.Date(utc.Year(), utc.Month(), utc.Day(), 0, 0, 0, 0, time.UTC)
	if s.LastTo == today.Format(dateLayout) {
		return Period{}, false
	}

	var from time.Time
	switch n.AuditReport.Frequency {
	case config.ReportDaily, "":
		from = today.AddDate(0, 0, -1)
	case config.ReportEvery2Days:
		if last, err := time.Parse(dateLayout, s.LastTo); err == nil && last.AddDate(0, 0, 2).After(today) {
			return Period{}, false
		}
		from = today.AddDate(0, 0, -2)
	case config.ReportWeekly:
		if today.Weekday() != time.Monday {
			return Period{}, false
		}
		from = today.AddDate(0, 0, -7)
	case config.ReportMonthly:
		if today.Day() != 1 {
			return Period{}, false
		}
		from = today.AddDate(0, -1, 0)
	default:
		return Period{}, false
	}

	if s.LastError != "" && now.Sub(s.LastAttemptAt) < RetryAfter {
		return Period{}, false
	}
	return Period{From: from, To: today}, true
}

// ErrNothingToSend is Build's answer for an empty period when SkipIfEmpty is
// on.
var ErrNothingToSend = errors.New("nothing recorded in the period")

// Build is the mail for p, worded by tmpl (see mailtemplate): every entry
// recorded in it, of the configured types, grouped by type -- miners named
// after names (IP -> display name) -- and a link to the same period in the
// dashboard's audit page when its address is set.
func Build(n config.NotificationsConfig, p Period, entries []audit.Entry, names map[string]string, tmpl mailtemplate.Template, now time.Time) (mail.Message, error) {
	if len(n.AuditReport.Types) > 0 {
		entries = slices.DeleteFunc(slices.Clone(entries), func(e audit.Entry) bool {
			return !slices.Contains(n.AuditReport.Types, e.Type)
		})
	}
	if len(entries) == 0 && n.AuditReport.SkipIfEmpty {
		return mail.Message{}, ErrNothingToSend
	}

	l := labelsFor(n.Language)
	var events strings.Builder
	if len(entries) == 0 {
		events.WriteString(l.nothing)
	}
	for i, typ := range typesIn(entries) {
		if i > 0 {
			events.WriteString("\n")
		}
		var group []audit.Entry
		for _, e := range entries {
			if e.Type == typ {
				group = append(group, e)
			}
		}
		fmt.Fprintf(&events, "%s (%d)\n", l.label(l.types, typ), len(group))
		for _, e := range group {
			events.WriteString(l.line(e, !p.OneDay(), names))
		}
	}

	subject, text := tmpl.Render(map[string]string{
		"title":       l.title(p),
		"count":       l.count(len(entries)),
		"events":      strings.TrimRight(events.String(), "\n"),
		"periodStart": p.From.Format(l.day),
		"periodEnd":   p.last().Format(l.day),
		"link":        auditLink(n.DashboardURL, p),
		"date":        now.UTC().Format(l.sentAt),
		"sentTo":      strings.Join(n.Mail.To, ", "),
	})
	return mail.Message{To: n.Mail.To, Subject: subject, Text: text}, nil
}

// auditLink is the dashboard's audit page on p -- "" without an address.
func auditLink(dashboardURL string, p Period) string {
	if dashboardURL == "" {
		return ""
	}
	// RFC 3339's ":" needs no escaping in a query: kept readable.
	return fmt.Sprintf("%s/audit?from=%s&to=%s", strings.TrimRight(dashboardURL, "/"),
		p.From.UTC().Format(time.RFC3339), p.To.UTC().Format(time.RFC3339))
}

// typesIn is the types the entries carry, in the order the dashboard lists
// them (audit.Types), any unknown one last.
func typesIn(entries []audit.Entry) []string {
	seen := map[string]bool{}
	for _, e := range entries {
		seen[e.Type] = true
	}
	var out []string
	for _, t := range audit.Types {
		if seen[t] {
			out = append(out, t)
			delete(seen, t)
		}
	}
	var rest []string
	for t := range seen {
		rest = append(rest, t)
	}
	slices.Sort(rest)
	return append(out, rest...)
}
