// ./cmd/mailer/main.go
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
	var configPath string
	flag.StringVar(&configPath, "config", "", "Config path")
	flag.Parse()

	cfg, err := config.NewLoaderConfig(configPath).LoadConfig()
	if err != nil {
		log.Println("Mailer stopped, config not found.")
		return
	}

	var logFile string
	if cfg.Global.Env != "dev" {
		logFile = filepath.Join(cfg.Storage.DataDir, "logs", "mailer.log")
	}

	logger := newLogger("mailer", logFile)
	logger.Info("Mailer running...")

	// A separate OS process from dashboard-api, like the feeder: a mail
	// setting saved from the Notifications page reaches it through
	// settings.yml's mtime -- see config.AppSettingsStore.Reload.
	appSettingsStore := config.NewAppSettingsStore(cfg.AppSettingsFilePath, cfg.AppSettingsSnapshot())
	minersStore := config.NewMinersStore(cfg.MinersFilePath, cfg.Bitaxes)
	err = NewMailer(logger, cfg).
		WithAppSettingsStore(appSettingsStore).
		WithMinersStore(minersStore).
		Run()
	if err != nil {
		logger.Error("Mailer stopped", "error", err)
		os.Exit(1)
	}
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
		if err := os.MkdirAll(filepath.Dir(logFile), 0o755); err != nil {
			log.Fatalf("cannot create log dir: %v", err)
		}
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
