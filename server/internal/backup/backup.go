// internal/backup/backup.go
package backup

import (
	"archive/zip"
	"crypto/md5"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"maps"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
)

type Info struct {
	Month     string    `json:"month"`
	Size      int64     `json:"size"`
	UpdatedAt time.Time `json:"updatedAt"`
	// Checksum is the archive's MD5, set once the month is final.
	Checksum string `json:"checksum,omitempty"`
}

// checksumsFile lists the final archives' MD5, in md5sum's format so that
// `md5sum -c checksums.md5` checks them from the backups dir.
const checksumsFile = "checksums.md5"

var monthPattern = regexp.MustCompile(`^\d{4}-(0[1-9]|1[0-2])$`)

// ValidMonth reports whether month is a YYYY-MM value -- also what keeps a
// month taken from a URL from ever resolving outside the backups dir.
func ValidMonth(month string) bool {
	return monthPattern.MatchString(month)
}

func Path(backupsDir, month string) string {
	return filepath.Join(backupsDir, month+".zip")
}

// ArchiveCompletedDays adds every completed (UTC) day's JSONL files to their
// month's archive, so the current month's archive grows by one day each
// night. Checking every day rather than just yesterday is what catches up
// after the feeder was down. Returns the months whose backup changed.
//
// Once a past month's archive holds all its days, its checksum is recorded
// in checksumsFile: from then on the archive is final and never opened or
// rewritten again.
//
// Entries are laid out as under the data dir (config.BitaxesRelDir), so
// unzipping into storage.dataDir restores them.
func ArchiveCompletedDays(bitaxesDir, backupsDir string, now time.Time) ([]string, error) {
	today := now.UTC().Format("2006-01-02")
	currentMonth := today[:len("2006-01")]

	checksums, err := readChecksums(backupsDir)
	if err != nil {
		return nil, err
	}
	filesByMonth, err := completedDayFiles(bitaxesDir, today, checksums)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(backupsDir, 0o755); err != nil {
		return nil, err
	}

	var updated []string
	for _, month := range slices.Sorted(maps.Keys(filesByMonth)) {
		dest := Path(backupsDir, month)
		archived, err := entryNames(dest)
		if err != nil {
			return updated, fmt.Errorf("read archive %s: %w", month, err)
		}
		var missing []string
		for _, rel := range filesByMonth[month] {
			if !archived[entryName(rel)] {
				missing = append(missing, rel)
			}
		}
		changed := len(missing) > 0
		if changed {
			if err := writeArchive(dest, bitaxesDir, missing); err != nil {
				return updated, fmt.Errorf("archive %s: %w", month, err)
			}
		}
		if month < currentMonth {
			if checksums[month], err = md5File(dest); err != nil {
				return updated, fmt.Errorf("checksum %s: %w", month, err)
			}
			if err := writeChecksums(backupsDir, checksums); err != nil {
				return updated, err
			}
			changed = true
		}
		if changed {
			updated = append(updated, month)
		}
	}
	return updated, nil
}

// completedDayFiles returns, by month, the JSONL files (relative to
// bitaxesDir) of every day before today, skipping final months.
func completedDayFiles(bitaxesDir, today string, checksums map[string]string) (map[string][]string, error) {
	miners, err := os.ReadDir(bitaxesDir)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	filesByMonth := map[string][]string{}
	for _, miner := range miners {
		if !miner.IsDir() {
			continue
		}
		files, err := os.ReadDir(filepath.Join(bitaxesDir, miner.Name()))
		if err != nil {
			return nil, err
		}
		for _, file := range files {
			day, ok := strings.CutSuffix(file.Name(), ".jsonl")
			if !ok || day >= today {
				continue
			}
			if _, err := time.Parse("2006-01-02", day); err != nil {
				continue
			}
			month := day[:len("2006-01")]
			if _, final := checksums[month]; final {
				continue
			}
			filesByMonth[month] = append(filesByMonth[month], filepath.Join(miner.Name(), file.Name()))
		}
	}
	return filesByMonth, nil
}

func entryName(rel string) string {
	return path.Join(config.BitaxesRelDir, filepath.ToSlash(rel))
}

func entryNames(archive string) (map[string]bool, error) {
	names := map[string]bool{}
	r, err := zip.OpenReader(archive)
	if errors.Is(err, os.ErrNotExist) {
		return names, nil
	}
	if err != nil {
		return nil, err
	}
	defer func() { _ = r.Close() }()

	for _, f := range r.File {
		names[f.Name] = true
	}
	return names, nil
}

// writeArchive rebuilds dest with its existing entries copied still
// compressed (zip.Writer.Copy) plus newFiles, so a nightly update only
// compresses the new day. Written under a temporary name and renamed into
// place only once complete, so a crash mid-write never leaves a truncated
// archive behind.
func writeArchive(dest, bitaxesDir string, newFiles []string) (err error) {
	tmp := dest + ".tmp"
	f, err := os.Create(tmp)
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			_ = f.Close()
			_ = os.Remove(tmp)
		}
	}()

	zw := zip.NewWriter(f)
	if err := copyEntries(zw, dest); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	for _, rel := range newFiles {
		if err := addFile(zw, filepath.Join(bitaxesDir, rel), entryName(rel)); err != nil {
			return err
		}
	}

	if err := zw.Close(); err != nil {
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	return os.Rename(tmp, dest)
}

func addFile(zw *zip.Writer, src, name string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer func() { _ = in.Close() }()

	info, err := in.Stat()
	if err != nil {
		return err
	}
	header, err := zip.FileInfoHeader(info)
	if err != nil {
		return err
	}
	header.Name = name
	header.Method = zip.Deflate

	w, err := zw.CreateHeader(header)
	if err != nil {
		return err
	}
	_, err = io.Copy(w, in)
	return err
}

// List returns the archives in backupsDir, most recent month first.
func List(backupsDir string) ([]Info, error) {
	entries, err := os.ReadDir(backupsDir)
	if errors.Is(err, os.ErrNotExist) {
		return []Info{}, nil
	}
	if err != nil {
		return nil, err
	}
	checksums, err := readChecksums(backupsDir)
	if err != nil {
		return nil, err
	}

	backups := []Info{}
	for _, entry := range entries {
		month, ok := strings.CutSuffix(entry.Name(), ".zip")
		if !ok || !ValidMonth(month) {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			return nil, err
		}
		backups = append(backups, Info{
			Month:     month,
			Size:      info.Size(),
			UpdatedAt: info.ModTime().UTC(),
			Checksum:  checksums[month],
		})
	}
	slices.SortFunc(backups, func(a, b Info) int { return strings.Compare(b.Month, a.Month) })
	return backups, nil
}

// Merge writes a single zip holding every entry of the given months'
// archives, copied still compressed (zip.Writer.Copy) to spare the Pi's CPU.
// Months never share a daily file, so entry names can't collide.
func Merge(w io.Writer, backupsDir string, months []string) error {
	zw := zip.NewWriter(w)
	for _, month := range months {
		if err := copyEntries(zw, Path(backupsDir, month)); err != nil {
			return err
		}
	}
	return zw.Close()
}

func copyEntries(zw *zip.Writer, archive string) error {
	r, err := zip.OpenReader(archive)
	if err != nil {
		return err
	}
	defer func() { _ = r.Close() }()

	for _, f := range r.File {
		if err := zw.Copy(f); err != nil {
			return err
		}
	}
	return nil
}

func md5File(archive string) (string, error) {
	f, err := os.Open(archive)
	if err != nil {
		return "", err
	}
	defer func() { _ = f.Close() }()

	h := md5.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

func readChecksums(backupsDir string) (map[string]string, error) {
	checksums := map[string]string{}
	data, err := os.ReadFile(filepath.Join(backupsDir, checksumsFile))
	if errors.Is(err, os.ErrNotExist) {
		return checksums, nil
	}
	if err != nil {
		return nil, err
	}
	for _, line := range strings.Split(string(data), "\n") {
		fields := strings.Fields(line)
		if len(fields) != 2 {
			continue
		}
		if month, ok := strings.CutSuffix(fields[1], ".zip"); ok && ValidMonth(month) {
			checksums[month] = fields[0]
		}
	}
	return checksums, nil
}

// writeChecksums replaces checksumsFile through a temporary file, so a crash
// mid-write never loses the checksums already recorded.
func writeChecksums(backupsDir string, checksums map[string]string) error {
	var b strings.Builder
	for _, month := range slices.Sorted(maps.Keys(checksums)) {
		fmt.Fprintf(&b, "%s  %s.zip\n", checksums[month], month)
	}
	dest := filepath.Join(backupsDir, checksumsFile)
	if err := os.WriteFile(dest+".tmp", []byte(b.String()), 0o644); err != nil {
		return err
	}
	return os.Rename(dest+".tmp", dest)
}
