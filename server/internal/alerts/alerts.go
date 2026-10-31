// Package alerts tracks each miner's alerts across the feeder's polls and
// records only their changes of state: an alert is raised once, when it
// starts, and cleared once, when it ends -- never repeated while it lasts.
// Each miner's state lives next to its data ({mac}/alerts.json); the
// changes, one append-only JSONL file per UTC day under {dataDir}/data/alerts.
package alerts

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"time"
)

const (
	TypeTempHigh       = "tempHigh"
	TypeFanHigh        = "fanHigh"
	TypeOffline        = "offline"
	TypeMacMismatch    = "macMismatch"
	TypeFirmwareUpdate = "firmwareUpdate"
)

// Types is every alert type, in the order the dashboard offers them.
var Types = []string{TypeTempHigh, TypeFanHigh, TypeOffline, TypeMacMismatch, TypeFirmwareUpdate}

// An alert is raised above its threshold and only cleared once back under
// a lower one, so a reading hovering around the threshold doesn't raise and
// clear it on every poll.
const (
	TempThreshold = 62.0 // °C
	TempClear     = 60.0
	FanThreshold  = 75.0 // %
	FanClear      = 70.0
)

// OfflineAfter is how many polls in a row must fail before a miner is
// reported offline -- a single timeout over WiFi isn't one.
const OfflineAfter = 2

type State string

const (
	Raised  State = "raised"
	Cleared State = "cleared"
)

type Event struct {
	Timestamp time.Time `json:"ts"`
	Mac       string    `json:"mac"`
	IP        string    `json:"ip,omitempty"`
	Hostname  string    `json:"hostname,omitempty"`
	Type      string    `json:"type"`
	State     State     `json:"state"`
	// Raised only: the reading that raised it (temp/fan), or what it's about
	// (the firmware available, the MAC reported, the connection error).
	Value     float64 `json:"value,omitempty"`
	Threshold float64 `json:"threshold,omitempty"`
	Message   string  `json:"message,omitempty"`
	// Cleared only: when it was raised, and the highest reading meanwhile
	// (temp/fan).
	RaisedAt *time.Time `json:"raisedAt,omitempty"`
	Peak     float64    `json:"peak,omitempty"`
}

// Poll is what one poll of a miner found. Err set: the miner didn't answer.
// ReportedMac set: another device answered at its IP. Otherwise, its
// readings.
type Poll struct {
	Err         error
	ReportedMac string
	Temp        float64
	FanSpeed    float64
	Version     string
	// LatestVersion is the latest firmware release -- empty when unknown,
	// which leaves the firmware alert as it was.
	LatestVersion string
}

// MinerState is one miner's alerts in progress, kept between polls.
type MinerState struct {
	Failures int `json:"failures,omitempty"`
	// Ongoing is each alert in progress by type: the event that raised it,
	// its Peak kept up to date.
	Ongoing map[string]Event `json:"ongoing,omitempty"`
}

// Observe updates s with poll p and returns the changes it brings, if any.
// An alert the poll can't tell anything about stays as it was: a miner
// that doesn't answer keeps its temperature alert until it answers again.
func (s *MinerState) Observe(now time.Time, p Poll) []Event {
	if s.Ongoing == nil {
		s.Ongoing = make(map[string]Event)
	}
	now = now.UTC().Truncate(time.Second)

	var events []Event
	set := func(alertType string, on bool, raised Event) {
		ongoing, active := s.Ongoing[alertType]
		switch {
		case on && !active:
			raised.Timestamp, raised.Type, raised.State = now, alertType, Raised
			events = append(events, raised)
			raised.Peak = raised.Value
			s.Ongoing[alertType] = raised
		case on && raised.Value > ongoing.Peak:
			ongoing.Peak = raised.Value
			s.Ongoing[alertType] = ongoing
		case !on && active:
			delete(s.Ongoing, alertType)
			events = append(events, Event{Timestamp: now, Type: alertType, State: Cleared, RaisedAt: &ongoing.Timestamp, Peak: ongoing.Peak})
		}
	}

	if p.Err != nil {
		s.Failures++
		if s.Failures >= OfflineAfter {
			set(TypeOffline, true, Event{Message: p.Err.Error()})
		}
		return events
	}
	s.Failures = 0
	set(TypeOffline, false, Event{})

	set(TypeMacMismatch, p.ReportedMac != "", Event{Message: p.ReportedMac})
	if p.ReportedMac != "" {
		return events
	}

	_, tempActive := s.Ongoing[TypeTempHigh]
	set(TypeTempHigh, p.Temp > TempThreshold || tempActive && p.Temp >= TempClear,
		Event{Value: p.Temp, Threshold: TempThreshold})

	_, fanActive := s.Ongoing[TypeFanHigh]
	set(TypeFanHigh, p.FanSpeed > FanThreshold || fanActive && p.FanSpeed >= FanClear,
		Event{Value: p.FanSpeed, Threshold: FanThreshold})

	if p.LatestVersion != "" && p.Version != "" {
		set(TypeFirmwareUpdate, p.Version != p.LatestVersion, Event{Message: p.LatestVersion})
	}
	return events
}

const stateFile = "alerts.json"

// LoadState reads a miner's state from its data directory -- an empty one
// when there's none yet.
func LoadState(minerDir string) (MinerState, error) {
	var s MinerState
	data, err := os.ReadFile(filepath.Join(minerDir, stateFile))
	if errors.Is(err, os.ErrNotExist) {
		return s, nil
	}
	if err != nil {
		return s, err
	}
	return s, json.Unmarshal(data, &s)
}

// SaveState writes it atomically: a state half written would raise again
// every alert in progress.
func SaveState(minerDir string, s MinerState) error {
	data, err := json.Marshal(s)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(minerDir, 0o755); err != nil {
		return err
	}
	path := filepath.Join(minerDir, stateFile)
	if err := os.WriteFile(path+".tmp", data, 0o644); err != nil {
		return err
	}
	return os.Rename(path+".tmp", path)
}
