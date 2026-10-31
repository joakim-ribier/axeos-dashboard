package alertmail

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/alerts"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
)

var poll = time.Date(2026, 10, 30, 8, 53, 0, 0, time.UTC)

func settings(lang, dashboardURL string) config.NotificationsConfig {
	return config.NotificationsConfig{
		Language:     lang,
		DashboardURL: dashboardURL,
		Mail:         config.MailConfig{To: []string{"me@example.com"}},
	}
}

func TestBuild(t *testing.T) {
	msg, err := Build(settings("en", "https://axeos.example.com/"), []alerts.Event{
		{Timestamp: poll, Mac: "bb", IP: "10.0.0.2", Hostname: "garage", Type: alerts.TypeFirmwareUpdate, State: alerts.Raised, Message: "v2.15.4"},
		{Timestamp: poll, Mac: "aa", IP: "10.0.0.1", Hostname: "office", Type: alerts.TypeTempHigh, State: alerts.Raised, Value: 64.4, Threshold: 62},
		{Timestamp: poll, Mac: "cc", IP: "10.0.0.3", Type: alerts.TypeOffline, State: alerts.Raised},
	}, "")
	if err != nil {
		t.Fatal(err)
	}

	if msg.Subject != "3 new alerts — AxeOS Dashboard" || len(msg.To) != 1 {
		t.Errorf("subject = %q, to = %v", msg.Subject, msg.To)
	}
	if len(msg.Inline) != 1 || msg.Inline[0].ID != "logo" || len(msg.Inline[0].Data) == 0 {
		t.Errorf("inline = %+v, want the logo", msg.Inline)
	}

	// The most serious first, in both versions; a miner with no name shows
	// by its IP.
	for name, body := range map[string]string{"text": msg.Text, "html": msg.HTML} {
		offline := strings.Index(body, "10.0.0.3")
		temp := strings.Index(body, "High temperature")
		firmware := strings.Index(body, "Firmware update")
		if offline < 0 || offline > temp || temp > firmware {
			t.Errorf("%s: offline at %d, temperature at %d, firmware at %d -- want them in that order", name, offline, temp, firmware)
		}
	}
	for _, want := range []string{"64 °C — threshold 62 °C", "Version v2.15.4 available", "2026-10-30 08:53 (UTC)"} {
		if !strings.Contains(msg.Text, want) {
			t.Errorf("text misses %q:\n%s", want, msg.Text)
		}
	}
	if !strings.Contains(msg.HTML, `href="https://axeos.example.com/alerts"`) || !strings.Contains(msg.Text, "See the alerts: https://axeos.example.com/alerts") {
		t.Errorf("a dashboard with a name: want the link to its Alerts page")
	}
}

func TestBuild_noLinkToAnIP(t *testing.T) {
	event := alerts.Event{Timestamp: poll, Mac: "aa", IP: "10.0.0.1", Hostname: "office", Type: alerts.TypeOffline, State: alerts.Raised}
	for _, address := range []string{"http://192.168.1.60", "http://localhost:8080", ""} {
		msg, err := Build(settings("fr", address), []alerts.Event{event}, "")
		if err != nil {
			t.Fatal(err)
		}
		if strings.Contains(msg.HTML, "href=") || (address != "" && strings.Contains(msg.HTML, address)) {
			t.Errorf("%q: the HTML links to it or shows it -- spam filters flag that", address)
		}
		if msg.Subject != "office : Hors ligne — AxeOS Dashboard" {
			t.Errorf("subject = %q, want the one alert's", msg.Subject)
		}
	}
	msg, _ := Build(settings("fr", "http://192.168.1.60"), []alerts.Event{event}, "")
	if !strings.Contains(msg.Text, "Dashboard : http://192.168.1.60") {
		t.Errorf("text = %q, want the address as text", msg.Text)
	}
}

func TestBuild_anEditedTemplate(t *testing.T) {
	dir := t.TempDir()
	write := func(content string) {
		t.Helper()
		if err := os.WriteFile(filepath.Join(dir, "alert.en.html"), []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	events := Sample(poll)

	write(`<html><head><title>{{.Count}} things</title></head><body>{{range .Alerts}}{{.Miner}};{{end}}</body></html>`)
	msg, err := Build(settings("en", ""), events, dir)
	if err != nil || msg.Subject != "3 things" || !strings.Contains(msg.HTML, "Bitaxe-2;") {
		t.Errorf("edited template: subject %q, err %v", msg.Subject, err)
	}

	// Broken: the built-in one, with the error to log.
	write(`<title>{{.Nope}}</title>`)
	msg, err = Build(settings("en", ""), events, dir)
	if err == nil || msg.Subject != "3 new alerts — AxeOS Dashboard" {
		t.Errorf("broken template: subject %q, err %v; want the built-in one and the error", msg.Subject, err)
	}
}

func TestSample(t *testing.T) {
	events := Sample(poll)
	if len(events) != 3 {
		t.Fatalf("got %d, want 3", len(events))
	}
	for _, e := range events {
		if e.State != alerts.Raised || !e.Timestamp.Equal(poll) {
			t.Errorf("%+v, want raised at the poll", e)
		}
	}
}

func TestState_savedAndLoaded(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "mail")
	if s := Load(dir); !s.LastSentAt.IsZero() || s.LastError != "" {
		t.Fatalf("Load() with no file = %+v, want zero", s)
	}
	if err := Save(dir, State{LastSentAt: poll, LastError: "refused"}); err != nil {
		t.Fatal(err)
	}
	if s := Load(dir); !s.LastSentAt.Equal(poll) || s.LastError != "refused" {
		t.Errorf("Load() = %+v, want what was saved", s)
	}
}
