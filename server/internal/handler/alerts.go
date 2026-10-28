// internal/handler/alerts.go
package handler

import (
	"encoding/json"
	"net/http"
	"regexp"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/alerts"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
)

const (
	defaultAlertsLimit = 50
	maxAlertsLimit     = 200
)

// AlertsResponse is the bell's content: the most recent events, and up to
// when they've been read (absent: never).
type AlertsResponse struct {
	Events []alerts.Event `json:"events"`
	SeenAt *time.Time     `json:"seenAt,omitempty"`
}

// ListAlerts handles GET /api/miners/alerts.
//
// @Summary List the most recent alert changes
// @Description An alert is raised once when it starts and cleared once when it ends -- each is one event. Returns the most recent ones (last 30 days), across every miner, most recent first, and up to when they've been read.
// @Tags Alerts
// @Produce json
// @Param limit query int false "max events to return (default 50, max 200)"
// @Success 200 {object} handler.AlertsResponse
// @Router /api/miners/alerts [get]
func ListAlerts(cfg config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		log := alerts.NewLog(cfg.Storage.AlertsDir())
		limit := parsePositiveInt(r, "limit", defaultAlertsLimit, maxAlertsLimit)
		events, err := log.Recent(time.Now(), limit)
		if err != nil {
			writeErrorResponse(w, "failed to read alerts", http.StatusInternalServerError)
			return
		}
		seenAt, err := log.SeenAt()
		if err != nil {
			writeErrorResponse(w, "failed to read alerts", http.StatusInternalServerError)
			return
		}

		resp := AlertsResponse{Events: withCurrentNames(cfg, events)}
		if !seenAt.IsZero() {
			resp.SeenAt = &seenAt
		}
		writeJSON(w, resp)
	}
}

// AlertsSeen is up to when the alerts have been read.
type AlertsSeen struct {
	SeenAt time.Time `json:"seenAt"`
}

// MarkAlertsSeen handles POST /api/miners/alerts/seen.
//
// @Summary Mark the alerts read
// @Description Marks every alert up to seenAt as read, for every browser -- never moves it back. Returns the resulting seenAt.
// @Tags Alerts
// @Accept json
// @Produce json
// @Param body body handler.AlertsSeen true "up to when"
// @Success 200 {object} handler.AlertsSeen
// @Failure 400 {object} handler.ErrorResponse
// @Router /api/miners/alerts/seen [post]
func MarkAlertsSeen(cfg config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body AlertsSeen
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.SeenAt.IsZero() {
			writeErrorResponse(w, "seenAt is required, want an RFC 3339 time", http.StatusBadRequest)
			return
		}
		seenAt, err := alerts.NewLog(cfg.Storage.AlertsDir()).MarkSeen(body.SeenAt)
		if err != nil {
			writeErrorResponse(w, "failed to mark the alerts read", http.StatusInternalServerError)
			return
		}
		writeJSON(w, AlertsSeen{SeenAt: seenAt})
	}
}

// AlertHistoryResponse is one day's alert events, paginated.
type AlertHistoryResponse struct {
	Events   []alerts.Event `json:"events"`
	Total    int            `json:"total"`
	Page     int            `json:"page"`
	PageSize int            `json:"pageSize"`
}

// dateFilterPattern is validated strictly since the date names the file
// read -- an unvalidated one could be used for path traversal.
var dateFilterPattern = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

// ListAlertsHistory handles GET /api/miners/alerts/history.
//
// @Summary List a single day's alert changes, paginated
// @Description Every alert raised or cleared on the given UTC day, across every miner, most recent first, optionally filtered by ip/type.
// @Tags Alerts
// @Produce json
// @Param date query string true "the UTC day (YYYY-MM-DD)"
// @Param page query int false "page number, 1-based (default 1)"
// @Param pageSize query int false "events per page (default 50, max 200)"
// @Param ip query string false "filter to this miner IP only"
// @Param type query string false "filter to this alert type only"
// @Success 200 {object} handler.AlertHistoryResponse
// @Router /api/miners/alerts/history [get]
func ListAlertsHistory(cfg config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		query := r.URL.Query()
		date := query.Get("date")
		if !dateFilterPattern.MatchString(date) {
			writeErrorResponse(w, "date is required, want YYYY-MM-DD", http.StatusBadRequest)
			return
		}
		events, err := alerts.NewLog(cfg.Storage.AlertsDir()).ReadDay(date)
		if err != nil {
			writeErrorResponse(w, "failed to read alerts", http.StatusInternalServerError)
			return
		}

		ip, alertType := query.Get("ip"), query.Get("type")
		filtered := []alerts.Event{}
		for _, e := range events {
			if (ip == "" || e.IP == ip) && (alertType == "" || e.Type == alertType) {
				filtered = append(filtered, e)
			}
		}

		total := len(filtered)
		page, pageSize := parsePagination(r)
		start := min((page-1)*pageSize, total)
		end := min(start+pageSize, total)

		writeJSON(w, AlertHistoryResponse{
			Events:   withCurrentNames(cfg, filtered[start:end]),
			Total:    total,
			Page:     page,
			PageSize: pageSize,
		})
	}
}

// withCurrentNames labels each event with its miner's name as configured
// now -- an alias set since keeps applying to its past alerts. A miner no
// longer configured keeps the name it had then.
func withCurrentNames(cfg config.Config, events []alerts.Event) []alerts.Event {
	names := make(map[string]string)
	for _, miner := range cfg.Bitaxes {
		names[miner.StorageKey()] = miner.DisplayName()
	}
	for i, e := range events {
		if name := names[e.Mac]; name != "" {
			events[i].Hostname = name
		}
	}
	if events == nil {
		events = []alerts.Event{}
	}
	return events
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(v); err != nil {
		http.Error(w, "failed to encode response", http.StatusInternalServerError)
	}
}
