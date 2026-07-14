// cmd/remote-dashboard-api/main.go
package main

import (
	"flag"
	"fmt"
	"io"
	"log"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/handler"
)

func main() {
	var configPath string
	flag.StringVar(&configPath, "config", "", "Config path")
	flag.Parse()

	cfg, err := config.NewLoaderConfig(configPath).LoadConfig()
	if err != nil {
		log.Fatalf("remote-dashboard-api: config: %v", err)
	}

	var logFile string
	if cfg.Global.Env != "dev" {
		logFile = filepath.Join(cfg.Storage.DataDir, "remote-dashboard.log")
	}
	logger := newLogger("remote-dashboard", logFile)

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))

	r.Route("/api/{boardId}", func(r chi.Router) {
		r.Get("/miners", handler.ListRemoteMiners(cfg))
		r.Get("/{ip}/stats", handler.RemoteStats(cfg))
	})

	port := cfg.Server.Port
	if port == "" {
		port = "8081"
	}
	addr := fmt.Sprintf(":%s", port)
	logger.Info(fmt.Sprintf("remote-dashboard-api listening on %s", addr), "boardsDir", cfg.Storage.ResolveBoardsDir())
	if err := http.ListenAndServe(addr, r); err != nil {
		logger.Error("server failed", "error", err)
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
