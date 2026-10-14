package remotepush

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

const boardJSON = `{"boardId":"abc","public":true,"hashboardURL":"https://hb.example","dashboardURL":"https://d.example/abc","lastSampleAt":"2026-10-14T07:00:00Z"}`

// newHashboard fakes hashboard's GET /api/board/info, counting its calls.
func newHashboard(t *testing.T, status int, calls *int) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		*calls++
		if r.URL.Path != "/api/board/info" {
			t.Errorf("path = %q, want /api/board/info", r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer key" {
			t.Errorf("Authorization = %q, want %q", got, "Bearer key")
		}
		w.WriteHeader(status)
		_, _ = w.Write([]byte(boardJSON))
	}))
	t.Cleanup(srv.Close)
	return srv
}

func TestFetchBoard(t *testing.T) {
	var calls int
	srv := newHashboard(t, http.StatusOK, &calls)

	// A trailing slash on pushURL must still land on /api/board/info.
	for _, pushURL := range []string{srv.URL + "/api/push", srv.URL + "/api/push/"} {
		got, err := FetchBoard(pushURL, "key")
		if err != nil {
			t.Fatalf("FetchBoard(%q) error = %v", pushURL, err)
		}
		if got.BoardID != "abc" || !got.Public || got.HashboardURL != "https://hb.example" || got.DashboardURL != "https://d.example/abc" {
			t.Errorf("FetchBoard(%q) = %+v", pushURL, got)
		}
		want := time.Date(2026, 10, 14, 7, 0, 0, 0, time.UTC)
		if got.LastSampleAt == nil || !got.LastSampleAt.Equal(want) {
			t.Errorf("LastSampleAt = %v, want %v", got.LastSampleAt, want)
		}
	}
}

func TestFetchBoard_errorStatus(t *testing.T) {
	var calls int
	srv := newHashboard(t, http.StatusUnauthorized, &calls)

	got, err := FetchBoard(srv.URL+"/api/push", "key")
	if err == nil {
		t.Fatal("FetchBoard() error = nil, want one on a 401")
	}
	if got != (Board{}) {
		t.Errorf("FetchBoard() = %+v, want an empty Board", got)
	}
}

func TestBoardCache(t *testing.T) {
	var calls int
	srv := newHashboard(t, http.StatusOK, &calls)
	pushURL := srv.URL + "/api/push"
	var c BoardCache

	for range 3 {
		if _, err := c.Get(pushURL, "key", time.Hour); err != nil {
			t.Fatalf("Get() error = %v", err)
		}
	}
	if calls != 1 {
		t.Errorf("calls within ttl = %d, want 1", calls)
	}

	if _, err := c.Get(pushURL, "key", 0); err != nil {
		t.Fatalf("Get() error = %v", err)
	}
	if calls != 2 {
		t.Errorf("calls once stale = %d, want 2", calls)
	}
}

func TestBoardCache_newCredentials(t *testing.T) {
	var calls int
	srv := newHashboard(t, http.StatusOK, &calls)
	var c BoardCache

	_, _ = c.Get(srv.URL+"/api/push", "key", time.Hour)
	_, _ = c.Get(srv.URL+"/api/push/", "key", time.Hour)
	if calls != 2 {
		t.Errorf("calls = %d, want 2 -- a different pushURL must not reuse the cache", calls)
	}
}

func TestBoardCache_cachesFailures(t *testing.T) {
	var calls int
	srv := newHashboard(t, http.StatusInternalServerError, &calls)
	var c BoardCache

	if _, err := c.Get(srv.URL+"/api/push", "key", time.Hour); err == nil {
		t.Fatal("first Get() error = nil, want the fetch error")
	}
	got, err := c.Get(srv.URL+"/api/push", "key", time.Hour)
	if err != nil || got != (Board{}) {
		t.Errorf("second Get() = %+v, %v, want an empty Board and no error", got, err)
	}
	if calls != 1 {
		t.Errorf("calls = %d, want 1 -- an unreachable hashboard isn't retried within ttl", calls)
	}
}
