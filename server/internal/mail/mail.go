// Package mail sends the dashboard's mails over SMTP -- standard library
// only.
package mail

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/tls"
	"encoding/hex"
	"fmt"
	"mime"
	"mime/quotedprintable"
	"net"
	"net/smtp"
	"strconv"
	"strings"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
)

// Timeout bounds one whole send, connection included: a wrong host or a
// silent firewall must fail the request, never hang it.
const Timeout = 15 * time.Second

// Message is one plain-text mail.
type Message struct {
	To      []string
	Subject string
	Text    string
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
// non-ASCII (accents) and a quoted-printable body, so it survives any
// server whatever the text holds.
func build(from string, msg Message, now time.Time) []byte {
	var b bytes.Buffer
	header := func(k, v string) { fmt.Fprintf(&b, "%s: %s\r\n", k, v) }

	header("From", from)
	header("To", strings.Join(msg.To, ", "))
	header("Subject", mime.QEncoding.Encode("utf-8", msg.Subject))
	header("Date", now.Format(time.RFC1123Z))
	header("Message-ID", messageID(from))
	header("MIME-Version", "1.0")
	header("Content-Type", "text/plain; charset=utf-8")
	header("Content-Transfer-Encoding", "quoted-printable")
	b.WriteString("\r\n")

	qp := quotedprintable.NewWriter(&b)
	_, _ = qp.Write([]byte(strings.ReplaceAll(msg.Text, "\n", "\r\n")))
	_ = qp.Close()
	return b.Bytes()
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
