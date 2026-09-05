// internal/handler/alerts.go
package handler

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/model"
)

const defaultAlertsLimit = 10 // per miner

// AlertEntry is one alert-bearing line from a miner's history, as returned
// by GET /api/miners/alerts (and the remote equivalent).
type AlertEntry struct {
	Timestamp string        `json:"timestamp"`
	MinerIP   string        `json:"minerIp,omitempty"`
	MinerMac  string        `json:"minerMac"`
	Hostname  string        `json:"hostname,omitempty"`
	Alerts    []model.Alert `json:"alerts"`
}

func parseLimit(r *http.Request) int {
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return n
		}
	}
	return defaultAlertsLimit
}

// ListAlerts handles GET /api/miners/alerts. It reads today's JSONL for
// every configured miner, keeps the lines that carry at least one alert,
// and returns each miner's N most recent -- raw entries, no deduplication
// or grouping (that's left to the frontend). The limit applies per miner
// (not globally) so that a chatty miner can't push another miner's still-
// active alert out of the response -- the frontend relies on a type's
// absence from this list to infer it has cleared, so truncation has to be
// per-miner or that inference would misfire.
//
// @Summary List the most recent miner alerts
// @Description Returns each miner's N most recent alert-bearing entries (today's history only).
// @Tags dashboard-api
// @Produce json
// @Param limit query int false "max entries to return per miner (default 10)"
// @Success 200 {array} handler.AlertEntry
// @Router /api/miners/alerts [get]
func ListAlerts(cfg config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		root := getDataRoot(cfg.Storage)
		limit := parseLimit(r)

		var entries []AlertEntry
		for _, miner := range cfg.GetMiners() {
			key := miner.StorageKey()
			if key == "" {
				continue
			}
			entries = append(entries, alertsForMiner(root, key, miner.Ip, miner.DisplayName(), limit)...)
		}

		writeAlertEntries(w, entries)
	}
}

// ListRemoteAlerts is the remote-dashboard-api equivalent: same logic, but
// scanning the hashboard board's data directory (auto-discovered devices,
// no local config).
//
// @Summary List the most recent miner alerts for a hashboard board (read-only)
// @Tags remote-dashboard-api
// @Produce json
// @Param boardId path string true "hashboard board ID"
// @Param limit query int false "max entries to return per miner (default 10)"
// @Success 200 {array} handler.AlertEntry
// @Router /api/{boardId}/miners/alerts [get]
func ListRemoteAlerts(cfg config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		boardID := chi.URLParam(r, "boardId")
		root := boardDataRoot(cfg.Storage.ResolveBoardsDir(), boardID)
		limit := parseLimit(r)

		dirEntries, err := os.ReadDir(root)
		if err != nil {
			writeErrorResponse(w, "board not found", http.StatusNotFound)
			return
		}

		var entries []AlertEntry
		for _, d := range dirEntries {
			if !d.IsDir() {
				continue
			}
			entries = append(entries, alertsForMiner(root, d.Name(), "", "", limit)...)
		}

		writeAlertEntries(w, entries)
	}
}

// alertsForMiner reads today's JSONL for one miner's directory and returns
// its `limit` most recent lines that carry at least one alert. JSONL is
// append-only, so the most recent alert-bearing lines are simply the tail
// of the filtered slice -- no need to sort first. ip/hostname are used as a
// fallback label when the stored line itself doesn't carry them (local mode
// -- the per-line file has neither, so the caller passes the config's;
// fallbackHostname is the miner's effective display name, i.e.
// config.Bitaxe.DisplayName(), alias-or-hostname).
func alertsForMiner(root, key, fallbackIP, fallbackHostname string, limit int) []AlertEntry {
	today := time.Now().UTC().Format("2006-01-02")
	path := filepath.Join(root, key, today+".jsonl")

	lines, err := decodeAlertJSONL(path)
	if err != nil {
		return nil
	}
	if len(lines) > limit {
		lines = lines[len(lines)-limit:]
	}

	out := make([]AlertEntry, 0, len(lines))
	for _, raw := range lines {
		ip := raw.IP
		if ip == "" {
			ip = fallbackIP
		}
		hostname := raw.Hostname
		if hostname == "" {
			hostname = fallbackHostname
		}
		out = append(out, AlertEntry{
			Timestamp: raw.Timestamp,
			MinerIP:   ip,
			MinerMac:  key,
			Hostname:  hostname,
			Alerts:    raw.Alerts,
		})
	}
	return out
}

// writeAlertEntries sorts the already per-miner-limited entries into one
// timeline, most recent first. No further truncation here -- each miner
// was already capped by alertsForMiner, so the total size is naturally
// bounded by limit * number of miners.
func writeAlertEntries(w http.ResponseWriter, entries []AlertEntry) {
	sort.Slice(entries, func(i, j int) bool { return entries[i].Timestamp > entries[j].Timestamp })
	if entries == nil {
		entries = []AlertEntry{}
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(entries); err != nil {
		http.Error(w, "failed to encode response", http.StatusInternalServerError)
	}
}

const (
	defaultHistoryPageSize = 50
	maxHistoryPageSize     = 200
)

// unknownIntervalFallback is the gap threshold used whenever a source
// feeder's polling interval isn't known (zero) -- either a local deployment
// somehow running with no feeder.interval configured at all, or (far more
// commonly, in remote mode) a miner pushed by an axeos-dashboard version
// that predates FeederIntervalSeconds (see cmd/feeder.pushSample) and so
// never sent one. Shared by pollGapThresholdFor's two consumers: alert
// episode grouping and remote mode's alive-from-push-recency check (see
// aliveFromTimestamp) -- both are really the same question ("how long a
// gap since we last heard from this miner still counts as normal"), just
// applied to different data.
const unknownIntervalFallback = 10 * time.Minute

// pollGapThresholdFor is the longest gap since a feeder with the given
// polling interval was last heard from that still counts as normal rather
// than a break in continuity -- three times the interval: two would already
// tolerate a single missed or slow poll (one skipped iteration), and the
// third covers real-world jitter (network latency, a slow device response)
// so a poll landing a bit later than scheduled doesn't look like a break. A
// fixed constant instead would be either too tight for a slower-polling
// config or too loose for a faster one. Falls back to
// unknownIntervalFallback when the interval isn't known (interval <= 0).
func pollGapThresholdFor(interval time.Duration) time.Duration {
	if interval <= 0 {
		return unknownIntervalFallback
	}
	return 3 * interval
}

// episodeGapThreshold is pollGapThresholdFor for local mode's alert episode
// grouping (see AlertEpisode), where the feeder interval is this
// deployment's own config. Remote mode has no feeder.interval of its own to
// read (see ListRemoteAlertsHistory, boardFeederInterval) -- it isn't this
// server's feeder that's doing the polling, so it calls
// pollGapThresholdFor directly instead.
func episodeGapThreshold(cfg config.Config) time.Duration {
	return pollGapThresholdFor(cfg.Feeder.Interval)
}

// AlertEpisode is one contiguous stretch of the same alert type on the same
// miner within the requested day -- however many individual polls (see
// model.Alert) reported it consecutively, collapsed into one range by
// groupIntoEpisodes. The underlying per-poll data on disk is untouched by
// this; it's purely how ListAlertsHistory presents it, so a sustained
// condition (a fan stuck high for hours) shows up as the single problem it
// is instead of burying the page under dozens of near-identical rows.
type AlertEpisode struct {
	Type        string  `json:"type"`
	MinerIP     string  `json:"minerIp,omitempty"`
	MinerMac    string  `json:"minerMac"`
	Hostname    string  `json:"hostname,omitempty"`
	FirstSeen   string  `json:"firstSeen"`
	LastSeen    string  `json:"lastSeen"`
	Occurrences int     `json:"occurrences"`
	PeakValue   float64 `json:"peakValue,omitempty"`
	Threshold   float64 `json:"threshold,omitempty"`
	Message     string  `json:"message,omitempty"`
}

// AlertHistoryResponse is the paginated response for GET
// /api/miners/alerts/history (and its remote equivalent) -- every alert
// episode (see AlertEpisode) on one explicitly requested day, across every
// miner (unlike ListAlerts, which returns raw per-poll entries for the
// notification bell's "recent" use case and is always scoped to today).
type AlertHistoryResponse struct {
	Episodes []AlertEpisode `json:"episodes"`
	Total    int            `json:"total"`
	Page     int            `json:"page"`
	PageSize int            `json:"pageSize"`
}

func parsePage(r *http.Request) int {
	if v := r.URL.Query().Get("page"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return n
		}
	}
	return 1
}

func parsePageSize(r *http.Request) int {
	if v := r.URL.Query().Get("pageSize"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			if n > maxHistoryPageSize {
				return maxHistoryPageSize
			}
			return n
		}
	}
	return defaultHistoryPageSize
}

// dateFilterPattern matches the same YYYY-MM-DD form the daily JSONL
// filenames use (see storage.RawStorage.Append). Validated strictly since
// this value is joined straight into a filesystem path -- an unvalidated
// date could otherwise be used for path traversal (e.g. "../../../etc").
var dateFilterPattern = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

// parseDateFilter reads the required "date" query param (the calendar
// filter on the Alerts page) -- required, not optional: a request with no
// date, or a malformed one, is rejected rather than falling back to
// scanning every day a miner has ever recorded (see allAlertsForMiner).
func parseDateFilter(r *http.Request) (date string, ok bool) {
	date = r.URL.Query().Get("date")
	return date, dateFilterPattern.MatchString(date)
}

// ListAlertsHistory handles GET /api/miners/alerts/history. Unlike
// ListAlerts (today only, capped per miner, raw per-poll entries for the
// notification bell), this reads every miner's alert-bearing entries for
// one explicitly requested day and groups consecutive same-(miner, type)
// occurrences into episodes (see AlertEpisode) -- a condition that holds
// across many polls in a row shows up as one row, not dozens. date is
// required (not optional): every request is scoped to a single day so the
// handler never has to scan a miner's entire recorded history, which for a
// long-running deployment can be hundreds of files and the dominant cost of
// this endpoint by far. Supports optional ip/type filters and
// page/pageSize pagination on top of that one day's episodes.
//
// @Summary List a single day's recorded miner alerts, grouped into episodes and paginated
// @Description Returns every alert episode (consecutive same-type occurrences collapsed into one) on the given day across all miners, most recently active first, optionally filtered by ip/type.
// @Tags dashboard-api
// @Produce json
// @Param date query string true "the single day to scan (YYYY-MM-DD)"
// @Param page query int false "page number, 1-based (default 1)"
// @Param pageSize query int false "episodes per page (default 50, max 200)"
// @Param ip query string false "filter to this miner IP only"
// @Param type query string false "filter to this alert type only"
// @Success 200 {object} handler.AlertHistoryResponse
// @Router /api/miners/alerts/history [get]
func ListAlertsHistory(cfg config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		date, ok := parseDateFilter(r)
		if !ok {
			writeErrorResponse(w, "date is required, want YYYY-MM-DD", http.StatusBadRequest)
			return
		}
		root := getDataRoot(cfg.Storage)

		var entries []AlertEntry
		for _, miner := range cfg.GetMiners() {
			key := miner.StorageKey()
			if key == "" {
				continue
			}
			entries = append(entries, allAlertsForMiner(root, key, miner.Ip, miner.DisplayName(), date)...)
		}

		writeAlertHistory(w, r, entries, episodeGapThreshold(cfg))
	}
}

// ListRemoteAlertsHistory is the remote-dashboard-api equivalent of
// ListAlertsHistory (date required, same episode grouping), scanning the
// hashboard board's data directory.
//
// @Summary List a single day's recorded miner alerts for a hashboard board, grouped into episodes and paginated (read-only)
// @Tags remote-dashboard-api
// @Produce json
// @Param boardId path string true "hashboard board ID"
// @Param date query string true "the single day to scan (YYYY-MM-DD)"
// @Param page query int false "page number, 1-based (default 1)"
// @Param pageSize query int false "episodes per page (default 50, max 200)"
// @Param ip query string false "filter to this miner IP only"
// @Param type query string false "filter to this alert type only"
// @Success 200 {object} handler.AlertHistoryResponse
// @Router /api/{boardId}/miners/alerts/history [get]
func ListRemoteAlertsHistory(cfg config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		date, ok := parseDateFilter(r)
		if !ok {
			writeErrorResponse(w, "date is required, want YYYY-MM-DD", http.StatusBadRequest)
			return
		}
		boardID := chi.URLParam(r, "boardId")
		root := boardDataRoot(cfg.Storage.ResolveBoardsDir(), boardID)

		dirEntries, err := os.ReadDir(root)
		if err != nil {
			writeErrorResponse(w, "board not found", http.StatusNotFound)
			return
		}

		var entries []AlertEntry
		for _, d := range dirEntries {
			if !d.IsDir() {
				continue
			}
			entries = append(entries, allAlertsForMiner(root, d.Name(), "", "", date)...)
		}

		gapThreshold := pollGapThresholdFor(boardFeederInterval(root, dirEntries))
		writeAlertHistory(w, r, entries, gapThreshold)
	}
}

// boardFeederInterval reads the polling interval the board's source
// axeos-dashboard feeder is configured with, straight from whichever
// miner's latest.json is available -- pushed with every sample (see
// cmd/feeder.pushSample) since every miner on a board comes from the same
// feeder, so any one of them carries the same value. remote-dashboard-api
// has no config of its own to read this from (it isn't the one doing the
// polling), unlike local mode's episodeGapThreshold. Returns 0 (unknown) if
// no miner's latest.json is readable, or none of them carry the field yet
// (pushed by an axeos-dashboard version that predates it).
func boardFeederInterval(root string, dirEntries []os.DirEntry) time.Duration {
	for _, d := range dirEntries {
		if !d.IsDir() {
			continue
		}
		raw, err := decodeLatestJSON(filepath.Join(root, d.Name(), "latest.json"))
		if err != nil {
			continue
		}
		if raw.FeederIntervalSeconds > 0 {
			return time.Duration(raw.FeederIntervalSeconds) * time.Second
		}
	}
	return 0
}

// allAlertsForMiner is alertsForMiner without the "today only" restriction
// -- every alert-bearing line the miner recorded on the given day. date is
// required (validated by the caller): reading exactly one day's file is
// what keeps this cheap regardless of how long a deployment has been
// running, instead of globbing and decoding every day a miner has ever
// recorded.
func allAlertsForMiner(root, key, fallbackIP, fallbackHostname, date string) []AlertEntry {
	path := filepath.Join(root, key, date+".jsonl")
	lines, err := decodeAlertJSONL(path)
	if err != nil {
		return nil
	}

	var out []AlertEntry
	for _, raw := range lines {
		ip := raw.IP
		if ip == "" {
			ip = fallbackIP
		}
		hostname := raw.Hostname
		if hostname == "" {
			hostname = fallbackHostname
		}
		out = append(out, AlertEntry{
			Timestamp: raw.Timestamp,
			MinerIP:   ip,
			MinerMac:  key,
			Hostname:  hostname,
			Alerts:    raw.Alerts,
		})
	}
	return out
}

// alertTick is one (miner, alert type) occurrence at one poll -- the unit
// groupIntoEpisodes merges into an AlertEpisode. A single AlertEntry can
// carry several simultaneous alerts (e.g. tempHigh and fanHigh on the same
// poll); each becomes its own tick.
type alertTick struct {
	timestamp time.Time
	minerIP   string
	minerMac  string
	hostname  string
	alert     model.Alert
}

// flattenAlertTicks expands each entry's Alerts slice into individual
// ticks. Entries whose timestamp fails to parse are dropped rather than
// crashing the grouping pass -- shouldn't happen (the timestamp always
// comes from our own Marshal), but grouping is best-effort, not a place to
// panic over one bad line.
func flattenAlertTicks(entries []AlertEntry) []alertTick {
	var ticks []alertTick
	for _, e := range entries {
		ts, err := time.Parse(time.RFC3339, e.Timestamp)
		if err != nil {
			continue
		}
		for _, a := range e.Alerts {
			ticks = append(ticks, alertTick{
				timestamp: ts,
				minerIP:   e.MinerIP,
				minerMac:  e.MinerMac,
				hostname:  e.Hostname,
				alert:     a,
			})
		}
	}
	return ticks
}

// episodeBuilder accumulates one AlertEpisode's ticks as groupIntoEpisodes
// walks the chronologically-sorted tick list -- kept separate from
// AlertEpisode itself so firstSeen/lastSeen can stay time.Time (for the gap
// comparison) until the very end, instead of re-parsing the JSON-formatted
// string on every tick.
type episodeBuilder struct {
	alertType            string
	minerIP, minerMac    string
	hostname             string
	firstSeen, lastSeen  time.Time
	occurrences          int
	peakValue, threshold float64
	message              string
}

func (b *episodeBuilder) build() AlertEpisode {
	return AlertEpisode{
		Type:        b.alertType,
		MinerIP:     b.minerIP,
		MinerMac:    b.minerMac,
		Hostname:    b.hostname,
		FirstSeen:   b.firstSeen.Format(time.RFC3339),
		LastSeen:    b.lastSeen.Format(time.RFC3339),
		Occurrences: b.occurrences,
		PeakValue:   b.peakValue,
		Threshold:   b.threshold,
		Message:     b.message,
	}
}

// groupIntoEpisodes collapses entries into AlertEpisode, most recent first.
// entries need not be pre-sorted. Ticks are grouped independently per
// (miner, alert type): walking them in chronological order, a tick extends
// the currently open episode for its (miner, type) pair if it arrives
// within gapThreshold (see episodeGapThreshold) of that episode's last
// tick, otherwise it starts a new one.
func groupIntoEpisodes(entries []AlertEntry, gapThreshold time.Duration) []AlertEpisode {
	ticks := flattenAlertTicks(entries)
	sort.Slice(ticks, func(i, j int) bool { return ticks[i].timestamp.Before(ticks[j].timestamp) })

	type key struct{ mac, alertType string }
	open := make(map[key]*episodeBuilder)
	var order []*episodeBuilder

	for _, t := range ticks {
		k := key{t.minerMac, t.alert.Type}
		b := open[k]
		if b == nil || t.timestamp.Sub(b.lastSeen) > gapThreshold {
			b = &episodeBuilder{
				alertType: t.alert.Type,
				minerIP:   t.minerIP,
				minerMac:  t.minerMac,
				hostname:  t.hostname,
				firstSeen: t.timestamp,
				threshold: t.alert.Threshold,
			}
			open[k] = b
			order = append(order, b)
		}
		b.lastSeen = t.timestamp
		b.occurrences++
		if t.alert.Value > b.peakValue {
			b.peakValue = t.alert.Value
		}
		if t.alert.Message != "" {
			b.message = t.alert.Message
		}
	}

	episodes := make([]AlertEpisode, len(order))
	for i, b := range order {
		episodes[i] = b.build()
	}
	sort.Slice(episodes, func(i, j int) bool { return episodes[i].LastSeen > episodes[j].LastSeen })
	return episodes
}

func filterEpisodes(episodes []AlertEpisode, keep func(AlertEpisode) bool) []AlertEpisode {
	var out []AlertEpisode
	for _, e := range episodes {
		if keep(e) {
			out = append(out, e)
		}
	}
	return out
}

// writeAlertHistory groups entries into episodes (see groupIntoEpisodes),
// applies the optional ip/type filters, paginates, and writes the result as
// an AlertHistoryResponse. total reflects the filtered episode count,
// before pagination, so the frontend can compute the number of pages.
func writeAlertHistory(w http.ResponseWriter, r *http.Request, entries []AlertEntry, gapThreshold time.Duration) {
	episodes := groupIntoEpisodes(entries, gapThreshold)

	if ip := r.URL.Query().Get("ip"); ip != "" {
		episodes = filterEpisodes(episodes, func(e AlertEpisode) bool { return e.MinerIP == ip })
	}
	if alertType := r.URL.Query().Get("type"); alertType != "" {
		episodes = filterEpisodes(episodes, func(e AlertEpisode) bool { return e.Type == alertType })
	}

	total := len(episodes)
	page := parsePage(r)
	pageSize := parsePageSize(r)

	start := min((page-1)*pageSize, total)
	end := min(start+pageSize, total)
	pageEpisodes := episodes[start:end]
	if pageEpisodes == nil {
		pageEpisodes = []AlertEpisode{}
	}

	w.Header().Set("Content-Type", "application/json")
	resp := AlertHistoryResponse{Episodes: pageEpisodes, Total: total, Page: page, PageSize: pageSize}
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		http.Error(w, "failed to encode response", http.StatusInternalServerError)
	}
}
