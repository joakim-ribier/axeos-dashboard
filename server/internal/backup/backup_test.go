package backup

import (
	"archive/zip"
	"bytes"
	"crypto/md5"
	"encoding/hex"
	"io"
	"maps"
	"os"
	"path/filepath"
	"slices"
	"testing"
	"time"
)

var testNow = time.Date(2026, 10, 6, 10, 0, 0, 0, time.UTC)

func writeFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("mkdir %s: %v", path, err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
}

func zipContents(t *testing.T, r *zip.Reader) map[string]string {
	t.Helper()
	contents := map[string]string{}
	for _, f := range r.File {
		rc, err := f.Open()
		if err != nil {
			t.Fatalf("open entry %s: %v", f.Name, err)
		}
		data, err := io.ReadAll(rc)
		_ = rc.Close()
		if err != nil {
			t.Fatalf("read entry %s: %v", f.Name, err)
		}
		contents[f.Name] = string(data)
	}
	return contents
}

func archiveContents(t *testing.T, path string) map[string]string {
	t.Helper()
	r, err := zip.OpenReader(path)
	if err != nil {
		t.Fatalf("open archive %s: %v", path, err)
	}
	defer func() { _ = r.Close() }()
	return zipContents(t, &r.Reader)
}

func names(contents map[string]string) []string {
	return slices.Sorted(maps.Keys(contents))
}

func TestValidMonth(t *testing.T) {
	tests := []struct {
		month string
		want  bool
	}{
		{"2026-09", true},
		{"2026-12", true},
		{"2026-13", false},
		{"2026-00", false},
		{"2026-9", false},
		{"", false},
		{"../../etc", false},
		{"2026-09.zip", false},
	}
	for _, tt := range tests {
		if got := ValidMonth(tt.month); got != tt.want {
			t.Errorf("ValidMonth(%q) = %v, want %v", tt.month, got, tt.want)
		}
	}
}

func TestArchiveCompletedDays_groupsCompletedDaysByMonth(t *testing.T) {
	dir := t.TempDir()
	bitaxes, backups := filepath.Join(dir, "bitaxes"), filepath.Join(dir, "backups")
	writeFile(t, filepath.Join(bitaxes, "aa", "2026-09-12.jsonl"), "sep-aa\n")
	writeFile(t, filepath.Join(bitaxes, "bb", "2026-09-30.jsonl"), "sep-bb\n")
	writeFile(t, filepath.Join(bitaxes, "aa", "2026-10-05.jsonl"), "oct-5\n")
	writeFile(t, filepath.Join(bitaxes, "aa", "2026-10-06.jsonl"), "today\n")
	writeFile(t, filepath.Join(bitaxes, "aa", "latest.json"), "{}")
	writeFile(t, filepath.Join(bitaxes, "aa", "totals.json"), "{}")
	writeFile(t, filepath.Join(bitaxes, "aa", "notes.jsonl"), "not a day\n")
	writeFile(t, filepath.Join(bitaxes, "firmware_cache.json"), "{}")

	updated, err := ArchiveCompletedDays(bitaxes, backups, testNow)
	if err != nil {
		t.Fatalf("ArchiveCompletedDays() error: %v", err)
	}
	if want := []string{"2026-09", "2026-10"}; !slices.Equal(updated, want) {
		t.Errorf("updated = %v, want %v", updated, want)
	}

	sep := archiveContents(t, Path(backups, "2026-09"))
	if want := []string{"data/bitaxes/aa/2026-09-12.jsonl", "data/bitaxes/bb/2026-09-30.jsonl"}; !slices.Equal(names(sep), want) {
		t.Errorf("2026-09 entries = %v, want %v", names(sep), want)
	}
	if sep["data/bitaxes/aa/2026-09-12.jsonl"] != "sep-aa\n" {
		t.Errorf("2026-09-12 content = %q, want %q", sep["data/bitaxes/aa/2026-09-12.jsonl"], "sep-aa\n")
	}

	// Today is still being written to, so the current month's archive stops
	// at yesterday.
	oct := archiveContents(t, Path(backups, "2026-10"))
	if want := []string{"data/bitaxes/aa/2026-10-05.jsonl"}; !slices.Equal(names(oct), want) {
		t.Errorf("2026-10 entries = %v, want %v", names(oct), want)
	}
}

func TestArchiveCompletedDays_idempotent(t *testing.T) {
	dir := t.TempDir()
	bitaxes, backups := filepath.Join(dir, "bitaxes"), filepath.Join(dir, "backups")
	writeFile(t, filepath.Join(bitaxes, "aa", "2026-09-12.jsonl"), "sep\n")

	if _, err := ArchiveCompletedDays(bitaxes, backups, testNow); err != nil {
		t.Fatalf("first ArchiveCompletedDays() error: %v", err)
	}
	before, err := os.Stat(Path(backups, "2026-09"))
	if err != nil {
		t.Fatalf("stat archive: %v", err)
	}

	updated, err := ArchiveCompletedDays(bitaxes, backups, testNow)
	if err != nil {
		t.Fatalf("second ArchiveCompletedDays() error: %v", err)
	}
	if len(updated) != 0 {
		t.Errorf("updated = %v, want none", updated)
	}
	after, err := os.Stat(Path(backups, "2026-09"))
	if err != nil {
		t.Fatalf("stat archive: %v", err)
	}
	if !after.ModTime().Equal(before.ModTime()) {
		t.Error("archive was rewritten although nothing was missing")
	}
}

func TestArchiveCompletedDays_addsNewDaysAndKeepsExistingEntries(t *testing.T) {
	dir := t.TempDir()
	bitaxes, backups := filepath.Join(dir, "bitaxes"), filepath.Join(dir, "backups")
	writeFile(t, filepath.Join(bitaxes, "aa", "2026-10-05.jsonl"), "oct-5\n")
	writeFile(t, filepath.Join(bitaxes, "aa", "2026-10-06.jsonl"), "oct-6\n")

	if _, err := ArchiveCompletedDays(bitaxes, backups, testNow); err != nil {
		t.Fatalf("ArchiveCompletedDays() on the 6th error: %v", err)
	}
	// The archive is the only copy of a day once its JSONL is gone -- the
	// next nightly update must carry it over, not rebuild from disk.
	if err := os.Remove(filepath.Join(bitaxes, "aa", "2026-10-05.jsonl")); err != nil {
		t.Fatalf("remove: %v", err)
	}

	updated, err := ArchiveCompletedDays(bitaxes, backups, testNow.Add(24*time.Hour))
	if err != nil {
		t.Fatalf("ArchiveCompletedDays() on the 7th error: %v", err)
	}
	if want := []string{"2026-10"}; !slices.Equal(updated, want) {
		t.Errorf("updated = %v, want %v", updated, want)
	}

	oct := archiveContents(t, Path(backups, "2026-10"))
	want := map[string]string{
		"data/bitaxes/aa/2026-10-05.jsonl": "oct-5\n",
		"data/bitaxes/aa/2026-10-06.jsonl": "oct-6\n",
	}
	if len(oct) != len(want) {
		t.Fatalf("2026-10 entries = %v, want %v", names(oct), names(want))
	}
	for name, content := range want {
		if oct[name] != content {
			t.Errorf("%s = %q, want %q", name, oct[name], content)
		}
	}
	if _, err := os.Stat(Path(backups, "2026-10") + ".tmp"); !os.IsNotExist(err) {
		t.Errorf("temporary file left behind (stat err = %v)", err)
	}
}

func md5Of(t *testing.T, path string) string {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	sum := md5.Sum(data)
	return hex.EncodeToString(sum[:])
}

func readChecksumsFile(t *testing.T, backups string) string {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(backups, checksumsFile))
	if err != nil {
		t.Fatalf("read checksums: %v", err)
	}
	return string(data)
}

func TestArchiveCompletedDays_recordsChecksumOfPastMonthsOnly(t *testing.T) {
	dir := t.TempDir()
	bitaxes, backups := filepath.Join(dir, "bitaxes"), filepath.Join(dir, "backups")
	writeFile(t, filepath.Join(bitaxes, "aa", "2026-08-03.jsonl"), "aug\n")
	writeFile(t, filepath.Join(bitaxes, "aa", "2026-09-12.jsonl"), "sep\n")
	writeFile(t, filepath.Join(bitaxes, "aa", "2026-10-05.jsonl"), "oct\n")

	if _, err := ArchiveCompletedDays(bitaxes, backups, testNow); err != nil {
		t.Fatalf("ArchiveCompletedDays() error: %v", err)
	}

	want := md5Of(t, Path(backups, "2026-08")) + "  2026-08.zip\n" +
		md5Of(t, Path(backups, "2026-09")) + "  2026-09.zip\n"
	if got := readChecksumsFile(t, backups); got != want {
		t.Errorf("checksums file = %q, want %q", got, want)
	}
}

func TestArchiveCompletedDays_finalMonthIsNeverRewritten(t *testing.T) {
	dir := t.TempDir()
	bitaxes, backups := filepath.Join(dir, "bitaxes"), filepath.Join(dir, "backups")
	writeFile(t, filepath.Join(bitaxes, "aa", "2026-09-12.jsonl"), "sep\n")
	if _, err := ArchiveCompletedDays(bitaxes, backups, testNow); err != nil {
		t.Fatalf("first ArchiveCompletedDays() error: %v", err)
	}
	before := md5Of(t, Path(backups, "2026-09"))

	writeFile(t, filepath.Join(bitaxes, "aa", "2026-09-13.jsonl"), "late\n")
	updated, err := ArchiveCompletedDays(bitaxes, backups, testNow)
	if err != nil {
		t.Fatalf("second ArchiveCompletedDays() error: %v", err)
	}

	if len(updated) != 0 {
		t.Errorf("updated = %v, want none", updated)
	}
	if after := md5Of(t, Path(backups, "2026-09")); after != before {
		t.Error("final archive was rewritten")
	}
}

func TestArchiveCompletedDays_currentMonthBecomesFinalOnceOver(t *testing.T) {
	dir := t.TempDir()
	bitaxes, backups := filepath.Join(dir, "bitaxes"), filepath.Join(dir, "backups")
	writeFile(t, filepath.Join(bitaxes, "aa", "2026-10-05.jsonl"), "oct-5\n")
	writeFile(t, filepath.Join(bitaxes, "aa", "2026-10-31.jsonl"), "oct-31\n")

	if _, err := ArchiveCompletedDays(bitaxes, backups, testNow); err != nil {
		t.Fatalf("ArchiveCompletedDays() in October error: %v", err)
	}
	if _, err := os.Stat(filepath.Join(backups, checksumsFile)); !os.IsNotExist(err) {
		t.Fatalf("checksums file exists for an in-progress month (stat err = %v)", err)
	}

	firstOfNovember := time.Date(2026, 11, 1, 0, 30, 0, 0, time.UTC)
	updated, err := ArchiveCompletedDays(bitaxes, backups, firstOfNovember)
	if err != nil {
		t.Fatalf("ArchiveCompletedDays() on November 1st error: %v", err)
	}

	if want := []string{"2026-10"}; !slices.Equal(updated, want) {
		t.Errorf("updated = %v, want %v", updated, want)
	}
	oct := archiveContents(t, Path(backups, "2026-10"))
	if want := []string{"data/bitaxes/aa/2026-10-05.jsonl", "data/bitaxes/aa/2026-10-31.jsonl"}; !slices.Equal(names(oct), want) {
		t.Errorf("2026-10 entries = %v, want %v", names(oct), want)
	}
	if want := md5Of(t, Path(backups, "2026-10")) + "  2026-10.zip\n"; readChecksumsFile(t, backups) != want {
		t.Errorf("checksums file = %q, want %q", readChecksumsFile(t, backups), want)
	}
}

func TestArchiveCompletedDays_completeArchiveWithoutChecksumIsNotRewritten(t *testing.T) {
	dir := t.TempDir()
	bitaxes, backups := filepath.Join(dir, "bitaxes"), filepath.Join(dir, "backups")
	writeFile(t, filepath.Join(bitaxes, "aa", "2026-09-12.jsonl"), "sep\n")
	if _, err := ArchiveCompletedDays(bitaxes, backups, testNow); err != nil {
		t.Fatalf("first ArchiveCompletedDays() error: %v", err)
	}
	// Archives made before checksums existed, or a crash between writing
	// the archive and its checksum.
	if err := os.Remove(filepath.Join(backups, checksumsFile)); err != nil {
		t.Fatalf("remove checksums: %v", err)
	}
	before, err := os.Stat(Path(backups, "2026-09"))
	if err != nil {
		t.Fatalf("stat archive: %v", err)
	}

	updated, err := ArchiveCompletedDays(bitaxes, backups, testNow)
	if err != nil {
		t.Fatalf("second ArchiveCompletedDays() error: %v", err)
	}

	if want := []string{"2026-09"}; !slices.Equal(updated, want) {
		t.Errorf("updated = %v, want %v", updated, want)
	}
	after, err := os.Stat(Path(backups, "2026-09"))
	if err != nil {
		t.Fatalf("stat archive: %v", err)
	}
	if !after.ModTime().Equal(before.ModTime()) {
		t.Error("complete archive was rewritten")
	}
	if want := md5Of(t, Path(backups, "2026-09")) + "  2026-09.zip\n"; readChecksumsFile(t, backups) != want {
		t.Errorf("checksums file = %q, want %q", readChecksumsFile(t, backups), want)
	}
}

func TestArchiveCompletedDays_noDataDir(t *testing.T) {
	dir := t.TempDir()

	updated, err := ArchiveCompletedDays(filepath.Join(dir, "missing"), filepath.Join(dir, "backups"), testNow)
	if err != nil {
		t.Fatalf("ArchiveCompletedDays() error: %v", err)
	}
	if len(updated) != 0 {
		t.Errorf("updated = %v, want none", updated)
	}
}

func TestList(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, filepath.Join(dir, "2026-08.zip"), "a")
	writeFile(t, filepath.Join(dir, "2026-10.zip"), "abc")
	writeFile(t, filepath.Join(dir, "2026-09.zip"), "ab")
	writeFile(t, filepath.Join(dir, "2026-11.zip.tmp"), "in progress")
	writeFile(t, filepath.Join(dir, "notes.zip"), "x")
	writeFile(t, filepath.Join(dir, checksumsFile), "aaaa  2026-09.zip\nbbbb  2026-08.zip\n")

	got, err := List(dir)
	if err != nil {
		t.Fatalf("List() error: %v", err)
	}
	var months []string
	for _, b := range got {
		months = append(months, b.Month)
	}
	if want := []string{"2026-10", "2026-09", "2026-08"}; !slices.Equal(months, want) {
		t.Errorf("months = %v, want %v", months, want)
	}
	if got[0].Size != 3 {
		t.Errorf("2026-10 size = %d, want 3", got[0].Size)
	}
	if got[0].UpdatedAt.IsZero() {
		t.Error("2026-10 UpdatedAt is zero")
	}
	var sums []string
	for _, b := range got {
		sums = append(sums, b.Checksum)
	}
	if want := []string{"", "aaaa", "bbbb"}; !slices.Equal(sums, want) {
		t.Errorf("checksums = %v, want %v", sums, want)
	}
}

func TestList_noBackupsDir(t *testing.T) {
	got, err := List(filepath.Join(t.TempDir(), "missing"))
	if err != nil {
		t.Fatalf("List() error: %v", err)
	}
	if got == nil || len(got) != 0 {
		t.Errorf("List() = %#v, want an empty, non-nil slice", got)
	}
}

func TestMerge(t *testing.T) {
	dir := t.TempDir()
	bitaxes, backups := filepath.Join(dir, "bitaxes"), filepath.Join(dir, "backups")
	writeFile(t, filepath.Join(bitaxes, "aa", "2026-08-03.jsonl"), "aug\n")
	writeFile(t, filepath.Join(bitaxes, "aa", "2026-09-12.jsonl"), "sep\n")
	writeFile(t, filepath.Join(bitaxes, "bb", "2026-09-12.jsonl"), "sep-bb\n")
	if _, err := ArchiveCompletedDays(bitaxes, backups, testNow); err != nil {
		t.Fatalf("ArchiveCompletedDays() error: %v", err)
	}

	var buf bytes.Buffer
	if err := Merge(&buf, backups, []string{"2026-08", "2026-09"}); err != nil {
		t.Fatalf("Merge() error: %v", err)
	}
	r, err := zip.NewReader(bytes.NewReader(buf.Bytes()), int64(buf.Len()))
	if err != nil {
		t.Fatalf("read merged zip: %v", err)
	}
	got := zipContents(t, r)
	want := map[string]string{
		"data/bitaxes/aa/2026-08-03.jsonl": "aug\n",
		"data/bitaxes/aa/2026-09-12.jsonl": "sep\n",
		"data/bitaxes/bb/2026-09-12.jsonl": "sep-bb\n",
	}
	if len(got) != len(want) {
		t.Fatalf("entries = %v, want %v", names(got), names(want))
	}
	for name, content := range want {
		if got[name] != content {
			t.Errorf("%s = %q, want %q", name, got[name], content)
		}
	}
}

func TestMerge_missingMonth(t *testing.T) {
	if err := Merge(io.Discard, t.TempDir(), []string{"2026-08"}); !os.IsNotExist(err) {
		t.Errorf("Merge() error = %v, want a not-exist error", err)
	}
}
