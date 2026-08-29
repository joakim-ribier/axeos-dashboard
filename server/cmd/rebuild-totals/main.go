// ./cmd/rebuild-totals/main.go
//
// One-off tool: reconstructs each miner's totals.json (persistent,
// reboot-surviving uptime/shares counters -- see internal/storage.Totals)
// by replaying its entire JSONL history through the exact same delta/reset
// algorithm the live feeder uses (internal/storage.ApplyPoll). Needed
// because totals.json only started accumulating from whenever the feeder
// first shipped this feature -- this backfills everything recorded before
// that point.
//
// Only enabled miners present in config (-config, and its managed miners
// file -- see internal/config.LoadConfig) are processed -- deliberately,
// not everything found on disk: a stray/leftover directory under
// storage.dir (an old test, a typo, a decommissioned miner nobody meant to
// touch again) never gets silently picked up.
//
// Read-only on .jsonl/latest.json: the only file this tool ever writes is
// totals.json, and an existing one is backed up to totals.json.bak first.
package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/storage"
)

func main() {
	var configPath, minerFilter, deprecatedMinersPath string
	var dryRun bool
	flag.StringVar(&configPath, "config", "", "Config path (required)")
	flag.StringVar(&minerFilter, "miner", "", "Restrict to one miner (mac, hostname, or ip) -- default: all configured miners")
	flag.BoolVar(&dryRun, "dry-run", true, "If true (the default), only compute and print totals -- pass -dry-run=false to actually write totals.json")
	// Deprecated -- see the identical flag in cmd/dashboard-api/main.go.
	flag.StringVar(&deprecatedMinersPath, "miners", "", "Deprecated, ignored -- miners.yml is found automatically next to -config, or via minersFile: inside it")
	flag.Parse()

	if configPath == "" {
		log.Fatal("missing -config")
	}
	if deprecatedMinersPath != "" {
		log.Printf("warning: -miners is deprecated and ignored (%q) -- remove it, miners.yml is found automatically", deprecatedMinersPath)
	}

	cfg, err := config.NewLoaderConfig(configPath).LoadConfig()
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	root := cfg.Storage.BitaxesDir()
	miners := filterMiners(cfg.GetMiners(), minerFilter)
	if len(miners) == 0 {
		log.Fatal("no matching miner(s) found in config (check -miner, or enabled: true / mac: in your config)")
	}

	mode := "DRY RUN -- nothing will be written"
	if !dryRun {
		mode = "REAL RUN -- totals.json will be (re)written"
	}
	fmt.Printf("rebuild-totals: %s\n", mode)
	fmt.Printf("data dir: %s\n", root)
	fmt.Printf("miners: %d\n\n", len(miners))

	start := time.Now()
	results := make([]minerResult, 0, len(miners))
	for _, miner := range miners {
		res := rebuildMinerTotals(root, miner, dryRun)
		printResult(res)
		results = append(results, res)
	}

	printSummary(results, time.Since(start), dryRun)
}

// filterMiners narrows down to miners matching -miner (by mac, hostname, or
// ip), or returns every enabled miner unchanged if filter is empty.
func filterMiners(miners []config.Bitaxe, filter string) []config.Bitaxe {
	if filter == "" {
		return miners
	}

	normalized := config.NormalizeMac(filter)
	var out []config.Bitaxe
	for _, m := range miners {
		if m.Hostname == filter || m.Ip == filter || m.StorageKey() == normalized {
			out = append(out, m)
		}
	}
	return out
}

type minerResult struct {
	Hostname string
	Ip       string
	Mac      string

	Files        int
	LinesRead    int
	LinesSkipped int
	Resets       int

	FirstSeen time.Time
	LastSeen  time.Time

	Totals storage.Totals

	Elapsed time.Duration

	// Err is set when this miner couldn't be processed at all (no history,
	// backup/write failure, ...) -- not for individual skipped lines, which
	// are just logged and counted in LinesSkipped.
	Err error
}

func rebuildMinerTotals(root string, miner config.Bitaxe, dryRun bool) minerResult {
	start := time.Now()
	key := miner.StorageKey()
	res := minerResult{Hostname: miner.Hostname, Ip: miner.Ip, Mac: key}

	if key == "" {
		res.Err = fmt.Errorf("no mac configured")
		res.Elapsed = time.Since(start)
		return res
	}

	dir := filepath.Join(root, key)
	files, err := filepath.Glob(filepath.Join(dir, "*.jsonl"))
	if err != nil {
		res.Err = err
		res.Elapsed = time.Since(start)
		return res
	}
	// Filenames are "YYYY-MM-DD.jsonl" -- lexicographic sort is already
	// chronological.
	sort.Strings(files)

	if len(files) == 0 {
		res.Err = fmt.Errorf("no jsonl history found in %s", dir)
		res.Elapsed = time.Since(start)
		return res
	}
	res.Files = len(files)

	var t storage.Totals
	for _, f := range files {
		readJSONLIntoTotals(f, &t, &res)
	}
	res.Totals = t

	if !dryRun && res.LinesRead > 0 {
		path := storage.TotalsPath(root, key)
		if err := backupIfExists(path); err != nil {
			res.Err = fmt.Errorf("backup of existing totals.json failed, nothing written: %w", err)
			res.Elapsed = time.Since(start)
			return res
		}
		if err := storage.WriteTotals(path, t); err != nil {
			res.Err = fmt.Errorf("write failed: %w", err)
			res.Elapsed = time.Since(start)
			return res
		}
	}

	res.Elapsed = time.Since(start)
	return res
}

// readJSONLIntoTotals replays one day's JSONL file into t, in order,
// tolerating malformed lines (logged and skipped, never fatal -- same
// convention as internal/handler's JSONL readers) and skipping alert-only
// entries (offline/mac-mismatch polls, which carry no payload to fold in).
func readJSONLIntoTotals(path string, t *storage.Totals, res *minerResult) {
	f, err := os.Open(path)
	if err != nil {
		log.Printf("warning: cannot open %s: %v", path, err)
		return
	}
	defer func() {
		if err := f.Close(); err != nil {
			log.Printf("warning: failed to close %s: %v", path, err)
		}
	}()

	scanner := bufio.NewScanner(f)
	lineNum := 0
	for scanner.Scan() {
		lineNum++
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}

		var sample storage.RawSample
		if err := json.Unmarshal(line, &sample); err != nil {
			log.Printf("warning: skipping malformed line %d in %s: %v", lineNum, path, err)
			res.LinesSkipped++
			continue
		}

		if len(sample.Payload) == 0 {
			// Alert-only entry (offline/mac-mismatch poll) -- nothing to
			// fold in, not an error.
			res.LinesSkipped++
			continue
		}

		if res.FirstSeen.IsZero() || sample.Timestamp.Before(res.FirstSeen) {
			res.FirstSeen = sample.Timestamp
		}
		if sample.Timestamp.After(res.LastSeen) {
			res.LastSeen = sample.Timestamp
		}

		prevLastUptime := t.LastUptimeSeconds
		updated, err := storage.ApplyPoll(*t, sample.Timestamp, sample.Payload)
		if err != nil {
			log.Printf("warning: skipping unparsable payload at line %d in %s: %v", lineNum, path, err)
			res.LinesSkipped++
			continue
		}
		if updated.LastUptimeSeconds < prevLastUptime {
			res.Resets++
		}
		*t = updated
		res.LinesRead++
	}
	if err := scanner.Err(); err != nil {
		log.Printf("warning: error reading %s: %v", path, err)
	}
}

// backupIfExists copies an existing totals.json to totals.json.bak before
// it gets overwritten -- a no-op if there's nothing there yet (first-ever
// backfill run). Overwrites any previous .bak, so it always reflects the
// state right before the most recent write, not a full version history.
func backupIfExists(path string) error {
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	return os.WriteFile(path+".bak", data, 0o644)
}

func printResult(res minerResult) {
	label := res.Hostname
	if label == "" {
		label = res.Ip
	}

	if res.Err != nil {
		fmt.Printf("[%s / %s] SKIPPED -- %v\n\n", label, res.Mac, res.Err)
		return
	}

	fmt.Printf("[%s / %s]\n", label, res.Mac)
	fmt.Printf("  files: %d, lines: %d (skipped: %d), reboots detected: %d\n",
		res.Files, res.LinesRead, res.LinesSkipped, res.Resets)
	if !res.FirstSeen.IsZero() {
		fmt.Printf("  history: %s -> %s\n",
			res.FirstSeen.Format("2006-01-02 15:04"), res.LastSeen.Format("2006-01-02 15:04"))
	}
	fmt.Printf("  total uptime: %s, total shares: accepted=%d rejected=%d\n",
		formatDuration(res.Totals.TotalUptimeSeconds), res.Totals.TotalSharesAccepted, res.Totals.TotalSharesRejected)
	fmt.Printf("  scan time: %s\n\n", res.Elapsed.Round(time.Millisecond))
}

func printSummary(results []minerResult, elapsed time.Duration, dryRun bool) {
	var ok, failed, totalLines, totalSkipped, totalResets int
	for _, r := range results {
		if r.Err != nil {
			failed++
			continue
		}
		ok++
		totalLines += r.LinesRead
		totalSkipped += r.LinesSkipped
		totalResets += r.Resets
	}

	fmt.Println("==================== SUMMARY ====================")
	if dryRun {
		fmt.Println("mode: DRY RUN -- nothing was written")
	} else {
		fmt.Println("mode: REAL RUN -- totals.json written (previous version backed up to totals.json.bak where one existed)")
	}
	fmt.Printf("miners: %d processed, %d skipped\n", ok, failed)
	fmt.Printf("lines replayed: %d (skipped: %d), reboots detected: %d\n", totalLines, totalSkipped, totalResets)
	fmt.Printf("elapsed: %s\n", elapsed.Round(time.Millisecond))
	if dryRun {
		fmt.Println("(a real run over the same data should take about as long)")
	}
}

func formatDuration(seconds int64) string {
	d := time.Duration(seconds) * time.Second
	days := int64(d.Hours()) / 24
	hours := int64(d.Hours()) % 24
	mins := int64(d.Minutes()) % 60

	switch {
	case days > 0:
		return fmt.Sprintf("%dj %dh %dm", days, hours, mins)
	case hours > 0:
		return fmt.Sprintf("%dh %dm", hours, mins)
	default:
		return fmt.Sprintf("%dm", mins)
	}
}
