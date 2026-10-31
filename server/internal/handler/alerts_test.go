package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/alerts"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
)

func alertsTestConfig(t *testing.T) config.Config {
	t.Helper()
	cfg := config.Config{
		Storage: config.StorageConfig{DataDir: t.TempDir()},
		Bitaxes: []config.Bitaxe{
			{Ip: "10.0.0.1", Mac: "aa:bb:cc:dd:ee:ff", Hostname: "bitaxe-office", Alias: "Office", Enabled: true},
			{Ip: "10.0.0.2", Mac: "112233445566", Hostname: "bitaxe-garage", Enabled: true},
		},
	}

	day := time.Now().UTC().Truncate(24 * time.Hour)
	at := func(h int) time.Time { return day.Add(time.Duration(h) * time.Hour) }
	raisedAt := at(1)
	events := []alerts.Event{
		{Timestamp: at(1), Mac: "aabbccddeeff", IP: "10.0.0.1", Hostname: "old-name", Type: alerts.TypeTempHigh, State: alerts.Raised, Value: 64},
		{Timestamp: at(2), Mac: "112233445566", IP: "10.0.0.2", Type: alerts.TypeOffline, State: alerts.Raised},
		{Timestamp: at(3), Mac: "aabbccddeeff", IP: "10.0.0.1", Type: alerts.TypeTempHigh, State: alerts.Cleared, RaisedAt: &raisedAt},
		// No longer configured: keeps the name it had then.
		{Timestamp: at(4), Mac: "999999999999", IP: "10.0.0.9", Hostname: "gone", Type: alerts.TypeFanHigh, State: alerts.Raised},
	}
	log := alerts.NewLog(cfg.Storage.AlertsDir())
	for _, e := range events {
		if err := log.Record([]alerts.Event{e}); err != nil {
			t.Fatal(err)
		}
	}
	return cfg
}

func serve(t *testing.T, h http.HandlerFunc, method, target, body string) *httptest.ResponseRecorder {
	t.Helper()
	w := httptest.NewRecorder()
	h(w, httptest.NewRequest(method, target, strings.NewReader(body)))
	return w
}

func decode[T any](t *testing.T, w *httptest.ResponseRecorder) T {
	t.Helper()
	var v T
	if err := json.Unmarshal(w.Body.Bytes(), &v); err != nil {
		t.Fatalf("decode %s: %v", w.Body.String(), err)
	}
	return v
}

func TestListAlerts(t *testing.T) {
	cfg := alertsTestConfig(t)

	w := serve(t, ListAlerts(cfg), http.MethodGet, "/api/miners/alerts", "")
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	got := decode[AlertsResponse](t, w)
	if len(got.Events) != 4 || got.SeenAt != nil {
		t.Fatalf("got %+v, want the 4 events and no seenAt", got)
	}
	wantNames := []string{"gone", "Office", "bitaxe-garage", "Office"}
	for i, e := range got.Events {
		if e.Hostname != wantNames[i] {
			t.Errorf("event %d hostname = %q, want %q (most recent first, named as configured now)", i, e.Hostname, wantNames[i])
		}
	}

	limited := decode[AlertsResponse](t, serve(t, ListAlerts(cfg), http.MethodGet, "/api/miners/alerts?limit=1", ""))
	if len(limited.Events) != 1 || limited.Events[0].Type != alerts.TypeFanHigh {
		t.Errorf("limit=1 = %+v, want the most recent one", limited.Events)
	}
}

func TestListAlerts_none(t *testing.T) {
	w := serve(t, ListAlerts(config.Config{Storage: config.StorageConfig{DataDir: t.TempDir()}}), http.MethodGet, "/api/miners/alerts", "")
	if body := strings.TrimSpace(w.Body.String()); body != `{"events":[]}` {
		t.Errorf("body = %s, want an empty list", body)
	}
}

func TestMarkAlertsSeen(t *testing.T) {
	cfg := alertsTestConfig(t)
	seenAt := time.Date(2026, 10, 28, 9, 30, 0, 123_000_000, time.UTC)

	w := serve(t, MarkAlertsSeen(cfg), http.MethodPost, "/api/miners/alerts/seen", `{"seenAt":"2026-10-28T09:30:00.123Z"}`)
	if w.Code != http.StatusOK || !decode[AlertsSeen](t, w).SeenAt.Equal(seenAt) {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}

	earlier := serve(t, MarkAlertsSeen(cfg), http.MethodPost, "/api/miners/alerts/seen", `{"seenAt":"2026-10-28T08:00:00Z"}`)
	if !decode[AlertsSeen](t, earlier).SeenAt.Equal(seenAt) {
		t.Errorf("an earlier seenAt moved it back: %s", earlier.Body.String())
	}

	listed := decode[AlertsResponse](t, serve(t, ListAlerts(cfg), http.MethodGet, "/api/miners/alerts", ""))
	if listed.SeenAt == nil || !listed.SeenAt.Equal(seenAt) {
		t.Errorf("ListAlerts seenAt = %v, want %v", listed.SeenAt, seenAt)
	}

	for _, body := range []string{``, `{}`, `{"seenAt":"yesterday"}`} {
		if w := serve(t, MarkAlertsSeen(cfg), http.MethodPost, "/api/miners/alerts/seen", body); w.Code != http.StatusBadRequest {
			t.Errorf("body %q: status = %d, want %d", body, w.Code, http.StatusBadRequest)
		}
	}
}

func TestListAlertsHistory(t *testing.T) {
	cfg := alertsTestConfig(t)
	today := time.Now().UTC().Format("2006-01-02")
	history := func(query string) AlertHistoryResponse {
		t.Helper()
		w := serve(t, ListAlertsHistory(cfg), http.MethodGet, "/api/miners/alerts/history?date="+today+query, "")
		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
		}
		return decode[AlertHistoryResponse](t, w)
	}

	for _, date := range []string{"", "../../etc", "2026-1-1"} {
		if w := serve(t, ListAlertsHistory(cfg), http.MethodGet, "/api/miners/alerts/history?date="+date, ""); w.Code != http.StatusBadRequest {
			t.Errorf("date %q: status = %d, want %d", date, w.Code, http.StatusBadRequest)
		}
	}

	if all := history(""); all.Total != 4 || len(all.Events) != 4 || all.Events[0].Type != alerts.TypeFanHigh {
		t.Errorf("all = %+v, want the 4 events, most recent first", all)
	}

	byIP := history("&ip=10.0.0.1")
	if byIP.Total != 2 || byIP.Events[0].State != alerts.Cleared || byIP.Events[1].State != alerts.Raised {
		t.Errorf("ip filter = %+v, want the office miner's tempHigh cleared then raised", byIP)
	}
	if byType := history("&type=offline"); byType.Total != 1 || byType.Events[0].IP != "10.0.0.2" {
		t.Errorf("type filter = %+v, want the garage miner's offline", byType)
	}

	page2 := history("&pageSize=3&page=2")
	if page2.Total != 4 || len(page2.Events) != 1 || page2.Page != 2 || page2.PageSize != 3 {
		t.Errorf("page 2 = %+v, want the 4th event alone", page2)
	}
	if past := history("&page=9"); past.Total != 4 || len(past.Events) != 0 {
		t.Errorf("past the last page = %+v, want no events", past)
	}

	empty := serve(t, ListAlertsHistory(cfg), http.MethodGet, "/api/miners/alerts/history?date=2020-01-01", "")
	if !strings.Contains(empty.Body.String(), `"events":[]`) {
		t.Errorf("a day with nothing = %s, want an empty list", empty.Body.String())
	}
}

func TestListActiveAlerts(t *testing.T) {
	cfg := config.Config{
		Storage: config.StorageConfig{DataDir: t.TempDir()},
		Bitaxes: []config.Bitaxe{
			{Ip: "10.0.0.1", Mac: "aabbccddeeff", Hostname: "bitaxe-office", Alias: "Office", Enabled: true},
			{Ip: "10.0.0.2", Mac: "112233445566", Hostname: "bitaxe-garage", Enabled: true},
			{Ip: "10.0.0.3", Mac: "665544332211", Hostname: "bitaxe-off", Enabled: false},
		},
	}
	threeDaysAgo := time.Now().UTC().AddDate(0, 0, -3).Truncate(time.Second)
	save := func(mac string, ongoing ...alerts.Event) {
		t.Helper()
		state := alerts.MinerState{Ongoing: map[string]alerts.Event{}}
		for _, e := range ongoing {
			state.Ongoing[e.Type] = e
		}
		if err := alerts.SaveState(filepath.Join(cfg.Storage.BitaxesDir(), mac), state); err != nil {
			t.Fatal(err)
		}
	}
	save("aabbccddeeff",
		alerts.Event{Timestamp: threeDaysAgo, Type: alerts.TypeFirmwareUpdate, State: alerts.Raised, Message: "v2.15.4"},
		alerts.Event{Timestamp: threeDaysAgo.Add(time.Hour), Type: alerts.TypeFanHigh, State: alerts.Raised, Value: 84},
	)
	// Disabled: its alerts in progress aren't the fleet's.
	save("665544332211", alerts.Event{Timestamp: threeDaysAgo, Type: alerts.TypeOffline, State: alerts.Raised})

	w := serve(t, ListActiveAlerts(cfg), http.MethodGet, "/api/miners/alerts/active", "")
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	got := decode[[]alerts.Event](t, w)
	if len(got) != 2 {
		t.Fatalf("got %+v, want the office miner's 2 alerts in progress", got)
	}
	if got[0].Type != alerts.TypeFanHigh || got[0].Value != 84 || got[1].Type != alerts.TypeFirmwareUpdate || got[1].Message != "v2.15.4" {
		t.Errorf("got %+v, want fanHigh then firmwareUpdate (most recent first), as raised", got)
	}
	for _, e := range got {
		if e.Mac != "aabbccddeeff" || e.IP != "10.0.0.1" || e.Hostname != "Office" || !e.Timestamp.Equal(threeDaysAgo) && !e.Timestamp.Equal(threeDaysAgo.Add(time.Hour)) {
			t.Errorf("event %+v, want the office miner's, raised 3 days ago", e)
		}
	}

	none := serve(t, ListActiveAlerts(config.Config{Storage: cfg.Storage}), http.MethodGet, "/api/miners/alerts/active", "")
	if body := strings.TrimSpace(none.Body.String()); body != "[]" {
		t.Errorf("no miner: body = %s, want []", body)
	}
}

// Alerts of the same poll come out the same way in every list -- by type,
// then MAC -- whatever order they were written in, or the miners' names.
func TestAlerts_sameOrderEverywhere(t *testing.T) {
	cfg := config.Config{
		Storage: config.StorageConfig{DataDir: t.TempDir()},
		// Neither in MAC nor in name order, as miners.yml may well be.
		Bitaxes: []config.Bitaxe{
			{Ip: "10.0.0.3", Mac: "000000000003", Hostname: "Atchoum", Enabled: true},
			{Ip: "10.0.0.1", Mac: "000000000001", Hostname: "Prof", Enabled: true},
			{Ip: "10.0.0.2", Mac: "000000000002", Hostname: "Dormeur", Enabled: true},
		},
	}
	now := time.Now().UTC().Truncate(time.Second)
	written := []alerts.Event{
		{Mac: "000000000003", Type: alerts.TypeFirmwareUpdate},
		{Mac: "000000000001", Type: alerts.TypeFirmwareUpdate},
		{Mac: "000000000002", Type: alerts.TypeFirmwareUpdate},
		{Mac: "000000000001", Type: alerts.TypeFanHigh},
		{Mac: "000000000003", Type: alerts.TypeOffline},
	}
	ongoing := map[string]alerts.MinerState{}
	for i := range written {
		written[i].Timestamp, written[i].State = now, alerts.Raised
		state := ongoing[written[i].Mac]
		if state.Ongoing == nil {
			state.Ongoing = map[string]alerts.Event{}
		}
		state.Ongoing[written[i].Type] = written[i]
		ongoing[written[i].Mac] = state
	}
	if err := alerts.NewLog(cfg.Storage.AlertsDir()).Record(written); err != nil {
		t.Fatal(err)
	}
	for mac, state := range ongoing {
		if err := alerts.SaveState(filepath.Join(cfg.Storage.BitaxesDir(), mac), state); err != nil {
			t.Fatal(err)
		}
	}

	want := []string{"Atchoum offline", "Prof fanHigh", "Prof firmwareUpdate", "Dormeur firmwareUpdate", "Atchoum firmwareUpdate"}
	order := func(events []alerts.Event) []string {
		var got []string
		for _, e := range events {
			got = append(got, e.Hostname+" "+e.Type)
		}
		return got
	}
	date := now.Format("2006-01-02")
	for name, got := range map[string][]alerts.Event{
		"bell":        decode[AlertsResponse](t, serve(t, ListAlerts(cfg), http.MethodGet, "/api/miners/alerts", "")).Events,
		"history":     decode[AlertHistoryResponse](t, serve(t, ListAlertsHistory(cfg), http.MethodGet, "/api/miners/alerts/history?date="+date, "")).Events,
		"in progress": decode[[]alerts.Event](t, serve(t, ListActiveAlerts(cfg), http.MethodGet, "/api/miners/alerts/active", "")),
	} {
		if g := order(got); strings.Join(g, ", ") != strings.Join(want, ", ") {
			t.Errorf("%s: %v, want %v", name, g, want)
		}
	}

	// Paginated, the order is the whole day's, not each page's.
	page2 := decode[AlertHistoryResponse](t, serve(t, ListAlertsHistory(cfg), http.MethodGet, "/api/miners/alerts/history?date="+date+"&pageSize=2&page=2", ""))
	if g := order(page2.Events); strings.Join(g, ", ") != strings.Join(want[2:4], ", ") {
		t.Errorf("page 2: %v, want %v", g, want[2:4])
	}
}
