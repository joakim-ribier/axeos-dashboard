// cmd/dashboard-api/main.go
package main

import (
	"flag"
	"io"
	"log"
	"log/slog"
	"os"
	"os/signal"
	"path/filepath"
	"sync"
	"syscall"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/appversion"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/healtcheck"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/poolscheduler"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/version"
)

// @title axeos-dashboard API
// @version 1.0
// @description Local, read/write REST API for AxeOs-compatible miners (Bitaxe, NerdAxe) on your LAN.
// @description No authentication — internal LAN use only.
// @description
// @description Endpoints tagged "dashboard-api" run on this binary (default :8080).
// @description Endpoints tagged "remote-dashboard-api" run on the separate remote-dashboard-api binary (default :8081),
// @description a read-only API serving miners pushed to hashboard.live — see the project README.
// @host localhost:8080
// @BasePath /
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
		log.Fatalf("Server stopped, config not found: %v", err)
		return
	}

	var logFile string
	if cfg.Global.Env != "dev" {
		logFile = filepath.Join(cfg.Storage.DataDir, "dashboard-api.log")
	}

	logger := newLogger("dashboard-api", logFile)
	logger.Info("Server running...")
	for _, w := range cfg.MissingMacWarnings() {
		logger.Error(w)
	}

	var wg sync.WaitGroup

	watcher := healtcheck.NewWatcher(logger, cfg)
	watcher.Start(&wg)

	versionChecker := appversion.NewChecker(logger, appversion.DefaultReleaseAPIURL, version.GitSHA)

	NewRouter(logger, cfg, watcher, versionChecker).Listen()

	scheduler := poolscheduler.NewPoolScheduler(logger, cfg)
	scheduler.Start()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("Shutting down server...")

	scheduler.Stop()
	watcher.Stop()

	wg.Wait()

	logger.Info("Server stopped!")
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
