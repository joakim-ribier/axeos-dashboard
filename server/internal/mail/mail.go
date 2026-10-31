// Package mail sends the dashboard's mails over SMTP -- standard library
// only.
package mail

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/tls"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"mime/quotedprintable"
	"net"
	"net/smtp"
	"net/textproto"
	"strconv"
	"strings"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
)

// Timeout bounds one whole send, connection included: a wrong host or a
// silent firewall must fail the request, never hang it.
const Timeout = 15 * time.Second

// Message is one mail: its text, and an HTML version of it when HTML is
// set -- the text then being what a client that doesn't show HTML reads.
type Message struct {
	To      []string
	Subject string
	Text    string
	HTML    string
	// Inline are the images the HTML shows by "cid:" + their ID (a logo):
	// carried in the mail itself, so they show wherever it's read.
	Inline []Inline
}

// Inline is an image carried in the mail.
type Inline struct {
	ID          string
	ContentType string
	Data        []byte
}

// Send delivers msg through the SMTP server s describes.
func Send(ctx context.Context, s config.SMTPConfig, msg Message) error {
	if !s.Configured() {
		return fmt.Errorf("SMTP server not configured")
	}
	if len(msg.To) == 0 {
		return fmt.Errorf("no recipient")
	}

	ctx, cancel := context.WithTimeout(ctx, Timeout)
	defer cancel()

	addr := net.JoinHostPort(s.Host, strconv.Itoa(s.Port))
	tlsConfig := &tls.Config{ServerName: s.Host, MinVersion: tls.VersionTLS12}

	var conn net.Conn
	var err error
	dialer := &net.Dialer{}
	if s.Security == config.SMTPTLS {
		conn, err = (&tls.Dialer{NetDialer: dialer, Config: tlsConfig}).DialContext(ctx, "tcp", addr)
	} else {
		conn, err = dialer.DialContext(ctx, "tcp", addr)
	}
	if err != nil {
		return fmt.Errorf("connect to %s: %w", addr, err)
	}
	if deadline, ok := ctx.Deadline(); ok {
		_ = conn.SetDeadline(deadline)
	}

	client, err := smtp.NewClient(conn, s.Host)
	if err != nil {
		_ = conn.Close()
		return fmt.Errorf("SMTP greeting from %s: %w", addr, err)
	}
	defer func() { _ = client.Close() }()

	if s.Security == config.SMTPStartTLS {
		if ok, _ := client.Extension("STARTTLS"); !ok {
			return fmt.Errorf("%s doesn't offer STARTTLS", addr)
		}
		if err := client.StartTLS(tlsConfig); err != nil {
			return fmt.Errorf("STARTTLS: %w", err)
		}
	}

	if s.Username != "" {
		// PlainAuth itself refuses to send the password over a connection
		// that isn't encrypted (unless the server is localhost).
		if err := client.Auth(smtp.PlainAuth("", s.Username, s.Password, s.Host)); err != nil {
			return fmt.Errorf("authentication: %w", err)
		}
	}

	if err := client.Mail(s.From); err != nil {
		return fmt.Errorf("sender %s: %w", s.From, err)
	}
	for _, to := range msg.To {
		if err := client.Rcpt(to); err != nil {
			return fmt.Errorf("recipient %s: %w", to, err)
		}
	}

	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("DATA: %w", err)
	}
	if _, err := w.Write(build(s.From, msg, time.Now())); err != nil {
		_ = w.Close()
		return fmt.Errorf("write message: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("message refused: %w", err)
	}
	return client.Quit()
}

// build renders msg as an RFC 5322 message: UTF-8 headers encoded for the
// non-ASCII (accents) and quoted-printable text, so it survives any server
// whatever the text holds. With HTML, the text and the HTML are the two
// alternatives of a multipart/alternative, the HTML and its images
// together in a multipart/related.
func build(from string, msg Message, now time.Time) []byte {
	var b bytes.Buffer
	header := func(k, v string) { fmt.Fprintf(&b, "%s: %s\r\n", k, v) }

	header("From", from)
	header("To", strings.Join(msg.To, ", "))
	header("Subject", mime.QEncoding.Encode("utf-8", msg.Subject))
	header("Date", now.Format(time.RFC1123Z))
	header("Message-ID", messageID(from))
	header("MIME-Version", "1.0")

	if msg.HTML == "" {
		header("Content-Type", "text/plain; charset=utf-8")
		header("Content-Transfer-Encoding", "quoted-printable")
		b.WriteString("\r\n")
		writeQP(&b, msg.Text)
		return b.Bytes()
	}

	alternative := multipart.NewWriter(&b)
	header("Content-Type", "multipart/alternative; boundary="+alternative.Boundary())
	b.WriteString("\r\n")

	text, _ := alternative.CreatePart(textproto.MIMEHeader{
		"Content-Type":              {"text/plain; charset=utf-8"},
		"Content-Transfer-Encoding": {"quoted-printable"},
	})
	writeQP(text, msg.Text)

	htmlHeader := textproto.MIMEHeader{
		"Content-Type":              {"text/html; charset=utf-8"},
		"Content-Transfer-Encoding": {"quoted-printable"},
	}
	if len(msg.Inline) == 0 {
		html, _ := alternative.CreatePart(htmlHeader)
		writeQP(html, msg.HTML)
		_ = alternative.Close()
		return b.Bytes()
	}

	var rel bytes.Buffer
	related := multipart.NewWriter(&rel)
	html, _ := related.CreatePart(htmlHeader)
	writeQP(html, msg.HTML)
	for _, img := range msg.Inline {
		part, _ := related.CreatePart(textproto.MIMEHeader{
			"Content-Type":              {img.ContentType},
			"Content-Transfer-Encoding": {"base64"},
			"Content-ID":                {"<" + img.ID + ">"},
			"Content-Disposition":       {"inline"},
		})
		writeBase64(part, img.Data)
	}
	_ = related.Close()
	part, _ := alternative.CreatePart(textproto.MIMEHeader{
		"Content-Type": {`multipart/related; type="text/html"; boundary=` + related.Boundary()},
	})
	_, _ = part.Write(rel.Bytes())
	_ = alternative.Close()
	return b.Bytes()
}

func writeQP(w io.Writer, s string) {
	qp := quotedprintable.NewWriter(w)
	_, _ = qp.Write([]byte(strings.ReplaceAll(s, "\n", "\r\n")))
	_ = qp.Close()
}

// writeBase64 writes data in base64, 76 characters a line as MIME wants.
func writeBase64(w io.Writer, data []byte) {
	encoded := base64.StdEncoding.EncodeToString(data)
	for len(encoded) > 76 {
		_, _ = io.WriteString(w, encoded[:76]+"\r\n")
		encoded = encoded[76:]
	}
	_, _ = io.WriteString(w, encoded+"\r\n")
}

func messageID(from string) string {
	domain := "axeos-dashboard"
	if at := strings.LastIndex(from, "@"); at >= 0 && at < len(from)-1 {
		domain = from[at+1:]
	}
	var id [12]byte
	_, _ = rand.Read(id[:])
	return "<" + hex.EncodeToString(id[:]) + "@" + domain + ">"
}
