package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestSaveMiners_writesReadableYaml(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "miners.yml")

	miners := []Bitaxe{
		{Ip: "10.0.0.1", Mac: "aabbccddeeff", Hostname: "bitaxe-1", Model: "bitaxe", Enabled: true},
	}

	if err := SaveMiners(path, miners); err != nil {
		t.Fatalf("SaveMiners() error = %v", err)
	}

	got, err := loadMinersFile(path)
	if err != nil {
		t.Fatalf("re-reading saved file: %v", err)
	}
	if len(got) != 1 || got[0].Ip != "10.0.0.1" || got[0].Mac != "aabbccddeeff" {
		t.Errorf("round-tripped miners = %+v, want the saved entry back", got)
	}
}

func TestSaveMiners_createsParentDir(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "nested", "miners.yml")

	if err := SaveMiners(path, []Bitaxe{{Ip: "10.0.0.1", Mac: "aabbccddeeff"}}); err != nil {
		t.Fatalf("SaveMiners() error = %v", err)
	}
	if _, err := os.Stat(path); err != nil {
		t.Errorf("file not created at %s: %v", path, err)
	}
}

func TestSaveMiners_backsUpExistingFileBeforeOverwriting(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "miners.yml")

	if err := os.WriteFile(path, []byte("bitaxes:\n  - ip: 10.0.0.1\n"), 0o644); err != nil {
		t.Fatalf("seed file: %v", err)
	}

	if err := SaveMiners(path, []Bitaxe{{Ip: "10.0.0.2", Mac: "aabbccddeeff"}}); err != nil {
		t.Fatalf("SaveMiners() error = %v", err)
	}

	matches, err := filepath.Glob(path + ".bak-*")
	if err != nil {
		t.Fatalf("glob: %v", err)
	}
	if len(matches) != 1 {
		t.Fatalf("backup files = %d, want exactly 1", len(matches))
	}

	backup, err := os.ReadFile(matches[0])
	if err != nil {
		t.Fatalf("read backup: %v", err)
	}
	if string(backup) != "bitaxes:\n  - ip: 10.0.0.1\n" {
		t.Errorf("backup content = %q, want the pre-overwrite content", backup)
	}
}

func TestSaveMiners_noBackupOnFirstSave(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "miners.yml")

	if err := SaveMiners(path, []Bitaxe{{Ip: "10.0.0.1", Mac: "aabbccddeeff"}}); err != nil {
		t.Fatalf("SaveMiners() error = %v", err)
	}

	matches, err := filepath.Glob(path + ".bak-*")
	if err != nil {
		t.Fatalf("glob: %v", err)
	}
	if len(matches) != 0 {
		t.Errorf("backup files = %d, want 0 (nothing existed to back up)", len(matches))
	}
}

func TestSaveMiners_emptySliceWritesEmptyList(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "miners.yml")

	if err := SaveMiners(path, nil); err != nil {
		t.Fatalf("SaveMiners() error = %v", err)
	}

	got, err := loadMinersFile(path)
	if err != nil {
		t.Fatalf("re-reading saved file: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("miners = %+v, want empty", got)
	}
}

func TestSaveMiners_writesLastUpdatedHeaderComment(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "miners.yml")

	// RFC3339 formatting truncates to whole-second precision, so the parsed
	// header timestamp can legitimately land a fraction of a second before
	// "before" (captured with sub-second precision) even though it was
	// generated after it -- widen the window by a second on each side to
	// account for that truncation rather than the actual write latency.
	before := time.Now().UTC().Add(-time.Second)
	if err := SaveMiners(path, []Bitaxe{{Ip: "10.0.0.1", Mac: "aabbccddeeff"}}); err != nil {
		t.Fatalf("SaveMiners() error = %v", err)
	}
	after := time.Now().UTC().Add(time.Second)

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read miners file: %v", err)
	}
	lines := strings.SplitN(string(data), "\n", 2)
	if len(lines) != 2 || !strings.HasPrefix(lines[0], "# Last updated: ") {
		t.Fatalf("first line = %q, want a '# Last updated: ...' header", lines[0])
	}

	timestamp := strings.TrimPrefix(lines[0], "# Last updated: ")
	got, err := time.Parse(time.RFC3339, timestamp)
	if err != nil {
		t.Fatalf("header timestamp %q is not RFC3339: %v", timestamp, err)
	}
	if got.Before(before) || got.After(after) {
		t.Errorf("header timestamp = %v, want between %v and %v", got, before, after)
	}

	// The comment must not break parsing the rest of the file.
	miners, err := loadMinersFile(path)
	if err != nil {
		t.Fatalf("loadMinersFile() error = %v", err)
	}
	if len(miners) != 1 || miners[0].Ip != "10.0.0.1" {
		t.Errorf("miners = %+v, want the saved entry despite the header comment", miners)
	}
}

func TestSaveMiners_updatesHeaderCommentOnEverySave(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "miners.yml")

	if err := SaveMiners(path, []Bitaxe{{Ip: "10.0.0.1", Mac: "aabbccddeeff"}}); err != nil {
		t.Fatalf("first SaveMiners() error = %v", err)
	}
	first, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read miners file: %v", err)
	}

	time.Sleep(time.Second) // RFC3339 has second resolution
	if err := SaveMiners(path, []Bitaxe{{Ip: "10.0.0.2", Mac: "aabbccddeeff"}}); err != nil {
		t.Fatalf("second SaveMiners() error = %v", err)
	}
	second, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read miners file: %v", err)
	}

	firstHeader, _, _ := strings.Cut(string(first), "\n")
	secondHeader, _, _ := strings.Cut(string(second), "\n")
	if firstHeader == secondHeader {
		t.Errorf("header comment unchanged across saves (%q) -- want it to reflect the latest save", firstHeader)
	}
}

func TestSaveMiners_noTempFileLeftBehindOnSuccess(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "miners.yml")

	if err := SaveMiners(path, []Bitaxe{{Ip: "10.0.0.1", Mac: "aabbccddeeff"}}); err != nil {
		t.Fatalf("SaveMiners() error = %v", err)
	}
	if _, err := os.Stat(path + ".tmp"); !os.IsNotExist(err) {
		t.Errorf("temp file still present after a successful save (err = %v)", err)
	}
}
