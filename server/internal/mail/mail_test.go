package mail

import (
	"context"
	"io"
	"mime"
	"mime/quotedprintable"
	"net/mail"
	"strings"
	"testing"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/mail/mailtest"
)

func plainSMTP(server *mailtest.Server) config.SMTPConfig {
	return config.SMTPConfig{
		Host:     server.Host,
		Port:     server.Port,
		Security: config.SMTPNone,
		From:     "axeos@example.com",
	}
}

func TestSend_deliversTheMessage(t *testing.T) {
	server := mailtest.NewServer(t)

	err := Send(context.Background(), plainSMTP(server), Message{
		To:      []string{"me@example.com", "you@example.com"},
		Subject: "Mineur hors ligne — bitaxe-1",
		Text:    "Le mineur ne répond plus.\nDepuis 03:12.",
	})
	if err != nil {
		t.Fatalf("Send() error = %v", err)
	}

	got := server.Next(t)
	if got.From != "axeos@example.com" {
		t.Errorf("MAIL FROM = %q, want axeos@example.com", got.From)
	}
	if strings.Join(got.To, ",") != "me@example.com,you@example.com" {
		t.Errorf("RCPT TO = %v, want both recipients", got.To)
	}

	msg, err := mail.ReadMessage(strings.NewReader(got.Data))
	if err != nil {
		t.Fatalf("parse message: %v", err)
	}
	subject, err := new(mime.WordDecoder).DecodeHeader(msg.Header.Get("Subject"))
	if err != nil || subject != "Mineur hors ligne — bitaxe-1" {
		t.Errorf("Subject = %q (err %v), want the accented subject back", subject, err)
	}
	body, err := io.ReadAll(quotedprintable.NewReader(msg.Body))
	if err != nil {
		t.Fatalf("decode body: %v", err)
	}
	// SMTP's end-of-data adds the final line break.
	if want := "Le mineur ne répond plus.\r\nDepuis 03:12."; strings.TrimRight(string(body), "\r\n") != want {
		t.Errorf("body = %q, want %q", body, want)
	}
	if ct := msg.Header.Get("Content-Type"); ct != "text/plain; charset=utf-8" {
		t.Errorf("Content-Type = %q", ct)
	}
}

func TestSend_refusesWithoutServerOrRecipient(t *testing.T) {
	server := mailtest.NewServer(t)

	if err := Send(context.Background(), config.SMTPConfig{}, Message{To: []string{"me@example.com"}}); err == nil {
		t.Error("no SMTP server: want an error")
	}
	if err := Send(context.Background(), plainSMTP(server), Message{}); err == nil {
		t.Error("no recipient: want an error")
	}
}

func TestSend_requiresSTARTTLSWhenAskedFor(t *testing.T) {
	server := mailtest.NewServer(t)
	smtp := plainSMTP(server)
	smtp.Security = config.SMTPStartTLS

	err := Send(context.Background(), smtp, Message{To: []string{"me@example.com"}, Subject: "x", Text: "x"})
	if err == nil || !strings.Contains(err.Error(), "STARTTLS") {
		t.Errorf("Send() error = %v, want it to say STARTTLS isn't offered", err)
	}
}

func TestSend_reportsARefusedRecipient(t *testing.T) {
	server := mailtest.NewServer(t, "nobody@example.com")

	err := Send(context.Background(), plainSMTP(server), Message{To: []string{"nobody@example.com"}, Subject: "x", Text: "x"})
	if err == nil || !strings.Contains(err.Error(), "nobody@example.com") {
		t.Errorf("Send() error = %v, want it to name the refused recipient", err)
	}
}

func TestSend_failsFastOnAnUnreachableServer(t *testing.T) {
	smtp := config.SMTPConfig{Host: "127.0.0.1", Port: 1, Security: config.SMTPNone, From: "axeos@example.com"}

	if err := Send(context.Background(), smtp, Message{To: []string{"me@example.com"}}); err == nil {
		t.Error("Send() to a closed port: want an error")
	}
}
