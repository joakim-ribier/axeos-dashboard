package storage

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/model"
)

type RawSample struct {
	Timestamp       time.Time       `json:"ts"`
	Bitaxe          string          `json:"bitaxe"`
	Payload         json.RawMessage `json:"payload,omitempty"`
	ElectricityRate float64         `json:"electricityRatePerKwh,omitempty"`
	// Alerts is the feeder's own computed state for this poll -- see
	// model.Alert. Present even on a poll that failed or mismatched (in
	// which case Payload is empty and this is the only content of the line).
	Alerts []model.Alert `json:"alerts,omitempty"`
}

type RawStorage struct {
	baseDir         string
	electricityRate float64
}

func NewRawStorage(baseDir string, electricityRate float64) *RawStorage {
	return &RawStorage{
		baseDir:         baseDir,
		electricityRate: electricityRate,
	}
}

// Append appends a raw JSON payload to the daily JSONL file
// and updates latest.json for the given Bitaxe address.
func (s *RawStorage) Append(now time.Time, bitaxeAddr string, payload []byte, alerts []model.Alert) error {
	if !json.Valid(payload) {
		return fmt.Errorf("invalid JSON payload for %s — skipping write", bitaxeAddr)
	}

	dir := filepath.Join(s.baseDir, bitaxeAddr)

	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}

	sample := RawSample{
		Timestamp:       now.UTC().Truncate(time.Second),
		Bitaxe:          bitaxeAddr,
		Payload:         json.RawMessage(payload),
		ElectricityRate: s.electricityRate,
		Alerts:          alerts,
	}

	data, err := json.Marshal(sample)
	if err != nil {
		return err
	}

	// Daily JSONL file named by UTC date for timezone-portable exports
	filename := now.UTC().Format("2006-01-02") + ".jsonl"
	path := filepath.Join(dir, filename)

	if err := appendLine(path, data); err != nil {
		return err
	}

	// Update latest.json (overwrite) -- only on a successful, coherent poll.
	latestPath := filepath.Join(dir, "latest.json")
	return os.WriteFile(latestPath, data, 0o644)
}

// AppendAlertOnly records a tick that produced no usable payload (the fetch
// failed, or the device's reported MAC didn't match what's configured) --
// still worth persisting as an alert (so an offline/mismatch period shows up
// in the day's history), but latest.json must stay untouched: overwriting it
// with an empty payload would blank out the last real, known-good reading.
func (s *RawStorage) AppendAlertOnly(now time.Time, bitaxeAddr string, alerts []model.Alert) error {
	dir := filepath.Join(s.baseDir, bitaxeAddr)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}

	sample := RawSample{
		Timestamp: now.UTC().Truncate(time.Second),
		Bitaxe:    bitaxeAddr,
		Alerts:    alerts,
	}

	data, err := json.Marshal(sample)
	if err != nil {
		return err
	}

	filename := now.UTC().Format("2006-01-02") + ".jsonl"
	return appendLine(filepath.Join(dir, filename), data)
}

func appendLine(path string, data []byte) error {
	f, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	defer func() {
		if err := f.Close(); err != nil {
			log.Printf("warning: failed to close response body: %v", err)
		}
	}()

	if _, err := f.Write(data); err != nil {
		return err
	}
	_, err = f.Write([]byte("\n"))
	return err
}
