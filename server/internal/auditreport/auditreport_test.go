package auditreport

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/audit"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/mail"
)

func day(s string) time.Time {
	d, err := time.Parse(dateLayout, s)
	if err != nil {
		panic(err)
	}
	return d
}

func at(s string) time.Time {
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		panic(err)
	}
	return t
}

func notifications(freq config.ReportFrequency) config.NotificationsConfig {
	return config.NotificationsConfig{
		Mail: config.MailConfig{
			SMTP: config.SMTPConfig{Host: "smtp.example.com", Port: 587, Security: config.SMTPStartTLS, From: "axeos@example.com"},
			To:   []string{"me@example.com"},
		},
		AuditReport: config.AuditReportConfig{Enabled: true, Frequency: freq},
	}
}

func TestDue(t *testing.T) {
	tests := []struct {
		name     string
		now      string
		freq     config.ReportFrequency
		state    State
		wantFrom string // "" = not due
		wantTo   string
	}{
		{"daily, before the send hour", "2026-10-16T00:59:00Z", config.ReportDaily, State{}, "", ""},
		{"daily, from the send hour: the day before", "2026-10-16T01:00:00Z", config.ReportDaily, State{}, "2026-10-15", "2026-10-16"},
		{"daily, later that day all the same", "2026-10-16T18:00:00Z", config.ReportDaily, State{}, "2026-10-15", "2026-10-16"},
		{"daily, already sent", "2026-10-16T01:00:00Z", config.ReportDaily, State{LastTo: "2026-10-16"}, "", ""},
		{"no frequency reads as daily", "2026-10-16T01:00:00Z", "", State{}, "2026-10-15", "2026-10-16"},
		// 00:30 UTC is 02:30 in Paris: UTC decides, not the clock it's read on.
		{"UTC decides, not the local time", "2026-10-16T02:30:00+02:00", config.ReportDaily, State{}, "", ""},
		{"every 2 days, the night after the last one", "2026-10-16T01:00:00Z", config.ReportEvery2Days, State{LastTo: "2026-10-15"}, "", ""},
		{"every 2 days, two nights after", "2026-10-16T01:00:00Z", config.ReportEvery2Days, State{LastTo: "2026-10-14"}, "2026-10-14", "2026-10-16"},
		{"every 2 days, never sent", "2026-10-16T01:00:00Z", config.ReportEvery2Days, State{}, "2026-10-14", "2026-10-16"},
		{"weekly, not on a Friday", "2026-10-16T01:00:00Z", config.ReportWeekly, State{}, "", ""},
		{"weekly, Monday: Monday to Sunday", "2026-10-19T01:00:00Z", config.ReportWeekly, State{}, "2026-10-12", "2026-10-19"},
		{"monthly, not on the 16th", "2026-10-16T01:00:00Z", config.ReportMonthly, State{}, "", ""},
		{"monthly, the 1st: the month before", "2026-11-01T01:00:00Z", config.ReportMonthly, State{}, "2026-10-01", "2026-11-01"},
		{"unknown frequency", "2026-10-16T01:00:00Z", "hourly", State{}, "", ""},
		{"failed less than an hour ago", "2026-10-16T01:30:00Z", config.ReportDaily,
			State{LastError: "535", LastAttemptAt: at("2026-10-16T01:00:00Z")}, "", ""},
		{"failed an hour ago: retried", "2026-10-16T02:00:00Z", config.ReportDaily,
			State{LastError: "535", LastAttemptAt: at("2026-10-16T01:00:00Z")}, "2026-10-15", "2026-10-16"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p, due := Due(at(tt.now), notifications(tt.freq), tt.state)
			if tt.wantFrom == "" {
				if due {
					t.Errorf("due for %v → %v, want not due", p.From, p.To)
				}
				return
			}
			if !due || !p.From.Equal(day(tt.wantFrom)) || !p.To.Equal(day(tt.wantTo)) {
				t.Errorf("Due() = %v → %v (due %v), want %s → %s", p.From, p.To, due, tt.wantFrom, tt.wantTo)
			}
		})
	}
}

func TestDue_neverWithoutWhatItNeeds(t *testing.T) {
	now := at("2026-10-16T01:00:00Z")
	off := notifications(config.ReportDaily)
	off.AuditReport.Enabled = false
	noServer := notifications(config.ReportDaily)
	noServer.Mail.SMTP = config.SMTPConfig{}
	noRecipient := notifications(config.ReportDaily)
	noRecipient.Mail.To = nil

	for name, n := range map[string]config.NotificationsConfig{"turned off": off, "no SMTP server": noServer, "no recipient": noRecipient} {
		if _, due := Due(now, n, State{}); due {
			t.Errorf("%s: due, want not", name)
		}
	}
}

func TestStateRoundTrip(t *testing.T) {
	dir := t.TempDir()
	if s := Load(dir); s != (State{}) {
		t.Fatalf("Load() with no file = %+v, want the zero State", s)
	}
	want := State{LastFrom: "2026-10-15", LastTo: "2026-10-16", LastSentAt: at("2026-10-16T01:00:00Z")}
	if err := Save(dir, want); err != nil {
		t.Fatal(err)
	}
	if got := Load(dir); got != want {
		t.Errorf("Load() = %+v, want %+v", got, want)
	}
}

var oneDay = Period{From: day("2026-10-15"), To: day("2026-10-16")}

// build is Build with the built-in template in n's language, sent at 01:00
// the day after.
func build(n config.NotificationsConfig, p Period, entries []audit.Entry, names map[string]string) (mail.Message, error) {
	return Build(n, p, entries, names, "", p.To.Add(time.Hour))
}

func entries() []audit.Entry {
	return []audit.Entry{
		{Timestamp: at("2026-10-15T08:00:00Z"), Source: audit.SourceAPI, IP: "192.168.1.10", Type: audit.TypeRestart, Target: "192.168.1.65", Status: 204},
		{Timestamp: at("2026-10-15T09:00:00Z"), Source: audit.SourceSystem, Service: audit.ServiceScheduler, Type: audit.TypeSwitchFallback, Target: "192.168.1.66", Status: 502, Error: "device unreachable"},
		{Timestamp: at("2026-10-15T10:00:00Z"), Source: audit.SourceAPI, IP: "192.168.1.10", Type: audit.TypeMailSettings, Changes: []audit.Change{
			{Field: "smtpPassword", Kind: audit.ChangeChanged},
			{Field: "auditReportFrequency", Kind: audit.ChangeChanged, Before: "daily", After: "weekly"},
		}},
	}
}

func TestBuild_aDayInFrench(t *testing.T) {
	n := notifications(config.ReportDaily)
	n.Language = "fr"
	n.DashboardURL = "http://192.168.1.60/"

	msg, err := build(n, oneDay, entries(), map[string]string{"192.168.1.65": "salon"})
	if err != nil {
		t.Fatal(err)
	}

	if msg.Subject != "AxeOS Dashboard — Audit du jeudi 15 octobre 2026 : 3 événements" {
		t.Errorf("subject = %q", msg.Subject)
	}
	if !reflect.DeepEqual(msg.To, []string{"me@example.com"}) {
		t.Errorf("to = %v", msg.To)
	}
	for _, want := range []string{
		"Audit du jeudi 15 octobre 2026 — 3 événements",
		"Redémarrage (1)\n  08:00  Dashboard (192.168.1.10) · salon (192.168.1.65)\n",
		// No name configured: the bare IP.
		"  09:00  Système · Planificateur · 192.168.1.66 · Échec (502) : device unreachable\n",
		// A secret never shows, only that it changed; a value reads as the dashboard words it.
		"         Mot de passe SMTP : valeur modifiée\n",
		"         Fréquence du rapport d'audit : Tous les jours → Chaque semaine\n",
		"Jours et heures en UTC.",
		"Voir dans le dashboard : http://192.168.1.60/audit?from=2026-10-15T00:00:00Z&to=2026-10-16T00:00:00Z",
	} {
		if !strings.Contains(msg.Text, want) {
			t.Errorf("text misses %q:\n%s", want, msg.Text)
		}
	}
	// Grouped in the dashboard's own order of types.
	if strings.Index(msg.Text, "Redémarrage") > strings.Index(msg.Text, "Bascule vers le pool de secours") {
		t.Errorf("types out of audit.Types order:\n%s", msg.Text)
	}
}

func TestBuild_severalDaysInEnglish(t *testing.T) {
	week := Period{From: day("2026-10-12"), To: day("2026-10-19")}

	msg, err := build(notifications(config.ReportWeekly), week, entries(), nil)
	if err != nil {
		t.Fatal(err)
	}

	if msg.Subject != "AxeOS Dashboard — Audit from 2026-10-12 to 2026-10-18: 3 events" {
		t.Errorf("subject = %q", msg.Subject)
	}
	for _, want := range []string{
		"Audit from 2026-10-12 to 2026-10-18 — 3 events",
		// Several days: each entry says which.
		"  Oct 15 08:00  Dashboard (192.168.1.10) · 192.168.1.65\n",
		"Days and times in UTC.",
	} {
		if !strings.Contains(msg.Text, want) {
			t.Errorf("text misses %q:\n%s", want, msg.Text)
		}
	}
	if strings.Contains(msg.Text, "Open in the dashboard") {
		t.Errorf("a link without the dashboard's address:\n%s", msg.Text)
	}
}

func TestBuild_onlyTheChosenTypes(t *testing.T) {
	n := notifications(config.ReportDaily)
	n.AuditReport.Types = []string{audit.TypeRestart}

	msg, err := build(n, oneDay, entries(), nil)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(msg.Subject, "1 event") || strings.Contains(msg.Text, "Switch to fallback pool") {
		t.Errorf("other types kept:\n%s", msg.Text)
	}
}

func TestBuild_anEmptyPeriod(t *testing.T) {
	n := notifications(config.ReportDaily)

	msg, err := build(n, oneDay, nil, nil)
	if err != nil || !strings.Contains(msg.Text, "Nothing recorded that day.") {
		t.Errorf("Build() = %q, %v; want the mail saying nothing happened", msg.Text, err)
	}

	n.AuditReport.SkipIfEmpty = true
	if _, err := build(n, oneDay, nil, nil); !errors.Is(err, ErrNothingToSend) {
		t.Errorf("err = %v, want ErrNothingToSend", err)
	}
	// Nothing left once filtered counts as empty too.
	n.AuditReport.Types = []string{audit.TypeDiscover}
	if _, err := build(n, oneDay, entries(), nil); !errors.Is(err, ErrNothingToSend) {
		t.Errorf("filtered out: err = %v, want ErrNothingToSend", err)
	}
}

// The mail's labels are copied from the dashboard's (ui/src/locales,
// auditPage.*): the same event must read the same in both.
func TestLabels_matchTheDashboards(t *testing.T) {
	for lang, l := range map[string]labels{"fr": fr, "en": en} {
		t.Run(lang, func(t *testing.T) {
			data, err := os.ReadFile(filepath.Join("..", "..", "..", "ui", "src", "locales", lang+".json"))
			if err != nil {
				t.Fatal(err)
			}
			var locale struct {
				AuditPage struct {
					Types    map[string]string            `json:"types"`
					Fields   map[string]string            `json:"fields"`
					Sources  map[string]string            `json:"sources"`
					Services map[string]string            `json:"services"`
					Values   map[string]map[string]string `json:"values"`
				} `json:"auditPage"`
			}
			if err := json.Unmarshal(data, &locale); err != nil {
				t.Fatal(err)
			}
			ui := locale.AuditPage
			for name, pair := range map[string][2]map[string]string{
				"types":    {l.types, ui.Types},
				"fields":   {l.fields, ui.Fields},
				"sources":  {l.sources, ui.Sources},
				"services": {l.services, ui.Services},
			} {
				if !reflect.DeepEqual(pair[0], pair[1]) {
					t.Errorf("auditPage.%s differs:\n go: %v\n ui: %v", name, pair[0], pair[1])
				}
			}
			if !reflect.DeepEqual(l.values, ui.Values) {
				t.Errorf("auditPage.values differs:\n go: %v\n ui: %v", l.values, ui.Values)
			}
			for _, typ := range audit.Types {
				if _, ok := l.types[typ]; !ok {
					t.Errorf("no label for type %q", typ)
				}
			}
		})
	}
}

func TestBuild_html(t *testing.T) {
	n := notifications(config.ReportDaily)
	n.Language = "fr"

	msg, err := build(n, oneDay, entries(), map[string]string{"192.168.1.65": "salon"})
	if err != nil {
		t.Fatal(err)
	}
	if len(msg.Inline) != 1 || msg.Inline[0].ID != "logo" {
		t.Errorf("inline = %+v, want the logo", msg.Inline)
	}
	for _, want := range []string{
		`<img src="cid:logo"`,
		"Redémarrage · 1",
		"salon (192.168.1.65)",
		// A failed one stands out.
		"Échec (502) : device unreachable</div>",
		"border-left:4px solid #e53935",
		"Fréquence du rapport d&#39;audit : Tous les jours → Chaque semaine",
		"16/10/2026 à 01:00 (UTC)",
	} {
		if !strings.Contains(msg.HTML, want) {
			t.Errorf("HTML misses %q", want)
		}
	}
}

func TestBuild_noLinkToAnIP(t *testing.T) {
	n := notifications(config.ReportDaily)
	for address, link := range map[string]bool{
		"http://192.168.1.60":        false,
		"https://axeos.example.com/": true,
	} {
		n.DashboardURL = address
		msg, err := build(n, oneDay, entries(), nil)
		if err != nil {
			t.Fatal(err)
		}
		if got := strings.Contains(msg.HTML, "href="); got != link {
			t.Errorf("%s: a link in the HTML = %v, want %v", address, got, link)
		}
		if strings.Contains(msg.HTML, "192.168.1.60") {
			t.Errorf("%s: the IP shows in the HTML -- Gmail turns it into a link", address)
		}
		// The text version keeps it, as text.
		if !strings.Contains(msg.Text, "Open in the dashboard: "+strings.TrimRight(address, "/")+"/audit?") {
			t.Errorf("%s: text = %q, want the link as text", address, msg.Text)
		}
	}
}

func TestSample(t *testing.T) {
	p, entries, names := Sample(at("2026-10-16T14:00:00Z"))

	if !p.OneDay() || p.From != day("2026-10-15") {
		t.Errorf("period = %+v, want the day before", p)
	}
	for _, e := range entries {
		if e.Timestamp.Before(p.From) || !e.Timestamp.Before(p.To) {
			t.Errorf("entry at %v, outside the period", e.Timestamp)
		}
		if e.Target != "" && names[e.Target] == "" {
			t.Errorf("miner %s has no name", e.Target)
		}
	}
	n := notifications(config.ReportDaily)
	if msg, err := Build(n, p, entries, names, "", p.To); err != nil || !strings.Contains(msg.Text, "Bitaxe-1 (192.168.1.10)") {
		t.Errorf("Build() = %q, %v", msg.Text, err)
	}
}
