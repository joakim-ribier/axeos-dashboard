package handler

import (
	"encoding/json"
	"net/http"
	"slices"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/audit"
)

const (
	defaultAuditRange = 24 * time.Hour
	// maxAuditRange bounds how many daily files one request can make the
	// server read.
	maxAuditRange = 7 * 24 * time.Hour
)

// AuditExport is the file GET /api/audit/export downloads -- the range it
// covers and its size up front, so the file reads on its own.
type AuditExport struct {
	From       time.Time     `json:"from"`
	To         time.Time     `json:"to"`
	IP         string        `json:"ip,omitempty"`
	Type       string        `json:"type,omitempty"`
	ExportedAt time.Time     `json:"exportedAt"`
	Total      int           `json:"total"`
	Entries    []audit.Entry `json:"entries"`
}

type AuditResponse struct {
	Entries  []audit.Entry `json:"entries"`
	Total    int           `json:"total"`
	Page     int           `json:"page"`
	PageSize int           `json:"pageSize"`
}

// ListAudit returns the audit entries between from and to, newest first,
// paginated.
//
// @Summary List audit entries
// @Description Every user-triggered action that matters (miner restart, pool switch, config save, audit export, backups download, network scan) between from (inclusive) and to (exclusive) -- newest first. Both default to the last 24 hours; the range can't exceed 7 days. API entries carry the client's IP and User-Agent, system entries the service that acted (e.g. the scheduler).
// @Tags dashboard-api
// @Produce json
// @Param from query string false "range start, RFC 3339 (default: to minus 24h)"
// @Param to query string false "range end, RFC 3339 (default: now)"
// @Param ip query string false "only this miner's entries (its IP) -- a pool switch applied to every miner included"
// @Param type query string false "only this type (restart, switch_primary, switch_fallback, save_miners, save_settings, export_audit, download_backups, discover)"
// @Param page query int false "page number, 1-based (default 1)"
// @Param pageSize query int false "entries per page (default 50, max 200)"
// @Success 200 {object} handler.AuditResponse
// @Failure 400 {object} handler.ErrorResponse "from/to malformed, from not before to, or range over 7 days"
// @Failure 500 {object} handler.ErrorResponse "the audit log couldn't be read"
// @Router /api/audit [get]
func ListAudit(log *audit.Log) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, _, entries, ok := readAuditRange(log, w, r)
		if !ok {
			return
		}

		total := len(entries)
		page := parsePage(r)
		pageSize := parsePageSize(r)
		start := min((page-1)*pageSize, total)
		end := min(start+pageSize, total)
		pageEntries := entries[start:end]
		if pageEntries == nil {
			pageEntries = []audit.Entry{}
		}

		w.Header().Set("Content-Type", "application/json")
		resp := AuditResponse{Entries: pageEntries, Total: total, Page: page, PageSize: pageSize}
		if err := json.NewEncoder(w).Encode(resp); err != nil {
			http.Error(w, "failed to encode response", http.StatusInternalServerError)
		}
	}
}

// ExportAudit returns every audit entry between from and to, newest first,
// as a downloadable JSON file -- the whole range, not one page of it.
//
// @Summary Export audit entries
// @Description Same range and defaults as GET /api/audit (last 24 hours, at most 7 days), unpaginated, as a JSON file attachment: the resolved range, the export time and the entry count, then every entry.
// @Tags dashboard-api
// @Produce json
// @Param from query string false "range start, RFC 3339 (default: to minus 24h)"
// @Param to query string false "range end, RFC 3339 (default: now)"
// @Param ip query string false "only this miner's entries (its IP) -- a pool switch applied to every miner included"
// @Param type query string false "only this type (restart, switch_primary, switch_fallback, save_miners, save_settings, export_audit, download_backups, discover)"
// @Success 200 {object} handler.AuditExport
// @Failure 400 {object} handler.ErrorResponse "from/to malformed, from not before to, or range over 7 days"
// @Failure 500 {object} handler.ErrorResponse "the audit log couldn't be read"
// @Router /api/audit/export [get]
func ExportAudit(log *audit.Log) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		from, to, entries, ok := readAuditRange(log, w, r)
		if !ok {
			return
		}
		if entries == nil {
			entries = []audit.Entry{}
		}

		now := time.Now().UTC().Truncate(time.Second)
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Disposition", `attachment; filename="audit-`+now.Format("20060102-150405")+`.json"`)
		enc := json.NewEncoder(w)
		enc.SetIndent("", "  ")
		export := AuditExport{
			From:       from.UTC().Truncate(time.Second),
			To:         to.UTC().Truncate(time.Second),
			IP:         r.URL.Query().Get("ip"),
			Type:       r.URL.Query().Get("type"),
			ExportedAt: now,
			Total:      len(entries),
			Entries:    entries,
		}
		if err := enc.Encode(export); err != nil {
			http.Error(w, "failed to encode response", http.StatusInternalServerError)
		}
	}
}

// readAuditRange resolves the from/to query params (see ListAudit) and
// returns them with that range's entries, narrowed by the optional ip/type
// filters, newest first -- or writes the
// error response itself and returns false.
func readAuditRange(log *audit.Log, w http.ResponseWriter, r *http.Request) (from, to time.Time, entries []audit.Entry, ok bool) {
	to = time.Now()
	if v := r.URL.Query().Get("to"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			writeErrorResponse(w, "to must be RFC 3339", http.StatusBadRequest)
			return from, to, nil, false
		}
		to = t
	}
	from = to.Add(-defaultAuditRange)
	if v := r.URL.Query().Get("from"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			writeErrorResponse(w, "from must be RFC 3339", http.StatusBadRequest)
			return from, to, nil, false
		}
		from = t
	}
	if !from.Before(to) || to.Sub(from) > maxAuditRange {
		writeErrorResponse(w, "from must be before to, at most 7 days apart", http.StatusBadRequest)
		return from, to, nil, false
	}

	entries, err := log.ReadRange(from, to)
	if err != nil {
		writeErrorResponse(w, "failed to read audit log", http.StatusInternalServerError)
		return from, to, nil, false
	}
	ip, entryType := r.URL.Query().Get("ip"), r.URL.Query().Get("type")
	entries = slices.DeleteFunc(entries, func(e audit.Entry) bool {
		allMiners := e.Target == "" && (e.Type == audit.TypeSwitchPrimary || e.Type == audit.TypeSwitchFallback)
		return (ip != "" && e.Target != ip && !allMiners) || (entryType != "" && e.Type != entryType)
	})
	slices.Reverse(entries)
	return from, to, entries, true
}
