package audit

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func mustTime(t *testing.T, s string) time.Time {
	t.Helper()
	ts, err := time.Parse(time.RFC3339, s)
	if err != nil {
		t.Fatal(err)
	}
	return ts
}

func TestLog_recordWritesOneFilePerUTCDay(t *testing.T) {
	dir := t.TempDir()
	log := NewLog(dir)

	// 01:30 in UTC+2 is still the 9th in UTC.
	if err := log.Record(Entry{Timestamp: mustTime(t, "2026-10-10T01:30:00+02:00"), Type: TypeRestart}); err != nil {
		t.Fatal(err)
	}
	if err := log.Record(Entry{Timestamp: mustTime(t, "2026-10-10T08:00:00Z"), Type: TypeSaveMiners}); err != nil {
		t.Fatal(err)
	}

	for _, name := range []string{"2026-10-09.jsonl", "2026-10-10.jsonl"} {
		if _, err := os.Stat(filepath.Join(dir, name)); err != nil {
			t.Errorf("expected %s: %v", name, err)
		}
	}
}

func TestLog_readRange(t *testing.T) {
	log := NewLog(t.TempDir())
	for _, ts := range []string{
		"2026-10-08T23:59:59Z", // before the range
		"2026-10-09T10:00:00Z", // from, inclusive
		"2026-10-09T22:00:00Z",
		"2026-10-10T09:59:59Z",
		"2026-10-10T10:00:00Z", // to, exclusive
	} {
		if err := log.Record(Entry{Timestamp: mustTime(t, ts), Type: TypeRestart}); err != nil {
			t.Fatal(err)
		}
	}

	entries, err := log.ReadRange(mustTime(t, "2026-10-09T10:00:00Z"), mustTime(t, "2026-10-10T10:00:00Z"))
	if err != nil {
		t.Fatal(err)
	}

	want := []string{"2026-10-09T10:00:00Z", "2026-10-09T22:00:00Z", "2026-10-10T09:59:59Z"}
	if len(entries) != len(want) {
		t.Fatalf("got %d entries, want %d: %+v", len(entries), len(want), entries)
	}
	for i, e := range entries {
		if got := e.Timestamp.Format(time.RFC3339); got != want[i] {
			t.Errorf("entries[%d].ts = %s, want %s", i, got, want[i])
		}
	}
}

func TestLog_readRangeSkipsMalformedLinesAndMissingDays(t *testing.T) {
	dir := t.TempDir()
	content := `{"ts":"2026-10-10T08:00:00Z","source":"api","type":"restart"}
not json
{"ts":"2026-10-10T09:00:00Z","source":"api","type":"save_miners"}
`
	if err := os.WriteFile(filepath.Join(dir, "2026-10-10.jsonl"), []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}

	entries, err := NewLog(dir).ReadRange(mustTime(t, "2026-10-08T00:00:00Z"), mustTime(t, "2026-10-11T00:00:00Z"))
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 2 {
		t.Errorf("got %d entries, want 2", len(entries))
	}
}

func TestLog_nilIsANoOp(t *testing.T) {
	var log *Log
	if err := log.Record(Entry{Type: TypeRestart}); err != nil {
		t.Errorf("Record on nil log: %v", err)
	}
	entries, err := log.ReadRange(time.Now().Add(-time.Hour), time.Now())
	if err != nil || entries != nil {
		t.Errorf("ReadRange on nil log = %v, %v, want nil, nil", entries, err)
	}
}
