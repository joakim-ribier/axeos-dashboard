package mailtemplate

import (
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

func write(t *testing.T, dir, name, content string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestLoad_builtInWithoutAFile(t *testing.T) {
	for _, dir := range []string{"", t.TempDir()} {
		tmpl, err := Load(dir, TestMail, "fr")
		if err != nil || tmpl.Subject != "AxeOS Dashboard — mail de test" {
			t.Errorf("dir %q: Load() = %+v, %v; want the built-in French one", dir, tmpl, err)
		}
	}
}

func TestLoad_englishForAnyOtherLanguage(t *testing.T) {
	for _, lang := range []string{"en", "de", ""} {
		tmpl, err := Load("", TestMail, lang)
		if err != nil || tmpl.Subject != "AxeOS Dashboard — test mail" {
			t.Errorf("lang %q: Load() = %+v, %v; want the English one", lang, tmpl, err)
		}
	}
}

func TestLoad_theOperatorsFile(t *testing.T) {
	dir := t.TempDir()
	write(t, dir, "test-mail.fr.txt", "# my own\nSubject: Coucou {{date}}\n\nÇa marche.\n")

	tmpl, err := Load(dir, TestMail, "fr")

	if err != nil {
		t.Fatal(err)
	}
	if tmpl.Subject != "Coucou {{date}}" || tmpl.Body != "Ça marche.\n" {
		t.Errorf("Load() = %+v, want the file's own", tmpl)
	}
	// The other language still has no file: built-in.
	if en, _ := Load(dir, TestMail, "en"); en.Subject != "AxeOS Dashboard — test mail" {
		t.Errorf("en = %+v, want the built-in one", en)
	}
}

func TestLoad_aBrokenFileFallsBackToTheBuiltIn(t *testing.T) {
	dir := t.TempDir()
	write(t, dir, "test-mail.fr.txt", "Objet : oublié le Subject\n\nTexte\n")

	tmpl, err := Load(dir, TestMail, "fr")

	if err == nil || !strings.Contains(err.Error(), "test-mail.fr.txt") {
		t.Errorf("err = %v, want one naming the file", err)
	}
	if tmpl.Subject != "AxeOS Dashboard — mail de test" {
		t.Errorf("Load() = %+v, want the built-in one still", tmpl)
	}
}

func TestInstall_writesWhatsMissingAndKeepsTheRest(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "mail-templates")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	edited := "Subject: mine\n\nmine\n"
	write(t, dir, "test-mail.fr.txt", edited)

	written, err := Install(dir)

	if err != nil {
		t.Fatal(err)
	}
	slices.Sort(written)
	want := []string{"audit-report.en.txt", "audit-report.fr.txt", "test-mail.en.txt"}
	if !slices.Equal(written, want) {
		t.Errorf("written = %v, want %v", written, want)
	}
	if got, _ := os.ReadFile(filepath.Join(dir, "test-mail.fr.txt")); string(got) != edited {
		t.Errorf("edited file = %q, want it untouched", got)
	}

	// Once everything's there: nothing more.
	if written, err := Install(dir); err != nil || len(written) != 0 {
		t.Errorf("second Install() = %v, %v; want nothing written", written, err)
	}
}

func TestInstall_createsTheFolder(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "config", "mail-templates")

	if _, err := Install(dir); err != nil {
		t.Fatal(err)
	}
	if entries, _ := os.ReadDir(dir); len(entries) != 4 {
		t.Errorf("got %d files, want the 4 templates", len(entries))
	}
}

func TestParse(t *testing.T) {
	tmpl, err := parse("# a comment\r\n\r\n# another\r\nSubject:   Hello  \r\n\r\nLine 1\r\n# not in the mail\r\nLine 2\r\n\r\n")
	if err != nil {
		t.Fatal(err)
	}
	if tmpl.Subject != "Hello" || tmpl.Body != "Line 1\nLine 2\n" {
		t.Errorf("parse() = %+v", tmpl)
	}

	for _, bad := range []string{"", "# only comments\n", "Hello\n\nno subject\n"} {
		if _, err := parse(bad); err == nil {
			t.Errorf("parse(%q) = no error, want one", bad)
		}
	}
}

func TestRender(t *testing.T) {
	tmpl := Template{
		Subject: "Audit {{ title }}: {{count}}",
		Body:    "{{title}} — {{count}}\n\nSent on {{date}}.\nOpen: {{link}}\nTypo: {{dte}}\n",
	}

	subject, body := tmpl.Render(map[string]string{
		"title": "Thursday", "count": "3 events", "date": "2026-10-16 01:00", "link": "",
	})

	if subject != "Audit Thursday: 3 events" {
		t.Errorf("subject = %q", subject)
	}
	// The link's line is gone (empty), the typo kept as typed.
	want := "Thursday — 3 events\n\nSent on 2026-10-16 01:00.\nTypo: {{dte}}\n"
	if body != want {
		t.Errorf("body = %q, want %q", body, want)
	}
}

// Every built-in template parses, and only uses the placeholders its mail
// fills -- the ones its own comments list.
func TestBuiltInTemplates(t *testing.T) {
	filled := map[string][]string{
		TestMail:    {"server", "security", "from", "to", "date", "dashboardURL"},
		AuditReport: {"title", "count", "events", "periodStart", "periodEnd", "link", "date", "sentTo"},
	}
	files, err := fs.ReadDir(builtin, "templates")
	if err != nil {
		t.Fatal(err)
	}
	if len(files) != 4 {
		t.Errorf("got %d built-in templates, want 4", len(files))
	}
	for name, keys := range filled {
		for _, lang := range []string{"fr", "en"} {
			tmpl, err := Load("", name, lang)
			if err != nil {
				t.Fatalf("%s.%s: %v", name, lang, err)
			}
			values := map[string]string{}
			for _, k := range keys {
				values[k] = "x"
			}
			subject, body := tmpl.Render(values)
			if strings.Contains(subject+body, "{{") {
				t.Errorf("%s.%s: a placeholder its mail doesn't fill:\n%s\n%s", name, lang, subject, body)
			}
			data, _ := fs.ReadFile(builtin, "templates/"+fileName(name, lang))
			for _, k := range keys {
				if !strings.Contains(string(data), "#   {{"+k+"}}") {
					t.Errorf("%s.%s: {{%s}} isn't listed in its comments", name, lang, k)
				}
			}
		}
	}
}
