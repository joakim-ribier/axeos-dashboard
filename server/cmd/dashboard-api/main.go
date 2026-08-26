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
	var configPath, deprecatedMinersPath string
	flag.StringVar(&configPath, "config", "", "Config path")
	// Deprecated -- accepted (not rejected outright) so a not-yet-updated
	// Makefile/systemd unit/script that still passes it doesn't crash this
	// binary outright during the switch to the new behavior. Its value is
	// never read: the managed miners file is always found automatically
	// next to -config, or via minersFile: inside it (see
	// config.LoadConfig). Safe to stop passing -miners once every
	// caller/script has been updated.
	flag.StringVar(&deprecatedMinersPath, "miners", "", "Deprecated, ignored -- miners.yml is found automatically next to -config, or via minersFile: inside it")
	flag.Parse()

	cfg, err := config.NewLoaderConfig(configPath).LoadConfig()
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
	if deprecatedMinersPath != "" {
		logger.Warn("-miners is deprecated and ignored -- remove it, miners.yml is found automatically", "path", deprecatedMinersPath)
	}
	for _, w := range cfg.MissingMacWarnings() {
		logger.Error(w)
	}

	var wg sync.WaitGroup

	// Shared by the watcher and the router (same process) -- a miner saved
	// via POST /api/config/miners is picked up by both immediately (Set),
	// and either one also notices a change made some other way (another
	// process, hand-editing miners.yml) via its mtime (Reload). The pool
	// scheduler deliberately doesn't get one: poolSchedule stays a
	// hand-edited, advanced setting, fixed at startup (see
	// MINERS_DISCOVERY_PLAN.md).
	minersStore := config.NewMinersStore(cfg.MinersFilePath, cfg.Bitaxes)

	watcher := healtcheck.NewWatcher(logger, cfg).WithMinersStore(minersStore)
	watcher.Start(&wg)

	versionChecker := appversion.NewChecker(logger, appversion.DefaultReleaseAPIURL, version.GitSHA)

	NewRouter(logger, cfg, watcher, versionChecker).WithMinersStore(minersStore).Listen()

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
