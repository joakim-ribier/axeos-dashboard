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

// Data is what the HTML template is filled with -- see
// templates/audit-report.*.html.
type Data struct {
	Title, Count, Empty    string
	PeriodStart, PeriodEnd string
	Date                   string
	// AuditURL is the dashboard's audit page on the period -- empty
	// without the dashboard's address, or when it's an IP (see
	// mailtemplate.Linkable).
	AuditURL string
	Groups   []Group
}

// Group is one type's entries.
type Group struct {
	Label   string
	Count   int
	Entries []Entry
}

// Build is the mail for p: every entry recorded in it, of the configured
// types, grouped by type -- miners named after names (IP -> display name)
// -- the HTML template filled (from templatesDir, the built-in one if it's
// missing or broken: that error is returned for the log, the mail still
// built) with a text version alongside, and a link to the same period in
// the dashboard's audit page. ErrNothingToSend for an empty period when
// SkipIfEmpty is on.
func Build(n config.NotificationsConfig, p Period, entries []audit.Entry, names map[string]string, templatesDir string, now time.Time) (mail.Message, error) {
	if len(n.AuditReport.Types) > 0 {
		entries = slices.DeleteFunc(slices.Clone(entries), func(e audit.Entry) bool {
			return !slices.Contains(n.AuditReport.Types, e.Type)
		})
	}
	if len(entries) == 0 && n.AuditReport.SkipIfEmpty {
		return mail.Message{}, ErrNothingToSend
	}

	l := labelsFor(n.Language)
	link := auditLink(n.DashboardURL, p)
	data := Data{
		Title:       l.title(p),
		Count:       l.count(len(entries)),
		Empty:       l.nothing,
		PeriodStart: p.From.Format(l.day),
		PeriodEnd:   p.last().Format(l.day),
		Date:        now.UTC().Format(l.sentAt),
	}
	if mailtemplate.Linkable(n.DashboardURL) {
		data.AuditURL = link
	}
	for _, typ := range typesIn(entries) {
		group := Group{Label: l.label(l.types, typ)}
		for _, e := range entries {
			if e.Type == typ {
				group.Entries = append(group.Entries, l.entry(e, !p.OneDay(), names))
			}
		}
		group.Count = len(group.Entries)
		data.Groups = append(data.Groups, group)
	}

	subject, html, err := mailtemplate.RenderHTML(templatesDir, mailtemplate.AuditReport, n.Language, data)
	return mail.Message{
		To:      n.Mail.To,
		Subject: subject,
		Text:    text(data, l, link),
		HTML:    html,
		Inline:  []mail.Inline{{ID: "logo", ContentType: "image/png", Data: mailtemplate.Logo}},
	}, err
}

// text is the mail's text version: the title, the entries grouped by type,
// the time zone, and the link to the dashboard -- as text, even to an IP.
func text(d Data, l labels, link string) string {
	var b strings.Builder
	fmt.Fprintf(&b, "%s — %s\n\n", d.Title, d.Count)
	if len(d.Groups) == 0 {
		b.WriteString(d.Empty + "\n")
	}
	for i, g := range d.Groups {
		if i > 0 {
			b.WriteString("\n")
		}
		fmt.Fprintf(&b, "%s (%d)\n", g.Label, g.Count)
		for _, e := range g.Entries {
			b.WriteString(e.text())
		}
	}
	fmt.Fprintf(&b, "\n%s\n", l.utc)
	if link != "" {
		fmt.Fprintf(&b, "\n%s%s%s\n", l.open, l.colon, link)
	}
	return b.String()
}

// Sample is a made-up report on the day before now -- the example mail
// sent from the Notifications page, to see what a report looks like
// without waiting for the night: a period, its entries, and the miners'
// names.
func Sample(now time.Time) (Period, []audit.Entry, map[string]string) {
	utc := now.UTC()
	to := time.Date(utc.Year(), utc.Month(), utc.Day(), 0, 0, 0, 0, time.UTC)
	from := to.AddDate(0, 0, -1)
	at := func(h, m int) time.Time { return from.Add(time.Duration(h)*time.Hour + time.Duration(m)*time.Minute) }
	return Period{From: from, To: to}, []audit.Entry{
		{Timestamp: at(8, 12), Source: audit.SourceAPI, IP: "192.168.1.20", Type: audit.TypeRestart, Target: "192.168.1.10", Status: 204},
		{Timestamp: at(23, 59), Source: audit.SourceSystem, Service: audit.ServiceScheduler, Type: audit.TypeSwitchFallback, Target: "192.168.1.11", Status: 502, Error: "device unreachable"},
		{Timestamp: at(14, 30), Source: audit.SourceAPI, IP: "192.168.1.20", Type: audit.TypeMinerPool, Target: "192.168.1.10", Changes: []audit.Change{
			{Field: "url", Kind: audit.ChangeChanged, Before: "stratum.braiins.com", After: "solo.atlaspool.io"},
		}},
	}, map[string]string{
		"192.168.1.10": "Bitaxe-1",
		"192.168.1.11": "Bitaxe-2",
	}
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
