package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
)

func sample(ts time.Time, hashRateGHs float64) string {
	return `{"ts":"` + ts.Format(time.RFC3339) + `","payload":{"macAddr":"aa","hashRate":` +
		jsonNumber(hashRateGHs) + `}}` + "\n"
}

func alertOnly(ts time.Time, alertType string) string {
	return `{"ts":"` + ts.Format(time.RFC3339) + `","alerts":[{"type":"` + alertType + `"}]}` + "\n"
}

func jsonNumber(f float64) string {
	b, _ := json.Marshal(f)
	return string(b)
}

func TestHistoryFrom(t *testing.T) {
	now := time.Date(2026, 10, 8, 10, 7, 0, 0, time.UTC)
	got := historyFrom(now)
	// The window ends on the boundary after now, so the current bucket
	// (10:00-10:15) is the last point.
	want := time.Date(2026, 10, 7, 10, 15, 0, 0, time.UTC)
	if !got.Equal(want) {
		t.Errorf("historyFrom(%v) = %v, want %v", now, got, want)
	}
}

func TestReadWindow(t *testing.T) {
	dir := t.TempDir()
	from := time.Date(2026, 10, 7, 10, 15, 0, 0, time.UTC)
	to := from.Add(rollingWindow)

	writeTestFile(t, filepath.Join(dir, "2026-10-07.jsonl"),
		sample(from.Add(-time.Minute), 1000)+ // before the window
			sample(from.Add(5*time.Minute), 1000))
	writeTestFile(t, filepath.Join(dir, "2026-10-08.jsonl"),
		sample(to.Add(-time.Minute), 1000)+
			sample(to, 1000)) // the window's end is excluded

	lines, err := readWindow(dir, from, to)
	if err != nil {
		t.Fatalf("readWindow: %v", err)
	}
	if len(lines) != 2 {
		t.Errorf("got %d lines, want the 2 inside the window (one from each day's file)", len(lines))
	}

	t.Run("no file for a day is not an error", func(t *testing.T) {
		lines, err := readWindow(t.TempDir(), from, to)
		if err != nil || len(lines) != 0 {
			t.Errorf("got %d lines, err %v; want none and no error", len(lines), err)
		}
	})
}

func TestReadMinerHistory(t *testing.T) {
	dir := t.TempDir()
	from := time.Date(2026, 10, 7, 10, 15, 0, 0, time.UTC)
	bucket := func(i int) time.Time { return from.Add(time.Duration(i) * historyBucket) }

	writeTestFile(t, filepath.Join(dir, "2026-10-07.jsonl"),
		// bucket 0: two readings, averaged (GH/s -> TH/s)
		sample(bucket(0).Add(time.Minute), 1000)+
			sample(bucket(0).Add(3*time.Minute), 2000)+
			// bucket 1: unreachable -- really mined nothing
			alertOnly(bucket(1).Add(time.Minute), "offline")+
			// bucket 2: one reading, one unreachable poll -- half the rate
			sample(bucket(2).Add(time.Minute), 1200)+
			alertOnly(bucket(2).Add(3*time.Minute), "offline")+
			// bucket 3: MAC mismatch -- another device answered, unknown
			alertOnly(bucket(3).Add(time.Minute), "macMismatch"))

	h := readMinerHistory(dir, "10.0.0.1", from)

	if h.IP != "10.0.0.1" {
		t.Errorf("IP = %q, want 10.0.0.1", h.IP)
	}
	if len(h.HashRate) != historyBuckets {
		t.Fatalf("got %d buckets, want %d", len(h.HashRate), historyBuckets)
	}
	tests := []struct {
		name   string
		bucket int
		want   *float64
	}{
		{"readings are averaged", 0, ptr(1.5)},
		{"an unreachable poll counts as zero", 1, ptr(0)},
		{"unreachable polls pull the average down", 2, ptr(0.6)},
		{"a MAC mismatch leaves the bucket unknown", 3, nil},
		{"no line at all leaves the bucket unknown", 4, nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := h.HashRate[tt.bucket]
			switch {
			case tt.want == nil && got != nil:
				t.Errorf("bucket %d = %v, want null", tt.bucket, *got)
			case tt.want != nil && (got == nil || *got != *tt.want):
				t.Errorf("bucket %d = %v, want %v", tt.bucket, got, *tt.want)
			}
		})
	}
}

func ptr(f float64) *float64 { return &f }

func TestHistory(t *testing.T) {
	dir := t.TempDir()
	t.Setenv(envDataRoot, dir)
	now := time.Now().UTC()
	writeTestFile(t, filepath.Join(dir, "aabbccddeeff", now.Format("2006-01-02")+".jsonl"),
		sample(now.Add(-time.Minute), 1000))

	cfg := config.Config{
		Bitaxes: []config.Bitaxe{
			{Ip: "10.0.0.1", Mac: "aabbccddeeff", Enabled: true},
			{Ip: "10.0.0.2", Enabled: true}, // no mac: skipped, not an error
		},
	}
	w := httptest.NewRecorder()
	History(cfg, w, httptest.NewRequest(http.MethodGet, "/api/miners/history", nil))

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}
	var resp HistoryResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp.BucketSeconds != int(historyBucket.Seconds()) {
		t.Errorf("BucketSeconds = %d, want %d", resp.BucketSeconds, int(historyBucket.Seconds()))
	}
	if len(resp.Miners) != 1 || resp.Miners[0].IP != "10.0.0.1" {
		t.Fatalf("miners = %+v, want only 10.0.0.1", resp.Miners)
	}
	// The reading is a minute old: the current bucket, or the previous one
	// when the test runs in a bucket's first minute.
	var known []float64
	for _, v := range resp.Miners[0].HashRate {
		if v != nil {
			known = append(known, *v)
		}
	}
	if len(known) != 1 || known[0] != 1 {
		t.Errorf("known buckets = %v, want a single 1 TH/s", known)
	}
}

func TestRemoteHistory(t *testing.T) {
	dir := t.TempDir()
	now := time.Now().UTC()
	minerDir := filepath.Join(dir, "data", "boards", "demo", "bitaxes", "aabbccddeeff")
	writeTestFile(t, filepath.Join(minerDir, "latest.json"),
		`{"ts":"`+now.Format(time.RFC3339)+`","ip":"10.0.0.7","payload":{"macAddr":"aa"}}`)
	writeTestFile(t, filepath.Join(minerDir, now.Format("2006-01-02")+".jsonl"),
		sample(now.Add(-time.Minute), 1200))
	cfg := config.Config{Storage: config.StorageConfig{DataDir: dir}}

	get := func(board string) *httptest.ResponseRecorder {
		w := httptest.NewRecorder()
		r := withURLParams(httptest.NewRequest(http.MethodGet, "/api/"+board+"/miners/history", nil),
			map[string]string{"boardId": board})
		RemoteHistory(cfg)(w, r)
		return w
	}

	t.Run("known board", func(t *testing.T) {
		w := get("demo")
		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
		}
		var resp HistoryResponse
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if len(resp.Miners) != 1 || resp.Miners[0].IP != "10.0.0.7" {
			t.Errorf("miners = %+v, want only 10.0.0.7 (the ip from latest.json)", resp.Miners)
		}
	})

	t.Run("unknown board returns 404", func(t *testing.T) {
		if w := get("unknown"); w.Code != http.StatusNotFound {
			t.Errorf("status = %d, want %d", w.Code, http.StatusNotFound)
		}
	})
}
