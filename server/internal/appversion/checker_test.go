package appversion

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func releaseServer(t *testing.T, targetCommitish, htmlURL string) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"target_commitish": targetCommitish,
			"html_url":         htmlURL,
		})
	}))
	t.Cleanup(server.Close)
	return server
}

func TestChecker_neverCheckedFetchesImmediately(t *testing.T) {
	server := releaseServer(t, "94a060b47f9a1862892306c33f20d0ef51c22551", "https://example.com/releases/latest")

	checker := NewChecker(testLogger(), server.URL, "94a060b")
	got := checker.Result()

	if got.Status != StatusUpToDate {
		t.Errorf("Status = %q, want %q", got.Status, StatusUpToDate)
	}
	if got.ReleaseURL != "https://example.com/releases/latest" {
		t.Errorf("ReleaseURL = %q, want the release page URL", got.ReleaseURL)
	}
}

func TestChecker_reportsUpdateAvailableWhenBehind(t *testing.T) {
	server := releaseServer(t, "94a060b47f9a1862892306c33f20d0ef51c22551", "https://example.com/releases/latest")

	checker := NewChecker(testLogger(), server.URL, "fdcb38c")
	got := checker.Result()

	if got.Status != StatusUpdateAvailable {
		t.Errorf("Status = %q, want %q", got.Status, StatusUpdateAvailable)
	}
}

func TestChecker_stripsDirtySuffixBeforeComparing(t *testing.T) {
	server := releaseServer(t, "94a060b47f9a1862892306c33f20d0ef51c22551", "https://example.com/releases/latest")

	checker := NewChecker(testLogger(), server.URL, "94a060b-dirty")
	got := checker.Result()

	if got.Status != StatusUpToDate {
		t.Errorf("Status = %q, want %q (a dirty local build matching the latest release)", got.Status, StatusUpToDate)
	}
}

func TestChecker_devBuildNeverChecksNetwork(t *testing.T) {
	called := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	checker := NewChecker(testLogger(), server.URL, "dev")
	got := checker.Result()

	if called {
		t.Error("Result() hit the network for a \"dev\" build, want it to skip the check entirely")
	}
	if got.Status != StatusUnknown {
		t.Errorf("Status = %q, want %q for a dev build", got.Status, StatusUnknown)
	}
}

func TestChecker_skipsFetchWhenFresh(t *testing.T) {
	called := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{"target_commitish": "abcdef1234567890", "html_url": "x"})
	}))
	defer server.Close()

	checker := NewChecker(testLogger(), server.URL, "abcdef1")
	checker.Result() // first call: always fetches

	called = false
	checker.Result() // second call, immediately after: cache is fresh

	if called {
		t.Error("Result() re-fetched even though the cache is within CheckInterval")
	}
}

func TestChecker_refetchesOnceStale(t *testing.T) {
	callCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{"target_commitish": "abcdef1234567890", "html_url": "x"})
	}))
	defer server.Close()

	checker := NewChecker(testLogger(), server.URL, "0000000")
	checker.Result()
	if callCount != 1 {
		t.Fatalf("callCount after first Result() = %d, want 1", callCount)
	}

	// Force staleness without waiting a real 24h.
	checker.mu.Lock()
	checker.lastChecked = time.Now().Add(-CheckInterval - time.Minute)
	checker.mu.Unlock()

	checker.Result()
	if callCount != 2 {
		t.Errorf("callCount after stale Result() = %d, want 2", callCount)
	}
}

func TestChecker_fetchErrorLeavesPreviousResultUntouched(t *testing.T) {
	up := true
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if up {
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(map[string]string{"target_commitish": "abcdef1234567890", "html_url": "x"})
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	checker := NewChecker(testLogger(), server.URL, "0000000")
	first := checker.Result()
	if first.Status != StatusUpdateAvailable {
		t.Fatalf("first Result().Status = %q, want %q", first.Status, StatusUpdateAvailable)
	}

	up = false
	checker.mu.Lock()
	checker.lastChecked = time.Now().Add(-CheckInterval - time.Minute)
	checker.mu.Unlock()

	second := checker.Result()
	if second.Status != first.Status || second.ReleaseURL != first.ReleaseURL {
		t.Errorf("Result() after a failed refetch = %+v, want it unchanged from %+v", second, first)
	}
}

func TestChecker_malformedTargetCommitishLeavesPreviousResultUntouched(t *testing.T) {
	targetCommitish := "abcdef1234567890"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{"target_commitish": targetCommitish, "html_url": "x"})
	}))
	defer server.Close()

	checker := NewChecker(testLogger(), server.URL, "0000000")
	first := checker.Result()
	if first.Status != StatusUpdateAvailable {
		t.Fatalf("first Result().Status = %q, want %q", first.Status, StatusUpdateAvailable)
	}

	targetCommitish = "" // next fetch returns an unusable target_commitish
	checker.mu.Lock()
	checker.lastChecked = time.Now().Add(-CheckInterval - time.Minute)
	checker.mu.Unlock()

	second := checker.Result()
	if second != first {
		t.Errorf("Result() after a malformed release = %+v, want it unchanged from %+v", second, first)
	}
}
