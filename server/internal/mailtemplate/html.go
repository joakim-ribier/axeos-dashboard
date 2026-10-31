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
)

// The mails there's an HTML template of.
const (
	Alert       = "alert"
	AuditReport = "audit-report"
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
	if lang != "fr" {
		lang = "en"
	}
	file := name + "." + lang + ".html"

	if dir != "" {
		src, readErr := os.ReadFile(filepath.Join(dir, file))
		switch {
		case errors.Is(readErr, fs.ErrNotExist):
		case readErr != nil:
			err = fmt.Errorf("template %s: %w", file, readErr)
		default:
			subject, body, err = render(string(src), data)
			if err == nil {
				return subject, body, nil
			}
			err = fmt.Errorf("template %s: %w", filepath.Join(dir, file), err)
		}
	}

	src, readErr := fs.ReadFile(builtin, "templates/"+file)
	if readErr != nil {
		return "", "", errors.Join(err, fmt.Errorf("no built-in template %s: %w", file, readErr))
	}
	subject, body, builtinErr := render(string(src), data)
	return subject, body, errors.Join(err, builtinErr)
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
