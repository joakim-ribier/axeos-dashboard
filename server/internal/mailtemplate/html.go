package mailtemplate

import (
	"bytes"
	_ "embed"
	"errors"
	"fmt"
	"html"
	"html/template"
	"io/fs"
	"net"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	texttemplate "text/template"
)

// The mails there's an HTML template of.
const (
	Alert        = "alert"
	AuditReport  = "audit-report"
	RemoteAction = "remote-action"
)

// Logo is the app's icon, shown in an HTML mail's header as "cid:logo".
//
//go:embed logo.png
var Logo []byte

// Linkable reports whether the dashboard's address can be a link in a mail:
// a link to a bare IP address (http://192.168.1.60) -- even written out as
// text, which Gmail turns into one -- gets the mail filed as spam. Only a
// name can then show in the HTML.
func Linkable(address string) bool {
	u, err := url.Parse(address)
	if err != nil || u.Hostname() == "" {
		return false
	}
	return net.ParseIP(u.Hostname()) == nil && u.Hostname() != "localhost"
}

var titlePattern = regexp.MustCompile(`(?is)<title>(.*?)</title>`)

// RenderHTML is name's HTML template in lang ("fr" or "en", English
// otherwise) filled with data: the mail's subject (its <title>) and its
// HTML. The file in dir is used if there's one; if it can't be read,
// parsed or filled, the built-in template is used instead -- with the
// error, to be logged: the mail still goes out.
func RenderHTML(dir, name, lang string, data any) (subject, body string, err error) {
	err = withFallback(dir, name, lang, ".html", func(src string) (renderErr error) {
		subject, body, renderErr = render(src, data)
		return renderErr
	})
	return subject, body, err
}

// RenderText is RenderHTML for a mail's text version: name's .txt template,
// a Go text/template.
func RenderText(dir, name, lang string, data any) (body string, err error) {
	err = withFallback(dir, name, lang, ".txt", func(src string) error {
		t, err := texttemplate.New("mail").Option("missingkey=error").Parse(src)
		if err != nil {
			return err
		}
		var out bytes.Buffer
		if err := t.Execute(&out, data); err != nil {
			return err
		}
		body = out.String()
		return nil
	})
	return body, err
}

// withFallback fills the file in dir if there's one, the built-in one if
// that can't be done.
func withFallback(dir, name, lang, ext string, fill func(src string) error) error {
	if lang != "fr" {
		lang = "en"
	}
	file := name + "." + lang + ext

	var err error
	if dir != "" {
		src, readErr := os.ReadFile(filepath.Join(dir, file))
		switch {
		case errors.Is(readErr, fs.ErrNotExist):
		case readErr != nil:
			err = fmt.Errorf("template %s: %w", file, readErr)
		default:
			if err = fill(string(src)); err == nil {
				return nil
			}
			err = fmt.Errorf("template %s: %w", filepath.Join(dir, file), err)
		}
	}

	src, readErr := fs.ReadFile(builtin, "templates/"+file)
	if readErr != nil {
		return errors.Join(err, fmt.Errorf("no built-in template %s: %w", file, readErr))
	}
	return errors.Join(err, fill(string(src)))
}

func render(src string, data any) (subject, body string, err error) {
	t, err := template.New("mail").Option("missingkey=error").Parse(src)
	if err != nil {
		return "", "", err
	}
	var out bytes.Buffer
	if err := t.Execute(&out, data); err != nil {
		return "", "", err
	}
	body = out.String()
	m := titlePattern.FindStringSubmatch(body)
	if m == nil {
		return "", "", errors.New("no <title> -- it's the mail's subject")
	}
	return strings.Join(strings.Fields(html.UnescapeString(m[1])), " "), body, nil
}
