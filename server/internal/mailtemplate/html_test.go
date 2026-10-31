package mailtemplate

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestRenderHTML(t *testing.T) {
	data := struct {
		Count int
		Name  string
	}{2, "<b>office</b>"}
	dir := t.TempDir()
	write := func(content string) {
		t.Helper()
		if err := os.WriteFile(filepath.Join(dir, "x.fr.html"), []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
	}

	write("{{/* a comment */ -}}\n<title>\n  {{.Count}} &amp; co\n</title><p>{{.Name}}</p>")
	subject, body, err := RenderHTML(dir, "x", "fr", data)
	if err != nil {
		t.Fatal(err)
	}
	if subject != "2 & co" {
		t.Errorf("subject = %q, want the <title>, unescaped and on one line", subject)
	}
	if !strings.HasPrefix(body, "<title>") || !strings.Contains(body, "&lt;b&gt;office&lt;/b&gt;") {
		t.Errorf("body = %q, want the comment gone and the value escaped", body)
	}

	// No <title>, and no built-in template to fall back on: an error.
	write("<p>{{.Count}}</p>")
	if _, _, err := RenderHTML(dir, "x", "fr", data); err == nil || !strings.Contains(err.Error(), "<title>") {
		t.Errorf("err = %v, want the missing <title> reported", err)
	}
}

func TestRenderHTML_builtIn(t *testing.T) {
	for _, lang := range []string{"fr", "en", "de"} {
		// No file in the folder: the built-in one, quietly.
		subject, body, err := RenderHTML(t.TempDir(), Alert, lang, struct {
			Count              int
			Date, DashboardURL string
			AlertsURL          string
			Alerts             []struct{ Miner, IP, Title, Detail, Color string }
		}{Count: 2, Date: "now"})
		if err != nil || !strings.Contains(subject, "2") || !strings.Contains(body, "cid:logo") {
			t.Errorf("%s: subject %q, err %v", lang, subject, err)
		}
	}
}
