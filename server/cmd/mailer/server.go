package main

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/mail"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/mailtemplate"
)

// Handler is the mailer's own API. It listens on the loopback only (see
// config.MailerConfig): dashboard-api relays the UI's calls to it.
func (m *Mailer) Handler() http.Handler {
	router := chi.NewRouter()
	router.Use(middleware.Recoverer)
	router.Get("/api/mailer/status", m.status)
	router.Post("/api/mailer/test", m.sendTestMail)
	return router
}

type statusResponse struct {
	StartedAt time.Time `json:"startedAt"`
	// LastCheckAt is the last time the mailer looked for a mail to send --
	// once a minute, so an old one means its loop is stuck.
	LastCheckAt *time.Time `json:"lastCheckAt,omitempty"`
}

// status says the mailer runs, and when it last looked for a mail to send.
//
// @Summary Mailer status
// @Description The mailer's own API, on the loopback only (mailer.port, default 8082): since when it runs, and when its loop last looked for a mail to send (once a minute). Read through dashboard-api's GET /api/status.
// @Tags Mailer
// @Produce json
// @Success 200 {object} main.statusResponse
// @Router /api/mailer/status [get]
func (m *Mailer) status(w http.ResponseWriter, _ *http.Request) {
	resp := statusResponse{StartedAt: m.startedAt}
	if last := m.lastCheck(); !last.IsZero() {
		resp.LastCheckAt = &last
	}
	writeJSON(w, http.StatusOK, resp)
}

type testMailRequest struct {
	// Lang picks the mail's language, the dashboard's own ("fr" or "en").
	Lang string `json:"lang"`
}

type testMailResponse struct {
	SentTo []string `json:"sentTo"`
}

// sentAtLayouts is {{date}} in a test mail, by language.
var sentAtLayouts = map[string]string{
	"fr": "02/01/2006 à 15:04",
	"en": "2006-01-02 15:04",
}

// sendTestMail sends a test mail to every recipient, through the SMTP
// server as saved in settings.yml -- never what's being typed in the form,
// so a success means the saved setup, and the mailer itself, actually work.
//
// @Summary Send a test mail (mailer)
// @Description The mailer's own API, on the loopback only (mailer.port, default 8082): sends a test mail to every recipient through the saved SMTP server. Reached through dashboard-api's POST /api/config/mail/test.
// @Tags Mailer
// @Accept json
// @Param request body main.testMailRequest false "Mail language (fr or en, default en)"
// @Produce json
// @Success 200 {object} main.testMailResponse
// @Failure 400 {object} object{error=string,message=string,code=int} "SMTP server or recipients not configured"
// @Failure 502 {object} object{error=string,message=string,code=int} "the SMTP server refused or couldn't be reached"
// @Router /api/mailer/test [post]
func (m *Mailer) sendTestMail(w http.ResponseWriter, r *http.Request) {
	var req testMailRequest
	// No body, or an unreadable one, just means the default language.
	_ = json.NewDecoder(r.Body).Decode(&req)

	settings := m.notifications()
	if !settings.Mail.SMTP.Configured() {
		writeError(w, http.StatusBadRequest, "no SMTP server configured")
		return
	}
	if len(settings.Mail.To) == 0 {
		writeError(w, http.StatusBadRequest, "no recipient configured")
		return
	}

	lang := req.Lang
	if _, ok := sentAtLayouts[lang]; !ok {
		lang = "en"
	}
	smtp := settings.Mail.SMTP
	subject, text := m.template(mailtemplate.TestMail, lang).Render(map[string]string{
		"server":       smtp.Host + ":" + strconv.Itoa(smtp.Port),
		"security":     string(smtp.Security),
		"from":         smtp.From,
		"to":           strings.Join(settings.Mail.To, ", "),
		"date":         time.Now().UTC().Format(sentAtLayouts[lang]),
		"dashboardURL": settings.DashboardURL,
	})
	msg := mail.Message{To: settings.Mail.To, Subject: subject, Text: text}
	if err := mail.Send(r.Context(), smtp, msg); err != nil {
		m.logger.Error("failed to send the test mail", "error", err)
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	m.logger.Info("Test mail sent", "to", settings.Mail.To)
	writeJSON(w, http.StatusOK, testMailResponse{SentTo: settings.Mail.To})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// writeError writes the same error body as dashboard-api's own handlers
// (handler.ErrorResponse), which relays it as is.
func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]any{
		"error":   http.StatusText(status),
		"message": message,
		"code":    status,
	})
}
