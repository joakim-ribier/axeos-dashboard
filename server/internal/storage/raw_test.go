package storage

import (
	"bufio"
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/model"
)

func TestRawStorage_Append(t *testing.T) {
	dir := t.TempDir()
	s := NewRawStorage(dir, 0.15)

	now := time.Date(2026, 7, 14, 10, 30, 45, 123456789, time.UTC)
	payload := []byte(`{"hashRate":123.4}`)

	if err := s.Append(now, "10.0.0.1", payload, nil); err != nil {
		t.Fatalf("Append() unexpected error: %v", err)
	}

	minerDir := filepath.Join(dir, "10.0.0.1")

	jsonlPath := filepath.Join(minerDir, "2026-07-14.jsonl")
	line := readSingleLine(t, jsonlPath)
	var sample RawSample
	if err := json.Unmarshal([]byte(line), &sample); err != nil {
		t.Fatalf("failed to unmarshal jsonl line: %v", err)
	}

	wantTs := now.Truncate(time.Second)
	if !sample.Timestamp.Equal(wantTs) {
		t.Errorf("Timestamp = %v, want %v (truncated to the second)", sample.Timestamp, wantTs)
	}
	if sample.Bitaxe != "10.0.0.1" {
		t.Errorf("Bitaxe = %q, want %q", sample.Bitaxe, "10.0.0.1")
	}
	if sample.ElectricityRate != 0.15 {
		t.Errorf("ElectricityRate = %v, want %v", sample.ElectricityRate, 0.15)
	}
	if string(sample.Payload) != string(payload) {
		t.Errorf("Payload = %s, want %s", sample.Payload, payload)
	}

	latestPath := filepath.Join(minerDir, "latest.json")
	latestData, err := os.ReadFile(latestPath)
	if err != nil {
		t.Fatalf("failed to read latest.json: %v", err)
	}
	if string(latestData) != line {
		t.Errorf("latest.json content = %s, want it to match the last jsonl line %s", latestData, line)
	}
}

func TestRawStorage_Append_appendsAcrossCalls(t *testing.T) {
	dir := t.TempDir()
	s := NewRawStorage(dir, 0)
	now := time.Date(2026, 7, 14, 10, 0, 0, 0, time.UTC)

	if err := s.Append(now, "10.0.0.1", []byte(`{"n":1}`), nil); err != nil {
		t.Fatalf("Append() #1 unexpected error: %v", err)
	}
	if err := s.Append(now.Add(time.Minute), "10.0.0.1", []byte(`{"n":2}`), nil); err != nil {
		t.Fatalf("Append() #2 unexpected error: %v", err)
	}

	jsonlPath := filepath.Join(dir, "10.0.0.1", "2026-07-14.jsonl")
	f, err := os.Open(jsonlPath)
	if err != nil {
		t.Fatalf("failed to open jsonl file: %v", err)
	}
	defer func() { _ = f.Close() }()

	lineCount := 0
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		if scanner.Text() != "" {
			lineCount++
		}
	}
	if lineCount != 2 {
		t.Errorf("jsonl file has %d lines, want 2 (one per Append call)", lineCount)
	}

	latestData, err := os.ReadFile(filepath.Join(dir, "10.0.0.1", "latest.json"))
	if err != nil {
		t.Fatalf("failed to read latest.json: %v", err)
	}
	var latest RawSample
	if err := json.Unmarshal(latestData, &latest); err != nil {
		t.Fatalf("failed to unmarshal latest.json: %v", err)
	}
	if string(latest.Payload) != `{"n":2}` {
		t.Errorf("latest.json payload = %s, want the most recent payload %s", latest.Payload, `{"n":2}`)
	}
}

func TestRawStorage_Append_invalidJSON(t *testing.T) {
	dir := t.TempDir()
	s := NewRawStorage(dir, 0)

	err := s.Append(time.Now(), "10.0.0.1", []byte(`not json`), nil)
	if err == nil {
		t.Fatal("Append() error = nil, want error for invalid JSON payload")
	}

	if _, err := os.Stat(filepath.Join(dir, "10.0.0.1")); !os.IsNotExist(err) {
		t.Error("Append() should not create the miner directory when the payload is invalid")
	}
}

func TestRawStorage_Append_storesAlerts(t *testing.T) {
	dir := t.TempDir()
	s := NewRawStorage(dir, 0)
	now := time.Date(2026, 7, 14, 10, 0, 0, 0, time.UTC)
	alerts := []model.Alert{{Type: model.AlertTempHigh, Value: 70, Threshold: 62}}

	if err := s.Append(now, "aabbccddee01", []byte(`{"temp":70}`), alerts); err != nil {
		t.Fatalf("Append() unexpected error: %v", err)
	}

	latestData, err := os.ReadFile(filepath.Join(dir, "aabbccddee01", "latest.json"))
	if err != nil {
		t.Fatalf("failed to read latest.json: %v", err)
	}
	var latest RawSample
	if err := json.Unmarshal(latestData, &latest); err != nil {
		t.Fatalf("failed to unmarshal latest.json: %v", err)
	}
	if len(latest.Alerts) != 1 || latest.Alerts[0].Type != model.AlertTempHigh {
		t.Errorf("Alerts = %+v, want one tempHigh alert", latest.Alerts)
	}
}

func TestRawStorage_AppendAlertOnly_writesJSONLButNotLatest(t *testing.T) {
	dir := t.TempDir()
	s := NewRawStorage(dir, 0)
	now := time.Date(2026, 7, 14, 10, 0, 0, 0, time.UTC)
	alerts := []model.Alert{{Type: model.AlertOffline, Message: "connection refused"}}

	if err := s.AppendAlertOnly(now, "aabbccddee01", alerts); err != nil {
		t.Fatalf("AppendAlertOnly() unexpected error: %v", err)
	}

	minerDir := filepath.Join(dir, "aabbccddee01")

	line := readSingleLine(t, filepath.Join(minerDir, "2026-07-14.jsonl"))
	var sample RawSample
	if err := json.Unmarshal([]byte(line), &sample); err != nil {
		t.Fatalf("failed to unmarshal jsonl line: %v", err)
	}
	if len(sample.Alerts) != 1 || sample.Alerts[0].Type != model.AlertOffline {
		t.Errorf("Alerts = %+v, want one offline alert", sample.Alerts)
	}
	if len(sample.Payload) != 0 {
		t.Errorf("Payload = %s, want empty (no successful poll to store)", sample.Payload)
	}

	if _, err := os.Stat(filepath.Join(minerDir, "latest.json")); !os.IsNotExist(err) {
		t.Errorf("latest.json should not be created by AppendAlertOnly, stat err = %v", err)
	}
}

func TestRawStorage_AppendAlertOnly_doesNotOverwriteExistingLatest(t *testing.T) {
	dir := t.TempDir()
	s := NewRawStorage(dir, 0)
	now := time.Date(2026, 7, 14, 10, 0, 0, 0, time.UTC)

	if err := s.Append(now, "aabbccddee01", []byte(`{"temp":55}`), nil); err != nil {
		t.Fatal(err)
	}
	before, err := os.ReadFile(filepath.Join(dir, "aabbccddee01", "latest.json"))
	if err != nil {
		t.Fatal(err)
	}

	offline := []model.Alert{{Type: model.AlertOffline}}
	if err := s.AppendAlertOnly(now.Add(2*time.Minute), "aabbccddee01", offline); err != nil {
		t.Fatal(err)
	}

	after, err := os.ReadFile(filepath.Join(dir, "aabbccddee01", "latest.json"))
	if err != nil {
		t.Fatal(err)
	}
	if string(before) != string(after) {
		t.Errorf("latest.json changed after AppendAlertOnly: before=%s after=%s", before, after)
	}
}

func readSingleLine(t *testing.T, path string) string {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("failed to read %s: %v", path, err)
	}
	scanner := bufio.NewScanner(bytes.NewReader(data))
	if !scanner.Scan() {
		t.Fatalf("%s has no lines", path)
	}
	return scanner.Text()
}
