// Package mailtemplate is the wording of the mailer's mails, in files the
// operator can edit: plain text ones -- a "Subject:" line, a blank line, the
// text, {{name}} placeholders replaced when the mail is sent -- and HTML
// ones, Go templates whose <title> is the subject (see RenderHTML).
package mailtemplate

import (
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

//go:embed templates/*.txt templates/*.html
var builtin embed.FS

// TestMail is the test mail -- the plain text one.
const TestMail = "test-mail"

// Template is one mail's wording: its subject and its text.
type Template struct {
	Subject, Body string
}

// Load is name's template in lang ("fr" or "en", English otherwise): the
// file in dir if there's one, the built-in one otherwise. A file that
// can't be read or parsed falls back to the built-in template too -- with
// the error, to be logged: a mail still goes out.
func Load(dir, name, lang string) (Template, error) {
	if lang != "fr" {
		lang = "en"
	}
	file := fileName(name, lang)
	data, err := fs.ReadFile(builtin, "templates/"+file)
	if err != nil {
		return Template{}, fmt.Errorf("no built-in template %s: %w", file, err)
	}
	fallback, err := parse(string(data))
	if err != nil {
		return Template{}, fmt.Errorf("built-in template %s: %w", file, err)
	}
	if dir == "" {
		return fallback, nil
	}

	data, err = os.ReadFile(filepath.Join(dir, file))
	if errors.Is(err, fs.ErrNotExist) {
		return fallback, nil
	}
	if err != nil {
		return fallback, fmt.Errorf("template %s: %w", file, err)
	}
	t, err := parse(string(data))
	if err != nil {
		return fallback, fmt.Errorf("template %s: %w", filepath.Join(dir, file), err)
	}
	return t, nil
}

// Install writes into dir every built-in template it doesn't have yet --
// for the operator to edit. A file already there, edited or not, is kept.
func Install(dir string) ([]string, error) {
	entries, err := fs.ReadDir(builtin, "templates")
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	var written []string
	for _, e := range entries {
		path := filepath.Join(dir, e.Name())
		if _, err := os.Stat(path); err == nil {
			continue
		}
		data, err := fs.ReadFile(builtin, "templates/"+e.Name())
		if err != nil {
			return written, err
		}
		if err := os.WriteFile(path, data, 0o644); err != nil {
			return written, err
		}
		written = append(written, e.Name())
	}
	return written, nil
}

func fileName(name, lang string) string {
	return name + "." + lang + ".txt"
}

// parse reads a template: "#" lines are comments, the first other line is
// "Subject: ...", then the text.
func parse(s string) (Template, error) {
	var lines []string
	for _, line := range strings.Split(strings.ReplaceAll(s, "\r\n", "\n"), "\n") {
		if !strings.HasPrefix(line, "#") {
			lines = append(lines, line)
		}
	}
	for len(lines) > 0 && strings.TrimSpace(lines[0]) == "" {
		lines = lines[1:]
	}
	if len(lines) == 0 {
		return Template{}, errors.New(`empty -- want a "Subject:" line, a blank line, then the text`)
	}
	subject, ok := strings.CutPrefix(lines[0], "Subject:")
	if !ok {
		return Template{}, fmt.Errorf(`first line %q isn't "Subject: ..."`, lines[0])
	}
	return Template{
		Subject: strings.TrimSpace(subject),
		Body:    strings.Trim(strings.Join(lines[1:], "\n"), "\n") + "\n",
	}, nil
}

var placeholder = regexp.MustCompile(`\{\{\s*(\w+)\s*\}\}`)

// Render is the mail's subject and text, every {{name}} of values replaced
// -- a line holding one whose value is empty dropped altogether (the link,
// with no dashboard address set), an unknown one left as is (a typo then
// shows in the mail rather than vanishing).
func (t Template) Render(values map[string]string) (subject, body string) {
	replace := func(s string) string {
		return placeholder.ReplaceAllStringFunc(s, func(m string) string {
			if v, ok := values[placeholder.FindStringSubmatch(m)[1]]; ok {
				return v
			}
			return m
		})
	}
	empty := func(line string) bool {
		for _, m := range placeholder.FindAllStringSubmatch(line, -1) {
			if v, ok := values[m[1]]; ok && v == "" {
				return true
			}
		}
		return false
	}

	var out []string
	for _, line := range strings.Split(t.Body, "\n") {
		if !empty(line) {
			out = append(out, replace(line))
		}
	}
	return replace(t.Subject), strings.Join(out, "\n")
}
