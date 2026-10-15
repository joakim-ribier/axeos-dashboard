package handler

import (
	"encoding/json"
	"io"
	"net/http"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
)

// The mailer answers its status right away; a test mail waits on the SMTP
// server (15s at most, see mail.Send), within the router's own 30s.
var (
	mailerStatusClient = &http.Client{Timeout: 3 * time.Second}
	mailerTestClient   = &http.Client{Timeout: 25 * time.Second}
)

type MailerStatusResponse struct {
	// Online is whether the mailer answered: without it, no mail is sent at
	// all -- neither the audit report nor a test mail.
	Online      bool       `json:"online"`
	StartedAt   *time.Time `json:"startedAt,omitempty"`
	LastCheckAt *time.Time `json:"lastCheckAt,omitempty"`
}

// MailerStatus asks the mailer service whether it's running.
//
// @Summary Mailer service status
// @Description Whether the mailer service (the process that sends every mail) is running, since when, and when it last looked for a mail to send.
// @Tags dashboard-api
// @Produce json
// @Success 200 {object} handler.MailerStatusResponse
// @Router /api/mailer/status [get]
func MailerStatus(cfg config.Config, w http.ResponseWriter, r *http.Request) {
	var resp MailerStatusResponse
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, "http://"+cfg.Mailer.Address()+"/api/status", nil)
	if err == nil {
		if res, err := mailerStatusClient.Do(req); err == nil {
			defer func() { _ = res.Body.Close() }()
			resp.Online = res.StatusCode == http.StatusOK && json.NewDecoder(res.Body).Decode(&resp) == nil
		}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

// SendTestMail has the mailer send a test mail to every recipient, through
// the SMTP server as saved in settings.yml -- a success means the saved
// setup and the mailer itself both work.
//
// @Summary Send a test mail
// @Description Has the mailer service send a test mail to every configured recipient through the saved SMTP server.
// @Tags dashboard-api
// @Accept json
// @Param request body object{lang=string} false "Mail language (fr or en, default en)"
// @Produce json
// @Success 200 {object} object{sentTo=[]string}
// @Failure 400 {object} handler.ErrorResponse "SMTP server or recipients not configured"
// @Failure 502 {object} handler.ErrorResponse "the SMTP server refused or couldn't be reached"
// @Failure 503 {object} handler.ErrorResponse "the mailer service isn't running"
// @Router /api/config/mail/test [post]
func SendTestMail(cfg config.Config, w http.ResponseWriter, r *http.Request) {
	req, err := http.NewRequestWithContext(r.Context(), http.MethodPost, "http://"+cfg.Mailer.Address()+"/api/mail/test", r.Body)
	if err != nil {
		writeErrorResponse(w, err.Error(), http.StatusInternalServerError)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	res, err := mailerTestClient.Do(req)
	if err != nil {
		writeErrorResponse(w, "the mailer service isn't running", http.StatusServiceUnavailable)
		return
	}
	defer func() { _ = res.Body.Close() }()
	w.Header().Set("Content-Type", res.Header.Get("Content-Type"))
	w.WriteHeader(res.StatusCode)
	_, _ = io.Copy(w, res.Body)
}
