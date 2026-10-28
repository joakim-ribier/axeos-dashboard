package alerts

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func event(ts time.Time, alertType string, state State) Event {
	return Event{Timestamp: ts, Mac: "aabbccddeeff", Type: alertType, State: state}
}

func TestLog_readDayMostRecentFirst(t *testing.T) {
	dir := t.TempDir()
	log := NewLog(dir)
	if err := log.Record([]Event{event(t0, TypeTempHigh, Raised), event(t0, TypeFanHigh, Raised)}); err != nil {
		t.Fatal(err)
	}
	if err := log.Record([]Event{event(t0.Add(time.Hour), TypeTempHigh, Cleared)}); err != nil {
		t.Fatal(err)
	}
	if err := log.Record(nil); err != nil {
		t.Fatal(err)
	}

	f, err := os.OpenFile(filepath.Join(dir, "2026-10-28.jsonl"), os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		t.Fatal(err)
	}
	_, _ = f.WriteString("not json\n")
	_ = f.Close()

	got, err := log.ReadDay("2026-10-28")
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"tempHigh cleared", "fanHigh raised", "tempHigh raised"}
	if len(got) != len(want) {
		t.Fatalf("got %+v, want %v (the malformed line skipped)", got, want)
	}
	for i, e := range got {
		if e.Type+" "+string(e.State) != want[i] {
			t.Errorf("event %d = %s %s, want %s", i, e.Type, e.State, want[i])
		}
	}

	if none, err := log.ReadDay("2026-10-27"); err != nil || len(none) != 0 {
		t.Errorf("ReadDay() of a day with no file = %+v, %v; want nothing", none, err)
	}
}

func TestLog_recordWritesTheUTCDay(t *testing.T) {
	dir := t.TempDir()
	// 01:30 in UTC+2 is still the 27th in UTC.
	ts := time.Date(2026, 10, 28, 1, 30, 0, 0, time.FixedZone("UTC+2", 2*3600)).UTC()
	if err := NewLog(dir).Record([]Event{event(ts, TypeOffline, Raised)}); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(dir, "2026-10-27.jsonl")); err != nil {
		t.Errorf("expected 2026-10-27.jsonl: %v", err)
	}
}

func TestLog_recentAcrossDays(t *testing.T) {
	log := NewLog(t.TempDir())
	for _, ts := range []time.Time{
		t0.AddDate(0, 0, -recentDays), // too old
		t0.AddDate(0, 0, -3),
		t0.AddDate(0, 0, -1),
		t0,
	} {
		if err := log.Record([]Event{event(ts, TypeOffline, Raised)}); err != nil {
			t.Fatal(err)
		}
	}

	got, err := log.Recent(t0, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 3 || !got[0].Timestamp.Equal(t0) || !got[2].Timestamp.Equal(t0.AddDate(0, 0, -3)) {
		t.Errorf("Recent() = %+v, want the 3 events of the last %d days, most recent first", got, recentDays)
	}

	limited, err := log.Recent(t0, 2)
	if err != nil {
		t.Fatal(err)
	}
	if len(limited) != 2 || !limited[1].Timestamp.Equal(t0.AddDate(0, 0, -1)) {
		t.Errorf("Recent(limit 2) = %+v, want the 2 most recent", limited)
	}
}

func TestLog_seenOnlyMovesForward(t *testing.T) {
	log := NewLog(filepath.Join(t.TempDir(), "alerts"))

	if seen, err := log.SeenAt(); err != nil || !seen.IsZero() {
		t.Fatalf("SeenAt() never marked = %v, %v; want zero", seen, err)
	}

	for _, tc := range []struct {
		mark, want time.Time
	}{
		{t0, t0},
		{t0.Add(-time.Hour), t0}, // never back
		{t0.Add(time.Minute), t0.Add(time.Minute)},
	} {
		got, err := log.MarkSeen(tc.mark)
		if err != nil {
			t.Fatal(err)
		}
		if !got.Equal(tc.want) {
			t.Errorf("MarkSeen(%v) = %v, want %v", tc.mark, got, tc.want)
		}
		if seen, _ := log.SeenAt(); !seen.Equal(tc.want) {
			t.Errorf("SeenAt() after MarkSeen(%v) = %v, want %v", tc.mark, seen, tc.want)
		}
	}
}
