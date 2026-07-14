package storage

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"
)

type RawSample struct {
	Timestamp       time.Time       `json:"ts"`
	Bitaxe          string          `json:"bitaxe"`
	Payload         json.RawMessage `json:"payload"`
	ElectricityRate float64         `json:"electricityRatePerKwh,omitempty"`
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
func (s *RawStorage) Append(now time.Time, bitaxeAddr string, payload []byte) error {
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
	}

	data, err := json.Marshal(sample)
	if err != nil {
		return err
	}

	// Daily JSONL file named by UTC date for timezone-portable exports
	filename := now.UTC().Format("2006-01-02") + ".jsonl"
	path := filepath.Join(dir, filename)

	f, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	defer func() {
		if err := f.Close(); err != nil {
			log.Printf("warning: failed to close response body: %v", err)
		}
	}()

	// Append payload
	if _, err := f.Write(data); err != nil {
		return err
	}
	if _, err := f.Write([]byte("\n")); err != nil {
		return err
	}

	// Update latest.json (overwrite)
	latestPath := filepath.Join(dir, "latest.json")
	return os.WriteFile(latestPath, data, 0o644)
}
