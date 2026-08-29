package config

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestMinersStore_emptyPathNeverTouchesDisk(t *testing.T) {
	initial := []Bitaxe{{Ip: "10.0.0.1", Mac: "aabbccddeeff"}}
	store := NewMinersStore("", initial)

	got, err := store.Reload()
	if err != nil {
		t.Fatalf("Reload() error = %v", err)
	}
	if len(got) != 1 || got[0].Ip != "10.0.0.1" {
		t.Errorf("Reload() = %+v, want the initial list unchanged", got)
	}
}

func TestMinersStore_reloadsWhenFileChanges(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "miners.yml")
	writeFile(t, path, `
bitaxes:
  - ip: 10.0.0.1
    mac: aabbccddeeff
`)

	store := NewMinersStore(path, nil)

	got, err := store.Reload()
	if err != nil {
		t.Fatalf("Reload() error = %v", err)
	}
	if len(got) != 1 || got[0].Ip != "10.0.0.1" {
		t.Fatalf("first Reload() = %+v, want the seed content", got)
	}

	// Ensure a strictly later mtime -- some filesystems have coarse mtime
	// resolution, and this test must not flake on those.
	future := time.Now().Add(time.Second)
	writeFile(t, path, `
bitaxes:
  - ip: 10.0.0.2
    mac: 112233445566
`)
	if err := os.Chtimes(path, future, future); err != nil {
		t.Fatalf("chtimes: %v", err)
	}

	got, err = store.Reload()
	if err != nil {
		t.Fatalf("second Reload() error = %v", err)
	}
	if len(got) != 1 || got[0].Ip != "10.0.0.2" {
		t.Errorf("second Reload() = %+v, want the updated content", got)
	}
}

func TestMinersStore_unchangedMtimeSkipsReread(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "miners.yml")
	writeFile(t, path, `
bitaxes:
  - ip: 10.0.0.1
    mac: aabbccddeeff
`)
	original, err := os.Stat(path)
	if err != nil {
		t.Fatalf("stat: %v", err)
	}

	store := NewMinersStore(path, nil)
	first, err := store.Reload()
	if err != nil {
		t.Fatalf("Reload() error = %v", err)
	}

	// Different content, but mtime forced back to what it was on the first
	// read -- Reload() must trust mtime and skip re-reading rather than
	// always re-parsing the file, proving the "cheap when nothing changed"
	// guarantee actually holds.
	writeFile(t, path, `
bitaxes:
  - ip: 10.0.0.2
    mac: 112233445566
`)
	if err := os.Chtimes(path, original.ModTime(), original.ModTime()); err != nil {
		t.Fatalf("chtimes: %v", err)
	}

	second, err := store.Reload()
	if err != nil {
		t.Fatalf("second Reload() error = %v", err)
	}
	if len(second) != len(first) || second[0].Ip != first[0].Ip {
		t.Errorf("second Reload() = %+v, want unchanged from first = %+v (same mtime)", second, first)
	}
}

func TestMinersStore_missingFileYieldsEmptyNotError(t *testing.T) {
	dir := t.TempDir()
	store := NewMinersStore(filepath.Join(dir, "does-not-exist.yml"), []Bitaxe{{Ip: "10.0.0.1"}})

	got, err := store.Reload()
	if err != nil {
		t.Fatalf("Reload() error = %v", err)
	}
	if len(got) != 0 {
		t.Errorf("Reload() = %+v, want empty (file doesn't exist)", got)
	}
}

func TestMinersStore_invalidYamlKeepsLastKnownGood(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "miners.yml")
	writeFile(t, path, `
bitaxes:
  - ip: 10.0.0.1
    mac: aabbccddeeff
`)

	store := NewMinersStore(path, nil)
	good, err := store.Reload()
	if err != nil {
		t.Fatalf("Reload() error = %v", err)
	}

	future := time.Now().Add(time.Second)
	writeFile(t, path, `not: [valid: yaml`)
	if err := os.Chtimes(path, future, future); err != nil {
		t.Fatalf("chtimes: %v", err)
	}

	got, err := store.Reload()
	if err == nil {
		t.Fatal("Reload() error = nil, want an error for invalid yaml")
	}
	if len(got) != len(good) || got[0].Ip != good[0].Ip {
		t.Errorf("Reload() on invalid yaml = %+v, want the last-known-good %+v preserved", got, good)
	}
}

func TestMinersStore_setIsReflectedImmediately(t *testing.T) {
	// Set() mirrors real usage: the caller (SaveMinersConfig) writes path
	// itself via SaveMiners *before* calling Set() with the same data --
	// so by the time Set() runs, the file already exists on disk.
	dir := t.TempDir()
	path := filepath.Join(dir, "miners.yml")
	writeFile(t, path, "bitaxes:\n  - ip: 10.0.0.1\n    mac: aabbccddeeff\n")

	store := NewMinersStore(path, nil)
	store.Set([]Bitaxe{{Ip: "10.0.0.9", Mac: "aabbccddeeff"}})

	got, err := store.Reload()
	if err != nil {
		t.Fatalf("Reload() error = %v", err)
	}
	if len(got) != 1 || got[0].Ip != "10.0.0.9" {
		t.Errorf("Reload() after Set() = %+v, want the just-set value", got)
	}
}

func TestMinersStore_snapshotIsACopy(t *testing.T) {
	store := NewMinersStore("", []Bitaxe{{Ip: "10.0.0.1"}})

	got, err := store.Reload()
	if err != nil {
		t.Fatalf("Reload() error = %v", err)
	}
	got[0].Ip = "mutated"

	got2, err := store.Reload()
	if err != nil {
		t.Fatalf("Reload() error = %v", err)
	}
	if got2[0].Ip != "10.0.0.1" {
		t.Errorf("store state = %+v, want it unaffected by mutating a previous Reload() result", got2)
	}
}
