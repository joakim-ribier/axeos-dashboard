package handler

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/remotepush"
)

func serveRemoteBoard(t *testing.T, cfg config.Config) remotepush.Board {
	t.Helper()
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/remote/board", nil)
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	RemoteBoard(cfg, &remotepush.BoardCache{}, logger, w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}
	var got remotepush.Board
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	return got
}

func TestRemoteBoard_notConfigured(t *testing.T) {
	if got := serveRemoteBoard(t, config.Config{}); got != (remotepush.Board{}) {
		t.Errorf("RemoteBoard() = %+v, want an empty Board", got)
	}
}

func TestRemoteBoard_relaysHashboard(t *testing.T) {
	hashboard := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"boardId":"abc","public":true,"dashboardURL":"https://d.example/abc"}`))
	}))
	defer hashboard.Close()

	cfg := config.Config{
		Remote: config.RemoteConfig{PushURL: hashboard.URL + "/api/push", APIKey: "key"},
		Feeder: config.FeederConfig{Interval: time.Minute},
	}
	got := serveRemoteBoard(t, cfg)
	if got.BoardID != "abc" || !got.Public || got.DashboardURL != "https://d.example/abc" {
		t.Errorf("RemoteBoard() = %+v", got)
	}
}

// An unreachable hashboard (or one without /api/board/info yet) must not
// fail the request -- the UI just shows no board.
func TestRemoteBoard_hashboardDown(t *testing.T) {
	hashboard := httptest.NewServer(http.NotFoundHandler())
	defer hashboard.Close()

	cfg := config.Config{
		Remote: config.RemoteConfig{PushURL: hashboard.URL + "/api/push", APIKey: "key"},
		Feeder: config.FeederConfig{Interval: time.Minute},
	}
	if got := serveRemoteBoard(t, cfg); got != (remotepush.Board{}) {
		t.Errorf("RemoteBoard() = %+v, want an empty Board", got)
	}
}

// The miners past the board's limit are named, as the feeder holds them.
func TestRemoteBoard_namesTheMinersNotSent(t *testing.T) {
	hashboard := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"boardId":"abc","minerQuota":{"limit":1,"count":1}}`))
	}))
	defer hashboard.Close()

	cfg := config.Config{
		Remote: config.RemoteConfig{PushURL: hashboard.URL + "/api/push", APIKey: "key"},
		Feeder: config.FeederConfig{Interval: time.Minute},
		Bitaxes: []config.Bitaxe{
			{Hostname: "first", Mac: "aa:aa:aa:aa:aa:01", Enabled: true},
			{Hostname: "off", Mac: "aa:aa:aa:aa:aa:02"},
			{Hostname: "second", Alias: "Garage", Mac: "aa:aa:aa:aa:aa:03", Enabled: true},
		},
	}
	w := httptest.NewRecorder()
	RemoteBoard(cfg, &remotepush.BoardCache{}, slog.New(slog.NewTextHandler(io.Discard, nil)), w, httptest.NewRequest(http.MethodGet, "/api/remote/board", nil))

	var got RemoteBoardResponse
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.MinerQuota == nil || got.MinerQuota.Limit != 1 {
		t.Errorf("MinerQuota = %+v, want limit 1", got.MinerQuota)
	}
	if len(got.NotSent) != 1 || got.NotSent[0] != "Garage" {
		t.Errorf("NotSent = %v, want [Garage]", got.NotSent)
	}
}

// A refused API key is said as such, not as a board that isn't there.
func TestRemoteBoard_saysTheKeyIsRefused(t *testing.T) {
	hashboard := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer hashboard.Close()

	cfg := config.Config{
		Remote: config.RemoteConfig{PushURL: hashboard.URL + "/api/push", APIKey: "old-key"},
		Feeder: config.FeederConfig{Interval: time.Minute},
	}
	w := httptest.NewRecorder()
	RemoteBoard(cfg, &remotepush.BoardCache{}, slog.New(slog.NewTextHandler(io.Discard, nil)), w, httptest.NewRequest(http.MethodGet, "/api/remote/board", nil))

	var got RemoteBoardResponse
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.State != remotepush.StateUnauthorized {
		t.Errorf("State = %q, want %q", got.State, remotepush.StateUnauthorized)
	}
}
