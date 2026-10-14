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
