package mail

import (
	"context"
	"encoding/base64"
	"io"
	"mime"
	"mime/multipart"
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

func TestSend_anHTMLMessage(t *testing.T) {
	server := mailtest.NewServer(t)
	logo := []byte("not really a png")

	err := Send(context.Background(), plainSMTP(server), Message{
		To:      []string{"me@example.com"},
		Subject: "Alertes",
		Text:    "En texte.",
		HTML:    `<p>En <b>HTML</b> <img src="cid:logo"></p>`,
		Inline:  []Inline{{ID: "logo", ContentType: "image/png", Data: logo}},
	})
	if err != nil {
		t.Fatal(err)
	}

	msg, err := mail.ReadMessage(strings.NewReader(server.Next(t).Data))
	if err != nil {
		t.Fatal(err)
	}
	mediaType, params, _ := mime.ParseMediaType(msg.Header.Get("Content-Type"))
	if mediaType != "multipart/alternative" {
		t.Fatalf("Content-Type = %q, want multipart/alternative", mediaType)
	}
	parts := multipart.NewReader(msg.Body, params["boundary"])

	text, err := parts.NextPart()
	if err != nil {
		t.Fatal(err)
	}
	if body, _ := io.ReadAll(text); text.Header.Get("Content-Type") != "text/plain; charset=utf-8" || !strings.Contains(string(body), "En texte.") {
		t.Errorf("first part = %q %q, want the text", text.Header.Get("Content-Type"), body)
	}

	related, err := parts.NextPart()
	if err != nil {
		t.Fatal(err)
	}
	mediaType, params, _ = mime.ParseMediaType(related.Header.Get("Content-Type"))
	if mediaType != "multipart/related" {
		t.Fatalf("second part = %q, want multipart/related", mediaType)
	}
	inner := multipart.NewReader(related, params["boundary"])
	html, err := inner.NextPart()
	if err != nil {
		t.Fatal(err)
	}
	if body, _ := io.ReadAll(html); !strings.Contains(string(body), `<img src="cid:logo">`) {
		t.Errorf("HTML = %q", body)
	}
	img, err := inner.NextPart()
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := io.ReadAll(img)
	data, _ := base64.StdEncoding.DecodeString(strings.ReplaceAll(string(raw), "\r\n", ""))
	if img.Header.Get("Content-Id") != "<logo>" || img.Header.Get("Content-Type") != "image/png" || string(data) != string(logo) {
		t.Errorf("image = %v %q, want the logo by its Content-ID", img.Header, data)
	}
}
