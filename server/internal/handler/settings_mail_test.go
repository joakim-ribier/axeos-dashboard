package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/alertmail"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
)

var storedSMTP = config.SMTPConfig{
	Host:     "smtp.example.com",
	Port:     587,
	Security: config.SMTPStartTLS,
	Username: "axeos",
	Password: "s3cret",
	From:     "axeos@example.com",
}

// saveSettingsOver saves next over a settings.yml that held before -- what
// the router does on every POST /api/config/settings.
func saveSettingsOver(t *testing.T, before, next config.AppSettingsFile) (*httptest.ResponseRecorder, config.AppSettingsFile, bool) {
	t.Helper()
	dir := t.TempDir()
	cfg := config.Config{
		AppSettingsFilePath: filepath.Join(dir, "settings.yml"),
		Storage:             config.StorageConfig{DataDir: dir},
	}
	payload, err := json.Marshal(next)
	if err != nil {
		t.Fatalf("marshal request body: %v", err)
	}
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPost, "/api/config/settings", bytes.NewReader(payload))
	saved, ok := SaveAppSettings(cfg, before, w, r)
	return w, saved, ok
}

func withSMTP(smtp config.SMTPConfig, to ...string) config.AppSettingsFile {
	return config.AppSettingsFile{Notifications: config.NotificationsConfig{Mail: config.MailConfig{SMTP: smtp, To: to}}}
}

// Every section's save sends the whole file, and the client never has the
// password: a save without one must keep it.
func TestSaveAppSettings_keepsTheSMTPPasswordWhenNoneIsSent(t *testing.T) {
	next := storedSMTP
	next.Password = ""

	w, saved, ok := saveSettingsOver(t, withSMTP(storedSMTP), withSMTP(next))

	if !ok {
		t.Fatalf("SaveAppSettings() failed: %d %s", w.Code, w.Body.String())
	}
	if saved.Notifications.Mail.SMTP.Password != "s3cret" {
		t.Errorf("password = %q, want the stored one kept", saved.Notifications.Mail.SMTP.Password)
	}
}

func TestSaveAppSettings_replacesTheSMTPPasswordWhenOneIsSent(t *testing.T) {
	next := storedSMTP
	next.Password = "n3w"

	_, saved, ok := saveSettingsOver(t, withSMTP(storedSMTP), withSMTP(next))

	if !ok || saved.Notifications.Mail.SMTP.Password != "n3w" {
		t.Errorf("password = %q (ok %v), want the new one", saved.Notifications.Mail.SMTP.Password, ok)
	}
}

func TestSaveAppSettings_clearingTheSMTPServerDropsThePasswordToo(t *testing.T) {
	next := config.SMTPConfig{Host: "  ", Username: "axeos", From: "axeos@example.com"}

	_, saved, ok := saveSettingsOver(t, withSMTP(storedSMTP, "me@example.com"), withSMTP(next, "me@example.com"))

	if !ok {
		t.Fatal("SaveAppSettings() ok = false, want true")
	}
	if saved.Notifications.Mail.SMTP != (config.SMTPConfig{}) {
		t.Errorf("smtp = %+v, want it cleared entirely", saved.Notifications.Mail.SMTP)
	}
	if len(saved.Notifications.Mail.To) != 1 {
		t.Errorf("recipients = %v, want them kept", saved.Notifications.Mail.To)
	}
}

func TestSaveAppSettings_mailValidation(t *testing.T) {
	tests := []struct {
		name string
		mail config.MailConfig
	}{
		{"port out of range", config.MailConfig{SMTP: config.SMTPConfig{Host: "smtp.example.com", Port: 70000, Security: config.SMTPTLS, From: "a@example.com"}}},
		{"no port", config.MailConfig{SMTP: config.SMTPConfig{Host: "smtp.example.com", Security: config.SMTPTLS, From: "a@example.com"}}},
		{"unknown security", config.MailConfig{SMTP: config.SMTPConfig{Host: "smtp.example.com", Port: 587, Security: "ssl", From: "a@example.com"}}},
		{"invalid sender", config.MailConfig{SMTP: config.SMTPConfig{Host: "smtp.example.com", Port: 587, Security: config.SMTPStartTLS, From: "not an address"}}},
		{"invalid recipient", config.MailConfig{To: []string{"me@example.com", "nope"}}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w, _, ok := saveSettingsOver(t, config.AppSettingsFile{}, config.AppSettingsFile{Notifications: config.NotificationsConfig{Mail: tt.mail}})
			if ok || w.Code != http.StatusBadRequest {
				t.Errorf("ok = %v, status = %d, want a 400", ok, w.Code)
			}
		})
	}
}

func TestSaveAppSettings_notificationsValidation(t *testing.T) {
	tests := []struct {
		name string
		n    config.NotificationsConfig
	}{
		{"dashboard address without a scheme", config.NotificationsConfig{DashboardURL: "192.168.1.60"}},
		{"dashboard address not http(s)", config.NotificationsConfig{DashboardURL: "ftp://192.168.1.60"}},
		{"unknown language", config.NotificationsConfig{Language: "de"}},
		{"unknown frequency", config.NotificationsConfig{AuditReport: config.AuditReportConfig{Frequency: "hourly"}}},
		{"unknown audit type", config.NotificationsConfig{AuditReport: config.AuditReportConfig{Types: []string{"reboot"}}}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w, _, ok := saveSettingsOver(t, config.AppSettingsFile{}, config.AppSettingsFile{Notifications: tt.n})
			if ok || w.Code != http.StatusBadRequest {
				t.Errorf("ok = %v, status = %d, want a 400", ok, w.Code)
			}
		})
	}

	valid := config.NotificationsConfig{
		Language:     "fr",
		DashboardURL: "http://192.168.1.60",
		AuditReport:  config.AuditReportConfig{Enabled: true, Frequency: config.ReportWeekly, Types: []string{"restart"}},
	}
	if w, _, ok := saveSettingsOver(t, config.AppSettingsFile{}, config.AppSettingsFile{Notifications: valid}); !ok {
		t.Errorf("a valid setup refused: %d %s", w.Code, w.Body.String())
	}
}

func TestSaveAppSettings_noSMTPServerIsValid(t *testing.T) {
	_, _, ok := saveSettingsOver(t, config.AppSettingsFile{}, config.AppSettingsFile{})
	if !ok {
		t.Error("an empty mail config (mail off) must save")
	}
}

func TestGetAppSettings_neverReturnsTheSMTPPassword(t *testing.T) {
	dir := t.TempDir()
	cfg := config.Config{Storage: config.StorageConfig{DataDir: dir}}
	w := httptest.NewRecorder()

	GetAppSettings(cfg, withSMTP(storedSMTP, "me@example.com"), w, httptest.NewRequest(http.MethodGet, "/api/config/settings", nil))

	body := w.Body.String()
	if strings.Contains(body, "s3cret") {
		t.Fatalf("the password leaked into the response: %s", body)
	}
	var resp struct {
		Notifications struct {
			Mail map[string]json.RawMessage `json:"mail"`
		} `json:"notifications"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	var smtp map[string]any
	if err := json.Unmarshal(resp.Notifications.Mail["smtp"], &smtp); err != nil {
		t.Fatal(err)
	}
	if _, has := smtp["password"]; has {
		t.Error("the smtp object has a password field at all")
	}
	if smtp["passwordSet"] != true || smtp["host"] != "smtp.example.com" {
		t.Errorf("smtp = %v, want the server shown with passwordSet: true", smtp)
	}
}

func TestGetAppSettings_alertsMail(t *testing.T) {
	dir := t.TempDir()
	cfg := config.Config{Storage: config.StorageConfig{DataDir: dir}}
	if err := alertmail.Save(cfg.Storage.MailDir(), alertmail.State{LastError: "535 bad credentials"}); err != nil {
		t.Fatal(err)
	}
	settings := withSMTP(storedSMTP, "me@example.com")
	settings.Notifications.Alerts.Mail = true
	w := httptest.NewRecorder()

	GetAppSettings(cfg, settings, w, httptest.NewRequest(http.MethodGet, "/api/config/settings", nil))

	var resp struct {
		Notifications struct {
			Alerts config.AlertsConfig `json:"alerts"`
		} `json:"notifications"`
		ReadOnly struct {
			AlertsMail alertsMailStatus `json:"alertsMail"`
		} `json:"readOnly"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if !resp.Notifications.Alerts.Mail || resp.ReadOnly.AlertsMail.LastError != "535 bad credentials" {
		t.Errorf("got %+v, want the switch on and the mailer's last error", resp)
	}
}
