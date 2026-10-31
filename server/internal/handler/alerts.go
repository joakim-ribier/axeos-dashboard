// internal/handler/alerts.go
package handler

import (
	"cmp"
	"encoding/json"
	"net/http"
	"path/filepath"
	"regexp"
	"slices"
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

		resp := AlertsResponse{Events: sortedWithCurrentNames(cfg, events)}
		if !seenAt.IsZero() {
			resp.SeenAt = &seenAt
		}
		writeJSON(w, resp)
	}
}

// ListActiveAlerts handles GET /api/miners/alerts/active.
//
// @Summary List the alerts in progress
// @Description Every alert raised and not cleared yet on an enabled miner, however long ago it was raised -- the event that raised it, most recent first.
// @Tags Alerts
// @Produce json
// @Success 200 {array} alerts.Event
// @Router /api/miners/alerts/active [get]
func ListActiveAlerts(cfg config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		root := getDataRoot(cfg.Storage)
		events := []alerts.Event{}
		for _, miner := range cfg.GetMiners() {
			key := miner.StorageKey()
			if key == "" {
				continue
			}
			state, err := alerts.LoadState(filepath.Join(root, key))
			if err != nil {
				continue
			}
			for _, e := range state.Ongoing {
				e.Mac, e.IP, e.Hostname = key, miner.Ip, miner.DisplayName()
				events = append(events, e)
			}
		}
		writeJSON(w, sortedWithCurrentNames(cfg, events))
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

		filtered = sortedWithCurrentNames(cfg, filtered)
		total := len(filtered)
		page, pageSize := parsePagination(r)
		start := min((page-1)*pageSize, total)
		end := min(start+pageSize, total)

		writeJSON(w, AlertHistoryResponse{
			Events:   filtered[start:end],
			Total:    total,
			Page:     page,
			PageSize: pageSize,
		})
	}
}

// sortedWithCurrentNames labels each event with its miner's name as
// configured now -- an alias set since keeps applying to its past alerts; a
// miner no longer configured keeps the name it had then -- and sorts them
// the one way every list shows them: most recent first, then in
// alerts.Types' order -- the problems before a firmware update, the same
// one on several miners together -- then by MAC. Only what never changes:
// neither when they were written, nor a rename, nor the config's order
// moves a line.
func sortedWithCurrentNames(cfg config.Config, events []alerts.Event) []alerts.Event {
	names := make(map[string]string)
	for _, miner := range cfg.Bitaxes {
		names[miner.StorageKey()] = miner.DisplayName()
	}
	for i, e := range events {
		if name := names[e.Mac]; name != "" {
			events[i].Hostname = name
		}
	}
	slices.SortFunc(events, func(a, b alerts.Event) int {
		return cmp.Or(
			b.Timestamp.Compare(a.Timestamp),
			cmp.Compare(slices.Index(alerts.Types, a.Type), slices.Index(alerts.Types, b.Type)),
			cmp.Compare(a.Mac, b.Mac),
		)
	})
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
