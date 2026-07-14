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
	var configPath, minersPath string
	flag.StringVar(&configPath, "config", "", "Config path")
	flag.StringVar(&minersPath, "miners", "", "Miners config path (optional, overrides bitaxes from main config)")
	flag.Parse()

	loader := config.NewLoaderConfig(configPath)
	if minersPath != "" {
		loader = loader.WithMiners(minersPath)
	}
	cfg, err := loader.LoadConfig()
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

	NewFeeder(logger, cfg).Feed()
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
