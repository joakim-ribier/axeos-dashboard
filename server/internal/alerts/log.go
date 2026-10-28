package alerts

import (
	"bufio"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"slices"
	"time"
)

// Log is the alerts' changes of state, one JSONL file per UTC day. Only the
// feeder writes to it.
type Log struct {
	dir string
}

func NewLog(dir string) *Log {
	return &Log{dir: dir}
}

// Record appends events to the day of the first one -- they all come from
// the same poll.
func (l *Log) Record(events []Event) error {
	if len(events) == 0 {
		return nil
	}
	var lines []byte
	for _, e := range events {
		data, err := json.Marshal(e)
		if err != nil {
			return err
		}
		lines = append(append(lines, data...), '\n')
	}

	if err := os.MkdirAll(l.dir, 0o755); err != nil {
		return err
	}
	f, err := os.OpenFile(l.path(events[0].Timestamp.Format("2006-01-02")), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	_, err = f.Write(lines)
	return errors.Join(err, f.Close())
}

// ReadDay returns one UTC day's events (YYYY-MM-DD), most recent first. A
// day with no file is just empty, and a malformed line is skipped.
func (l *Log) ReadDay(date string) ([]Event, error) {
	f, err := os.Open(l.path(date))
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	defer func() { _ = f.Close() }()

	var events []Event
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		var e Event
		if json.Unmarshal(scanner.Bytes(), &e) == nil {
			events = append(events, e)
		}
	}
	slices.Reverse(events)
	return events, scanner.Err()
}

// recentDays bounds how far back Recent looks for its events.
const recentDays = 30

// Recent returns the limit most recent events, most recent first, from the
// last recentDays days.
func (l *Log) Recent(now time.Time, limit int) ([]Event, error) {
	var events []Event
	day := now.UTC()
	for range recentDays {
		dayEvents, err := l.ReadDay(day.Format("2006-01-02"))
		if err != nil {
			return nil, err
		}
		events = append(events, dayEvents...)
		if len(events) >= limit {
			return events[:limit], nil
		}
		day = day.AddDate(0, 0, -1)
	}
	return events, nil
}

func (l *Log) path(date string) string {
	return filepath.Join(l.dir, date+".jsonl")
}
