// Package audit records every user-triggered action that matters -- a
// change on a miner (restart, pool switch) or in the managed config files,
// data leaving the Pi (audit export, backups download), a network scan --
// whether it came through the API or from the app itself (the scheduler),
// as one append-only JSONL file per day under {dataDir}/data/audit.
// Automatic reads (the dashboard's polling) are deliberately not recorded.
package audit

import (
	"bufio"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type Source string

const (
	SourceAPI    Source = "api"
	SourceSystem Source = "system"
)

// Service names which part of the app acted on its own, for a
// SourceSystem entry -- the counterpart of IP for a SourceAPI one.
const ServiceScheduler = "scheduler"

// Type values deliberately reuse config.ScheduleAction's strings for the
// three actions a schedule can also trigger, so a restart reads the same in
// the log whoever triggered it.
const (
	TypeRestart        = "restart"
	TypeSwitchPrimary  = "switch_primary"
	TypeSwitchFallback = "switch_fallback"
	TypeSaveMiners     = "save_miners"
	TypeSaveSettings   = "save_settings"

	// Data leaving the Pi, or a scan run from it -- not a change, but
	// worth knowing who did it.
	TypeExportAudit     = "export_audit"
	TypeDownloadBackups = "download_backups"
	TypeDiscover        = "discover"
)

type Entry struct {
	Timestamp time.Time `json:"ts"`
	Source    Source    `json:"source"`
	Type      string    `json:"type"`
	// Target is the IP of the miner acted on -- empty for a config save,
	// or a pool switch applied to every miner.
	Target string `json:"target,omitempty"`

	// API only: there's no authentication, so the client's IP and
	// User-Agent are the closest thing to "who" this tool can record.
	IP        string `json:"ip,omitempty"`
	UserAgent string `json:"userAgent,omitempty"`
	RequestID string `json:"requestId,omitempty"`
	Status    int    `json:"status,omitempty"`
	// The request's query string, unescaped -- what was asked for (the
	// months downloaded, the exported range, the miner a pool switch
	// targeted...).
	Query string `json:"query,omitempty"`

	// System only.
	Service string `json:"service,omitempty"`
	Cron    string `json:"cron,omitempty"`

	// Why it failed, whatever its source.
	Error string `json:"error,omitempty"`
}

type Log struct {
	dir string
	mu  sync.Mutex
}

func NewLog(dir string) *Log {
	return &Log{dir: dir}
}

// Record appends e to its day's file. A nil Log is a valid no-op (here and
// in ReadRange), so a Router/Scheduler built without one (tests) doesn't
// need a guard.
func (l *Log) Record(e Entry) error {
	if l == nil {
		return nil
	}
	e.Timestamp = e.Timestamp.UTC().Truncate(time.Second)

	data, err := json.Marshal(e)
	if err != nil {
		return err
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	if err := os.MkdirAll(l.dir, 0o755); err != nil {
		return err
	}
	f, err := os.OpenFile(l.path(e.Timestamp.Format("2006-01-02")), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	_, err = f.Write(append(data, '\n'))
	return errors.Join(err, f.Close())
}

// ReadRange returns every entry with from <= ts < to, oldest first, by
// reading each UTC day's file the range touches. A day with no file is just
// empty, and a malformed line is skipped rather than failing the whole read.
// The caller bounds the range -- this reads one file per day in it.
func (l *Log) ReadRange(from, to time.Time) ([]Entry, error) {
	if l == nil {
		return nil, nil
	}
	from, to = from.UTC(), to.UTC()

	var entries []Entry
	for day := from.Truncate(24 * time.Hour); day.Before(to); day = day.Add(24 * time.Hour) {
		dayEntries, err := l.readDay(day.Format("2006-01-02"))
		if err != nil {
			return nil, err
		}
		for _, e := range dayEntries {
			if !e.Timestamp.Before(from) && e.Timestamp.Before(to) {
				entries = append(entries, e)
			}
		}
	}
	return entries, nil
}

func (l *Log) readDay(date string) ([]Entry, error) {
	f, err := os.Open(l.path(date))
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	defer func() { _ = f.Close() }()

	var entries []Entry
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		var e Entry
		if json.Unmarshal(scanner.Bytes(), &e) == nil {
			entries = append(entries, e)
		}
	}
	return entries, scanner.Err()
}

func (l *Log) path(date string) string {
	return filepath.Join(l.dir, date+".jsonl")
}
