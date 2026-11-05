package remoteactionmail

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
)

var at = time.Date(2026, 11, 5, 9, 12, 0, 0, time.UTC)

func settings(lang string) config.NotificationsConfig {
	return config.NotificationsConfig{Language: lang, DashboardURL: "https://axeos.example.com/"}
}

func TestBuild_everyActionAndOutcome_inEachLanguage(t *testing.T) {
	cases := []struct {
		lang, action, status, subject, date string
	}{
		{"fr", "restart", "done", "m1 : Redémarrage depuis le board — Effectuée", "05/11/2026 à 09:12 (UTC)"},
		{"fr", "switch_primary", "failed", "m1 : Bascule vers le pool principal depuis le board — Échouée", "05/11/2026 à 09:12 (UTC)"},
		{"fr", "switch_fallback", "rejected", "m1 : Bascule vers le pool de secours depuis le board — Refusée par le dashboard", "05/11/2026 à 09:12 (UTC)"},
		{"en", "restart", "done", "m1: Restart from the board — Done", "2026-11-05 09:12 (UTC)"},
		{"en", "switch_primary", "failed", "m1: Switch to the primary pool from the board — Failed", "2026-11-05 09:12 (UTC)"},
		{"en", "switch_fallback", "rejected", "m1: Switch to the fallback pool from the board — Refused by the dashboard", "2026-11-05 09:12 (UTC)"},
	}
	for _, c := range cases {
		msg, err := Build(settings(c.lang), Event{Action: c.action, Miner: "m1", Status: c.status, At: at}, "")
		if err != nil {
			t.Fatalf("%s %s: %v", c.lang, c.action, err)
		}
		if msg.Subject != c.subject {
			t.Errorf("subject = %q, want %q", msg.Subject, c.subject)
		}
		for name, body := range map[string]string{"html": msg.HTML, "text": msg.Text} {
			if !strings.Contains(body, c.date) || !strings.Contains(body, "m1") {
				t.Errorf("%s %s: %s lacks the date or the miner:\n%s", c.lang, c.action, name, body)
			}
			if !strings.Contains(body, "https://axeos.example.com/audit") {
				t.Errorf("%s: %s lacks the Audit link", c.lang, name)
			}
		}
	}
}

func TestBuild_textVersion(t *testing.T) {
	msg, err := Build(settings("fr"), Event{Action: "restart", Miner: "m1", Status: "done", At: at}, "")
	if err != nil {
		t.Fatal(err)
	}
	want := "Action à distance — 05/11/2026 à 09:12 (UTC)\n\nm1 : Redémarrage\nEffectuée\n\nhttps://axeos.example.com/audit\n"
	if msg.Text != want {
		t.Errorf("text = %q, want %q", msg.Text, want)
	}
}

func TestBuild_theExampleSaysItIsOne(t *testing.T) {
	for lang, notice := range map[string]string{"fr": "aucune action n'a été exécutée", "en": "no action was done"} {
		msg, err := Build(settings(lang), Sample(at), "")
		if err != nil {
			t.Fatal(err)
		}
		if !strings.HasPrefix(msg.Subject, "Test ") {
			t.Errorf("%s: subject = %q", lang, msg.Subject)
		}
		if !strings.Contains(msg.Text, notice) {
			t.Errorf("%s: text lacks the notice:\n%s", lang, msg.Text)
		}
		if !strings.Contains(strings.ReplaceAll(msg.HTML, "&#39;", "'"), notice) {
			t.Errorf("%s: HTML lacks the notice", lang)
		}
	}

	msg, _ := Build(settings("fr"), Event{Action: "restart", Miner: "m1", Status: "done", At: at}, "")
	if strings.Contains(msg.Text, "aucune action") || strings.Contains(msg.Subject, "Test") {
		t.Errorf("a real action reads as a test:\n%s", msg.Text)
	}
}

func TestBuild_aBrokenTextTemplateFallsBack(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "remote-action.fr.txt"), []byte("{{.Nope}}"), 0o644); err != nil {
		t.Fatal(err)
	}
	msg, err := Build(settings("fr"), Event{Action: "restart", Miner: "m1", Status: "done", At: at}, dir)
	if err == nil {
		t.Error("the broken template isn't reported")
	}
	if !strings.Contains(msg.Text, "m1 : Redémarrage") {
		t.Errorf("text = %q, want the built-in one", msg.Text)
	}
}

func TestBuild_anEditedTextTemplateIsUsed(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "remote-action.fr.txt"), []byte("Coucou {{.Miner}}"), 0o644); err != nil {
		t.Fatal(err)
	}
	msg, err := Build(settings("fr"), Event{Action: "restart", Miner: "m1", Status: "done", At: at}, dir)
	if err != nil || msg.Text != "Coucou m1" {
		t.Errorf("text = %q, err = %v", msg.Text, err)
	}
}
