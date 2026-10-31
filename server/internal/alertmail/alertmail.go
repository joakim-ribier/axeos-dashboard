// Package alertmail is the mail sent on every feeder poll that raised
// alerts -- the feeder hands them to the mailer: what the mail says, and
// how the last one went.
package alertmail

import (
	"encoding/json"
	"fmt"
	"math"
	"net"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/alerts"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/mail"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/mailtemplate"
)

const stateFile = "alerts-mail.json"

// State is how the last alerts mail went, for the Notifications page.
type State struct {
	LastSentAt time.Time `json:"lastSentAt,omitzero"`
	LastError  string    `json:"lastError,omitempty"`
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

// Data is what the HTML template is filled with -- see templates/alert.*.html.
type Data struct {
	Count        int
	Date         string
	DashboardURL string
	AlertsURL    string
	Alerts       []Alert
}

// Alert is one alert of the mail.
type Alert struct {
	Miner, IP, Title, Detail, Color string
	Type                            string
	Value, Threshold                float64
	Message                         string
}

const (
	red    = "#e53935"
	orange = "#fb8c00"
)

var dateLayouts = map[string]string{
	"fr": "02/01/2006 à 15:04 (UTC)",
	"en": "2006-01-02 15:04 (UTC)",
}

// Build is the mail for one poll's alerts, in the notifications' language:
// the HTML template filled (from templatesDir, the built-in one if it's
// missing or broken -- that error returned for the log, the mail still
// built), its subject, and a text version for the clients that don't show
// HTML -- the alerts in the order every list shows them.
func Build(settings config.NotificationsConfig, poll []alerts.Event, templatesDir string) (mail.Message, error) {
	lang := settings.Language
	if lang != "fr" {
		lang = "en"
	}
	data := Data{
		Count:        len(poll),
		Date:         poll[0].Timestamp.UTC().Format(dateLayouts[lang]),
		DashboardURL: strings.TrimRight(settings.DashboardURL, "/"),
	}
	if linkable(data.DashboardURL) {
		data.AlertsURL = data.DashboardURL + "/alerts"
	}
	poll = slices.SortedFunc(slices.Values(poll), alerts.Compare)
	for _, e := range poll {
		miner := e.Hostname
		if miner == "" {
			miner = e.IP
		}
		title, detail := describe(e, lang)
		color := red
		if e.Type == alerts.TypeFirmwareUpdate {
			color = orange
		}
		data.Alerts = append(data.Alerts, Alert{
			Miner: miner, IP: e.IP, Title: title, Detail: detail, Color: color,
			Type: e.Type, Value: e.Value, Threshold: e.Threshold, Message: e.Message,
		})
	}

	subject, html, err := mailtemplate.RenderHTML(templatesDir, mailtemplate.Alert, lang, data)
	return mail.Message{
		To:      settings.Mail.To,
		Subject: subject,
		Text:    text(data, lang),
		HTML:    html,
		Inline:  []mail.Inline{{ID: "logo", ContentType: "image/png", Data: mailtemplate.Logo}},
	}, err
}

// linkable reports whether the dashboard's address can be a link in the
// mail: a link to a bare IP address (http://192.168.1.60) is one of the
// first things spam filters flag -- that address then only shows as text.
func linkable(address string) bool {
	u, err := url.Parse(address)
	if err != nil || u.Hostname() == "" {
		return false
	}
	return net.ParseIP(u.Hostname()) == nil && u.Hostname() != "localhost"
}

// Sample is a made-up poll -- the example mail sent from the Notifications
// page, to see what an alert looks like without waiting for one.
func Sample(now time.Time) []alerts.Event {
	now = now.UTC().Truncate(time.Second)
	return []alerts.Event{
		{Timestamp: now, Mac: "000000000001", IP: "192.168.1.10", Hostname: "Bitaxe-1", Type: alerts.TypeTempHigh, State: alerts.Raised, Value: 64.4, Threshold: alerts.TempThreshold},
		{Timestamp: now, Mac: "000000000002", IP: "192.168.1.11", Hostname: "Bitaxe-2", Type: alerts.TypeOffline, State: alerts.Raised, Message: "i/o timeout"},
		{Timestamp: now, Mac: "000000000001", IP: "192.168.1.10", Hostname: "Bitaxe-1", Type: alerts.TypeFirmwareUpdate, State: alerts.Raised, Message: "v2.15.4"},
	}
}

// describe is an alert's title and detail, in lang.
func describe(e alerts.Event, lang string) (title, detail string) {
	fr := lang == "fr"
	pick := func(f, en string) string {
		if fr {
			return f
		}
		return en
	}
	threshold := pick("seuil", "threshold")
	switch e.Type {
	case alerts.TypeTempHigh:
		return pick("Température élevée", "High temperature"),
			fmt.Sprintf("%s °C — %s %s °C", number(e.Value), threshold, number(e.Threshold))
	case alerts.TypeFanHigh:
		return pick("Ventilateur élevé", "High fan speed"),
			fmt.Sprintf("%s %% — %s %s %%", number(e.Value), threshold, number(e.Threshold))
	case alerts.TypeOffline:
		return pick("Hors ligne", "Offline"),
			pick("Ne répond plus depuis 2 relevés", "Hasn't answered for 2 polls")
	case alerts.TypeMacMismatch:
		return pick("Configuration incohérente", "Configuration mismatch"),
			pick("Un autre appareil répond à son IP : ", "Another device answers at its IP: ") + e.Message
	case alerts.TypeFirmwareUpdate:
		return pick("Mise à jour firmware", "Firmware update"),
			pick("Version "+e.Message+" disponible", "Version "+e.Message+" available")
	}
	return e.Type, e.Message
}

// number is a reading rounded, as the dashboard shows it.
func number(v float64) string {
	return strconv.Itoa(int(math.Round(v)))
}

// text is the mail's text version: the same, one alert per paragraph.
func text(d Data, lang string) string {
	var b strings.Builder
	if lang == "fr" {
		if d.Count == 1 {
			b.WriteString("Une nouvelle alerte")
		} else {
			fmt.Fprintf(&b, "%d nouvelles alertes", d.Count)
		}
		fmt.Fprintf(&b, " — relevé du %s\n\n", d.Date)
	} else {
		if d.Count == 1 {
			b.WriteString("A new alert")
		} else {
			fmt.Fprintf(&b, "%d new alerts", d.Count)
		}
		fmt.Fprintf(&b, " — poll of %s\n\n", d.Date)
	}
	for _, a := range d.Alerts {
		fmt.Fprintf(&b, "%s (%s) — %s\n", a.Miner, a.IP, a.Title)
		if a.Detail != "" {
			fmt.Fprintf(&b, "%s\n", a.Detail)
		}
		b.WriteString("\n")
	}
	switch {
	case d.AlertsURL != "" && lang == "fr":
		fmt.Fprintf(&b, "Voir les alertes : %s\n", d.AlertsURL)
	case d.AlertsURL != "":
		fmt.Fprintf(&b, "See the alerts: %s\n", d.AlertsURL)
	case d.DashboardURL != "" && lang == "fr":
		fmt.Fprintf(&b, "Dashboard : %s\n", d.DashboardURL)
	case d.DashboardURL != "":
		fmt.Fprintf(&b, "Dashboard: %s\n", d.DashboardURL)
	}
	return b.String()
}
