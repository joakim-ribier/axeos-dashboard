// Package remoteactionmail is the mail sent for every action asked for from a
// board. Its wording is in templates/remote-action.*: none here.
package remoteactionmail

import (
	"errors"
	"strings"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/mail"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/mailtemplate"
)

// The miner's name, never its IP nor the error (which holds it): an IP in a
// mail gets it filed as spam.
type Event struct {
	Action string    `json:"action"`
	Miner  string    `json:"miner"`
	Status string    `json:"status"`
	At     time.Time `json:"at"`
	// Never read off a request: only Sample sets it.
	Test bool `json:"-"`
}

// Fills templates/remote-action.*.
type Data struct {
	Miner, Action, Status, Color string
	At                           time.Time
	DashboardURL, AuditURL       string
	Test                         bool
}

var colors = map[string]string{
	"done":     "#43a047",
	"failed":   "#e53935",
	"rejected": "#fb8c00",
}

// A missing or broken template falls back to the built-in one: that error is
// returned for the log, the mail still built.
func Build(settings config.NotificationsConfig, e Event, templatesDir string) (mail.Message, error) {
	data := Data{
		Miner:        e.Miner,
		Action:       e.Action,
		Status:       e.Status,
		Color:        colors[e.Status],
		At:           e.At.UTC(),
		DashboardURL: strings.TrimRight(settings.DashboardURL, "/"),
		Test:         e.Test,
	}
	if mailtemplate.Linkable(data.DashboardURL) {
		data.AuditURL = data.DashboardURL + "/audit"
	}

	lang := settings.Language
	subject, html, htmlErr := mailtemplate.RenderHTML(templatesDir, mailtemplate.RemoteAction, lang, data)
	text, textErr := mailtemplate.RenderText(templatesDir, mailtemplate.RemoteAction, lang, data)
	return mail.Message{
		To:      settings.Mail.To,
		Subject: subject,
		Text:    text,
		HTML:    html,
		Inline:  []mail.Inline{{ID: "logo", ContentType: "image/png", Data: mailtemplate.Logo}},
	}, errors.Join(htmlErr, textErr)
}

// The example sent by the Test button of Configuration › Remote.
func Sample(now time.Time) Event {
	return Event{Action: "restart", Miner: "Bitaxe-1", Status: "done", At: now.UTC().Truncate(time.Second), Test: true}
}
