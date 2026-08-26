// ./cmd/feeder/main.go
package main

import (
	"flag"
	"io"
	"log"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
)

func main() {
	var configPath, deprecatedMinersPath string
	flag.StringVar(&configPath, "config", "", "Config path")
	// Deprecated -- see the identical flag in cmd/dashboard-api/main.go.
	flag.StringVar(&deprecatedMinersPath, "miners", "", "Deprecated, ignored -- miners.yml is found automatically next to -config, or via minersFile: inside it")
	flag.Parse()

	cfg, err := config.NewLoaderConfig(configPath).LoadConfig()
	if err != nil {
		log.Println("Feeder stopped, config not found.")
		return
	}

	var logFile string
	if cfg.Global.Env != "dev" {
		logFile = filepath.Join(cfg.Storage.DataDir, "feeder.log")
	}

	logger := newLogger("feeder", logFile)
	logger.Info("Feeder running...")
	if deprecatedMinersPath != "" {
		logger.Warn("-miners is deprecated and ignored -- remove it, miners.yml is found automatically", "path", deprecatedMinersPath)
	}
	for _, w := range cfg.MissingMacWarnings() {
		logger.Error(w)
	}

	// The feeder is a separate OS process from dashboard-api, so it can
	// only ever notice a save made through the Settings UI via the file's
	// mtime (no Set() call to short-circuit it the way dashboard-api's own
	// Router/Watcher get) -- see config.MinersStore.Reload, called at the
	// top of every runOnce().
	minersStore := config.NewMinersStore(cfg.MinersFilePath, cfg.Bitaxes)
	NewFeeder(logger, cfg).WithMinersStore(minersStore).Feed()
}

func newLogger(appName, logFile string) *slog.Logger {
	opts := &slog.HandlerOptions{
		ReplaceAttr: func(_ []string, a slog.Attr) slog.Attr {
			if a.Key == slog.TimeKey {
				a.Value = slog.StringValue(a.Value.Time().Format(time.RFC3339))
			}
			return a
		},
	}
	var w io.Writer = os.Stdout
	var h slog.Handler
	if logFile != "" {
		f, err := os.OpenFile(logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
		if err != nil {
			log.Fatalf("cannot open log file: %v", err)
		}
		w = f
		h = slog.NewJSONHandler(w, opts)
	} else {
		h = slog.NewTextHandler(w, opts)
	}
	return slog.New(h).With("app", appName)
}
