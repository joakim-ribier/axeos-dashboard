package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/model"
)

// testGapThreshold stands in for what episodeGapThreshold(cfg) would derive
// from a real config -- these tests exercise groupIntoEpisodes directly, so
// they don't go through a config.Config at all.
const testGapThreshold = 15 * time.Minute

func TestGroupIntoEpisodes(t *testing.T) {
	t.Run("a gap of exactly the threshold still merges", func(t *testing.T) {
		got := groupIntoEpisodes([]AlertEntry{
			{Timestamp: "2026-07-14T08:00:00Z", MinerMac: "aabbccddeeff", Alerts: []model.Alert{{Type: "tempHigh", Value: 65}}},
			{Timestamp: "2026-07-14T08:15:00Z", MinerMac: "aabbccddeeff", Alerts: []model.Alert{{Type: "tempHigh", Value: 66}}},
		}, testGapThreshold)
		if len(got) != 1 || got[0].Occurrences != 2 {
			t.Fatalf("got %+v, want a single 2-occurrence episode", got)
		}
	})

	t.Run("a gap one second over the threshold splits into two episodes", func(t *testing.T) {
		got := groupIntoEpisodes([]AlertEntry{
			{Timestamp: "2026-07-14T08:00:00Z", MinerMac: "aabbccddeeff", Alerts: []model.Alert{{Type: "tempHigh", Value: 65}}},
			{Timestamp: "2026-07-14T08:15:01Z", MinerMac: "aabbccddeeff", Alerts: []model.Alert{{Type: "tempHigh", Value: 66}}},
		}, testGapThreshold)
		if len(got) != 2 {
			t.Fatalf("got %+v, want two separate episodes", got)
		}
	})

	t.Run("two alerts on the same poll become two independent episodes", func(t *testing.T) {
		got := groupIntoEpisodes([]AlertEntry{
			{
				Timestamp: "2026-07-14T08:00:00Z", MinerMac: "aabbccddeeff",
				Alerts: []model.Alert{{Type: "tempHigh", Value: 65}, {Type: "fanHigh", Value: 80}},
			},
		}, testGapThreshold)
		if len(got) != 2 {
			t.Fatalf("got %+v, want one episode per alert type", got)
		}
	})

	t.Run("the same type at the same time on two different miners never merges", func(t *testing.T) {
		got := groupIntoEpisodes([]AlertEntry{
			{Timestamp: "2026-07-14T08:00:00Z", MinerMac: "aabbccddeeff", Alerts: []model.Alert{{Type: "offline"}}},
			{Timestamp: "2026-07-14T08:00:00Z", MinerMac: "112233445566", Alerts: []model.Alert{{Type: "offline"}}},
		}, testGapThreshold)
		if len(got) != 2 {
			t.Fatalf("got %+v, want one episode per miner", got)
		}
	})

	t.Run("tracks the peak value across occurrences, not just the last one", func(t *testing.T) {
		got := groupIntoEpisodes([]AlertEntry{
			{Timestamp: "2026-07-14T08:00:00Z", MinerMac: "aabbccddeeff", Alerts: []model.Alert{{Type: "tempHigh", Value: 70}}},
			{Timestamp: "2026-07-14T08:05:00Z", MinerMac: "aabbccddeeff", Alerts: []model.Alert{{Type: "tempHigh", Value: 63}}},
		}, testGapThreshold)
		if len(got) != 1 || got[0].PeakValue != 70 {
			t.Fatalf("got %+v, want PeakValue = 70 (the higher of the two)", got)
		}
	})

	t.Run("carries a message-based alert's message through", func(t *testing.T) {
		got := groupIntoEpisodes([]AlertEntry{
			{Timestamp: "2026-07-14T08:00:00Z", MinerMac: "aabbccddeeff", Alerts: []model.Alert{{Type: "firmwareUpdate", Message: "v2.4.0 -> v2.5.1 available"}}},
		}, testGapThreshold)
		if len(got) != 1 || got[0].Message != "v2.4.0 -> v2.5.1 available" {
			t.Fatalf("got %+v, want the alert's message carried through", got)
		}
	})

	t.Run("empty input produces an empty (not nil) result", func(t *testing.T) {
		got := groupIntoEpisodes(nil, testGapThreshold)
		if len(got) != 0 {
			t.Fatalf("got %+v, want empty", got)
		}
	})

	t.Run("derives the threshold as three times the configured feeder interval -- room for one skipped poll plus jitter", func(t *testing.T) {
		cfg := config.Config{Feeder: config.FeederConfig{Interval: 10 * time.Minute}}
		got := episodeGapThreshold(cfg)
		want := 30 * time.Minute
		if got != want {
			t.Errorf("episodeGapThreshold() = %v, want %v", got, want)
		}
	})

	t.Run("falls back to unknownIntervalFallback when the feeder interval is unknown (zero)", func(t *testing.T) {
		got := episodeGapThreshold(config.Config{})
		if got != unknownIntervalFallback {
			t.Errorf("episodeGapThreshold() = %v, want the fallback %v", got, unknownIntervalFallback)
		}
	})
}

func TestListAlertsHistory(t *testing.T) {
	dir := t.TempDir()

	// A day with no alerts on it at all -- 07-13 -- used only to prove the
	// 07-14 query never touches it.
	writeTestFile(t, filepath.Join(dir, "aabbccddeeff", "2026-07-13.jsonl"),
		`{"ts":"2026-07-13T09:00:00Z","ip":"10.0.0.1","alerts":[{"type":"offline"}]}`+"\n")

	// 07-14: a tempHigh condition spanning three consecutive polls 5 minutes
	// apart (must collapse into one episode), an unrelated offline tick, and
	// a later tempHigh more than episodeGapThreshold after the first spell
	// (must start a second, separate episode) -- all for the same miner.
	writeTestFile(t, filepath.Join(dir, "aabbccddeeff", "2026-07-14.jsonl"),
		`{"ts":"2026-07-14T08:00:00Z","ip":"10.0.0.1","alerts":[{"type":"tempHigh","value":65,"threshold":62}]}`+"\n"+
			`{"ts":"2026-07-14T08:05:00Z","ip":"10.0.0.1","alerts":[{"type":"tempHigh","value":66,"threshold":62}]}`+"\n"+
			`{"ts":"2026-07-14T08:10:00Z","ip":"10.0.0.1","alerts":[{"type":"tempHigh","value":64,"threshold":62}]}`+"\n"+
			`{"ts":"2026-07-14T09:00:00Z","ip":"10.0.0.1","alerts":[{"type":"offline"}]}`+"\n"+
			`{"ts":"2026-07-14T11:00:00Z","ip":"10.0.0.1","alerts":[{"type":"tempHigh","value":70,"threshold":62}]}`+"\n"+
			`{"ts":"2026-07-14T11:05:00Z","ip":"10.0.0.1"}`+"\n") // clean line -- must never surface

	// A second miner, one fanHigh tick -- proves grouping is independent per
	// miner (never merges across miners even at an overlapping time).
	writeTestFile(t, filepath.Join(dir, "112233445566", "2026-07-14.jsonl"),
		`{"ts":"2026-07-14T08:02:00Z","ip":"10.0.0.2","alerts":[{"type":"fanHigh","value":80,"threshold":75}]}`+"\n")

	cfg := config.Config{
		Storage: config.StorageConfig{DataDir: dir},
		// Matches the 5-minute gaps in the fixture data above -- makes the
		// episode-merging assertions below exercise the real derivation
		// (episodeGapThreshold = 3 * Feeder.Interval, 15m here) instead of
		// happening to work off Feeder.Interval's zero value.
		Feeder: config.FeederConfig{Interval: 5 * time.Minute},
		Bitaxes: []config.Bitaxe{
			{Ip: "10.0.0.1", Mac: "aabbccddeeff", Hostname: "bitaxe-office", Enabled: true},
			{Ip: "10.0.0.2", Mac: "112233445566", Hostname: "bitaxe-garage", Enabled: true},
		},
	}
	t.Setenv(envDataRoot, dir)

	t.Run("date is required -- a request without one is rejected", func(t *testing.T) {
		w := httptest.NewRecorder()
		r := httptest.NewRequest(http.MethodGet, "/api/miners/alerts/history", nil)

		ListAlertsHistory(cfg)(w, r)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
		}
	})

	t.Run("groups consecutive same-miner-and-type ticks into one episode, most recently active first", func(t *testing.T) {
		w := httptest.NewRecorder()
		r := httptest.NewRequest(http.MethodGet, "/api/miners/alerts/history?date=2026-07-14", nil)

		ListAlertsHistory(cfg)(w, r)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
		}
		var got AlertHistoryResponse
		if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		// 4 episodes: the 08:00-08:10 tempHigh spell, the 09:00 offline
		// blip, the 11:00 tempHigh (too far from the first spell to merge),
		// and the other miner's fanHigh. The clean line contributes nothing.
		if got.Total != 4 {
			t.Fatalf("Total = %d, want 4 episodes, got %+v", got.Total, got.Episodes)
		}

		wantOrder := []struct {
			alertType   string
			firstSeen   string
			lastSeen    string
			occurrences int
			peakValue   float64
		}{
			{"tempHigh", "2026-07-14T11:00:00Z", "2026-07-14T11:00:00Z", 1, 70},
			{"offline", "2026-07-14T09:00:00Z", "2026-07-14T09:00:00Z", 1, 0},
			{"tempHigh", "2026-07-14T08:00:00Z", "2026-07-14T08:10:00Z", 3, 66},
			{"fanHigh", "2026-07-14T08:02:00Z", "2026-07-14T08:02:00Z", 1, 80},
		}
		if len(got.Episodes) != len(wantOrder) {
			t.Fatalf("Episodes = %+v, want %d entries", got.Episodes, len(wantOrder))
		}
		for i, want := range wantOrder {
			ep := got.Episodes[i]
			if ep.Type != want.alertType || ep.FirstSeen != want.firstSeen || ep.LastSeen != want.lastSeen ||
				ep.Occurrences != want.occurrences || ep.PeakValue != want.peakValue {
				t.Errorf("Episodes[%d] = %+v, want %+v", i, ep, want)
			}
		}
		// The merged episode keeps the miner's identity.
		merged := got.Episodes[2]
		if merged.MinerMac != "aabbccddeeff" || merged.MinerIP != "10.0.0.1" || merged.Hostname != "bitaxe-office" {
			t.Errorf("merged episode identity = %+v, want mac/ip/hostname for bitaxe-office", merged)
		}
	})

	t.Run("paginates", func(t *testing.T) {
		w := httptest.NewRecorder()
		r := httptest.NewRequest(http.MethodGet, "/api/miners/alerts/history?date=2026-07-14&page=1&pageSize=2", nil)

		ListAlertsHistory(cfg)(w, r)

		var got AlertHistoryResponse
		if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if got.Total != 4 {
			t.Errorf("Total = %d, want 4 (unaffected by pagination)", got.Total)
		}
		if len(got.Episodes) != 2 {
			t.Errorf("Episodes = %+v, want 2 (pageSize)", got.Episodes)
		}
		if got.Page != 1 || got.PageSize != 2 {
			t.Errorf("Page/PageSize = %d/%d, want 1/2", got.Page, got.PageSize)
		}
	})

	t.Run("second page returns the remainder", func(t *testing.T) {
		w := httptest.NewRecorder()
		r := httptest.NewRequest(http.MethodGet, "/api/miners/alerts/history?date=2026-07-14&page=2&pageSize=2", nil)

		ListAlertsHistory(cfg)(w, r)

		var got AlertHistoryResponse
		if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if len(got.Episodes) != 2 {
			t.Errorf("Episodes = %+v, want 2 (the remaining episodes)", got.Episodes)
		}
	})

	t.Run("a page past the end returns an empty (not error) result", func(t *testing.T) {
		w := httptest.NewRecorder()
		r := httptest.NewRequest(http.MethodGet, "/api/miners/alerts/history?date=2026-07-14&page=99&pageSize=2", nil)

		ListAlertsHistory(cfg)(w, r)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
		}
		var got AlertHistoryResponse
		if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if len(got.Episodes) != 0 {
			t.Errorf("Episodes = %+v, want empty", got.Episodes)
		}
	})

	t.Run("filters by ip", func(t *testing.T) {
		w := httptest.NewRecorder()
		r := httptest.NewRequest(http.MethodGet, "/api/miners/alerts/history?date=2026-07-14&ip=10.0.0.2", nil)

		ListAlertsHistory(cfg)(w, r)

		var got AlertHistoryResponse
		if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if got.Total != 1 || len(got.Episodes) != 1 || got.Episodes[0].MinerIP != "10.0.0.2" {
			t.Errorf("got %+v, want a single episode for 10.0.0.2", got)
		}
	})

	t.Run("filters by type", func(t *testing.T) {
		w := httptest.NewRecorder()
		r := httptest.NewRequest(http.MethodGet, "/api/miners/alerts/history?date=2026-07-14&type=offline", nil)

		ListAlertsHistory(cfg)(w, r)

		var got AlertHistoryResponse
		if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if got.Total != 1 || len(got.Episodes) != 1 || got.Episodes[0].Type != "offline" {
			t.Errorf("got %+v, want a single offline episode", got)
		}
	})

	t.Run("date filter for a day with no data returns an empty (not error) result", func(t *testing.T) {
		w := httptest.NewRecorder()
		r := httptest.NewRequest(http.MethodGet, "/api/miners/alerts/history?date=2026-01-01", nil)

		ListAlertsHistory(cfg)(w, r)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
		}
		var got AlertHistoryResponse
		if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if got.Total != 0 {
			t.Errorf("Total = %d, want 0", got.Total)
		}
	})

	t.Run("date and ip filters combine", func(t *testing.T) {
		w := httptest.NewRecorder()
		r := httptest.NewRequest(http.MethodGet, "/api/miners/alerts/history?date=2026-07-14&ip=10.0.0.2", nil)

		ListAlertsHistory(cfg)(w, r)

		var got AlertHistoryResponse
		if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if got.Total != 1 || len(got.Episodes) != 1 || got.Episodes[0].MinerIP != "10.0.0.2" {
			t.Errorf("got %+v, want a single episode for 10.0.0.2 on 2026-07-14", got)
		}
	})

	t.Run("rejects a malformed date instead of using it as a path", func(t *testing.T) {
		for _, bad := range []string{"../../../etc/passwd", "not-a-date", "2026/07/14"} {
			w := httptest.NewRecorder()
			r := httptest.NewRequest(http.MethodGet, "/api/miners/alerts/history?date="+bad, nil)

			ListAlertsHistory(cfg)(w, r)

			if w.Code != http.StatusBadRequest {
				t.Errorf("date=%q: status = %d, want %d", bad, w.Code, http.StatusBadRequest)
			}
		}
	})

	t.Run("ip and type filters combine", func(t *testing.T) {
		w := httptest.NewRecorder()
		r := httptest.NewRequest(http.MethodGet, "/api/miners/alerts/history?date=2026-07-14&ip=10.0.0.1&type=offline", nil)

		ListAlertsHistory(cfg)(w, r)

		var got AlertHistoryResponse
		if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if got.Total != 1 {
			t.Errorf("Total = %d, want 1", got.Total)
		}
	})

	t.Run("pageSize is capped at the max", func(t *testing.T) {
		w := httptest.NewRecorder()
		r := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/miners/alerts/history?date=2026-07-14&pageSize=%d", maxHistoryPageSize+1000), nil)

		ListAlertsHistory(cfg)(w, r)

		var got AlertHistoryResponse
		if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if got.PageSize != maxHistoryPageSize {
			t.Errorf("PageSize = %d, want the cap of %d", got.PageSize, maxHistoryPageSize)
		}
	})

	t.Run("defaults to page 1 / pageSize 50 with just a date", func(t *testing.T) {
		w := httptest.NewRecorder()
		r := httptest.NewRequest(http.MethodGet, "/api/miners/alerts/history?date=2026-07-14", nil)

		ListAlertsHistory(cfg)(w, r)

		var got AlertHistoryResponse
		if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if got.Page != 1 || got.PageSize != defaultHistoryPageSize {
			t.Errorf("Page/PageSize = %d/%d, want 1/%d", got.Page, got.PageSize, defaultHistoryPageSize)
		}
	})
}
