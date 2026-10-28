// cmd/dashboard-api/router.go
package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/appversion"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/audit"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/handler"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/healtcheck"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/remotepush"
)

type contextKey string

const minerContextKey contextKey = "miner"

type Router struct {
	logger *slog.Logger

	// config is set once at startup and never mutated again -- Bitaxes no
	// longer lives here at request time, it's read fresh from minersStore
	// on every request (see snapshotConfig), which is what actually stays
	// in sync with miners.yml: a save through this same process (POST
	// /api/config/miners) as well as any other change to the file
	// (another process, hand-editing) noticed via its mtime.
	config           config.Config
	minersStore      *config.MinersStore
	appSettingsStore *config.AppSettingsStore
	watcher          *healtcheck.Watcher
	versionChecker   *appversion.Checker
	auditLog         *audit.Log
	remoteBoard      remotepush.BoardCache
	// startedAt is when this process started, for GET /api/status.
	startedAt time.Time

	// saveMu runs config saves one at a time: each diffs what it wrote
	// against what was there just before, which a concurrent save would
	// otherwise change in between.
	saveMu sync.Mutex
}

func NewRouter(logger *slog.Logger, config config.Config, watcher *healtcheck.Watcher, versionChecker *appversion.Checker) *Router {
	return &Router{
		logger:         logger.With("namespace", "Router"),
		config:         config,
		watcher:        watcher,
		versionChecker: versionChecker,
		startedAt:      time.Now(),
	}
}

// WithMinersStore attaches the shared miners store this Router reads and
// writes Bitaxes through (see snapshotConfig, the POST /api/config/miners
// route). Optional: a Router with no store just keeps serving whatever
// Bitaxes config was constructed with, same as before this feature
// existed -- useful for tests that don't care about hot-reload.
func (f *Router) WithMinersStore(store *config.MinersStore) *Router {
	f.minersStore = store
	return f
}

// WithAppSettingsStore attaches the shared app-settings store this Router
// reads and writes Electricity/Pools/Remote/Firmware.Repos through (see
// snapshotConfig, the POST /api/config/settings route). Optional, same
// reasoning as WithMinersStore.
func (f *Router) WithAppSettingsStore(store *config.AppSettingsStore) *Router {
	f.appSettingsStore = store
	return f
}

// WithAuditLog attaches the log every state-changing route records into
// (see audit). Optional: without one, those routes just aren't recorded.
func (f *Router) WithAuditLog(log *audit.Log) *Router {
	f.auditLog = log
	return f
}

// audited records every call to the route it's set on -- see
// audit.Log.Middleware.
func (f *Router) audited(entryType string) func(http.Handler) http.Handler {
	return f.auditLog.Middleware(entryType, f.minerIP, f.logger)
}

// minerIP is the IP of the configured miner a request addresses by IP or
// hostname -- or what it was given, if that's no configured miner.
func (f *Router) minerIP(hostnameOrIP string) string {
	if miners := f.snapshotConfig().GetMinersFilterBy(hostnameOrIP); len(miners) > 0 {
		return miners[0].Ip
	}
	return hostnameOrIP
}

// snapshotConfig returns the current config by value, with Bitaxes and the
// managed app settings refreshed from their respective stores (a cheap
// no-op call when nothing changed on disk since the last one -- see
// MinersStore.Reload / AppSettingsStore.Reload).
func (f *Router) snapshotConfig() config.Config {
	cfg := f.config
	if f.minersStore != nil {
		bitaxes, err := f.minersStore.Reload()
		if err != nil {
			f.logger.Error("failed to reload miners config", "error", err)
		}
		cfg.Bitaxes = bitaxes
	}
	if f.appSettingsStore != nil {
		settings, err := f.appSettingsStore.Reload()
		if err != nil {
			f.logger.Error("failed to reload app settings", "error", err)
		}
		settings.ApplyTo(&cfg)
	}
	return cfg
}

// currentAppSettings returns the settings.yml overrides as they
// currently stand (possibly zero-value if no store is attached or nothing
// was ever saved) -- unlike snapshotConfig, this is the raw override-only
// value, not merged with the built-in defaults (see handler.GetAppSettings,
// which needs both separately).
func (f *Router) currentAppSettings() config.AppSettingsFile {
	if f.appSettingsStore == nil {
		return config.AppSettingsFile{}
	}
	settings, err := f.appSettingsStore.Reload()
	if err != nil {
		f.logger.Error("failed to reload app settings", "error", err)
	}
	return settings
}

func (f *Router) Listen() {
	go func() {
		f.listenAndServe()
	}()
}

// Handler builds the chi router without starting a listener — kept separate
// from listenAndServe so the routing table can be exercised in tests.
func (f *Router) Handler() http.Handler {
	router := chi.NewRouter()

	// Global middlewares – logging, panic recovery, request timeout.
	router.Use(middleware.RequestID)
	router.Use(middleware.RealIP)
	router.Use(middleware.Logger)
	router.Use(middleware.Recoverer)
	router.Use(middleware.Timeout(30 * time.Second))

	router.Get("/api/miners", func(w http.ResponseWriter, r *http.Request) {
		handler.ListMiners(f.snapshotConfig(), f.watcher, w, r)
	})
	router.Get("/api/miners/alerts", func(w http.ResponseWriter, r *http.Request) {
		handler.ListAlerts(f.snapshotConfig())(w, r)
	})
	router.Post("/api/miners/alerts/seen", func(w http.ResponseWriter, r *http.Request) {
		handler.MarkAlertsSeen(f.snapshotConfig())(w, r)
	})
	router.Get("/api/miners/history", func(w http.ResponseWriter, r *http.Request) {
		handler.History(f.snapshotConfig(), w, r)
	})
	router.Get("/api/miners/alerts/history", func(w http.ResponseWriter, r *http.Request) {
		handler.ListAlertsHistory(f.snapshotConfig())(w, r)
	})
	router.Get("/api/info", handler.Info(f.versionChecker, "", false, f.config.UI))
	router.Get("/api/config/miners", func(w http.ResponseWriter, r *http.Request) {
		handler.ListMinersConfig(f.snapshotConfig(), w, r)
	})
	router.With(f.audited(audit.TypeSaveMiners)).Post("/api/config/miners", func(w http.ResponseWriter, r *http.Request) {
		f.saveMu.Lock()
		defer f.saveMu.Unlock()
		cfg := f.snapshotConfig()
		merged, ok := handler.SaveMinersConfig(cfg, w, r)
		if !ok {
			return
		}
		if f.minersStore != nil {
			f.minersStore.Set(merged)
		}
		f.auditLog.RecordChanges(r, audit.MinerChanges(cfg.Bitaxes, merged), f.logger)
	})
	router.Get("/api/config/settings", func(w http.ResponseWriter, r *http.Request) {
		handler.GetAppSettings(f.snapshotConfig(), f.currentAppSettings(), w, r)
	})
	router.With(f.audited(audit.TypeSaveSettings)).Post("/api/config/settings", func(w http.ResponseWriter, r *http.Request) {
		f.saveMu.Lock()
		defer f.saveMu.Unlock()
		before := f.currentAppSettings()
		saved, ok := handler.SaveAppSettings(f.snapshotConfig(), before, w, r)
		if !ok {
			return
		}
		if f.appSettingsStore != nil {
			f.appSettingsStore.Set(saved)
		}
		f.auditLog.RecordChanges(r, audit.SettingsChanges(before, saved), f.logger)
	})
	// Not audited: it changes nothing, and can only reach the recipients
	// already saved -- a change to those is (mail_settings).
	router.Post("/api/config/mail/test", func(w http.ResponseWriter, r *http.Request) {
		handler.SendTestMail(f.config, w, r)
	})
	router.Get("/api/status", func(w http.ResponseWriter, r *http.Request) {
		handler.Status(f.snapshotConfig(), f.watcher, f.startedAt, w, r)
	})
	router.With(f.audited(audit.TypeDiscover)).Get("/api/config/discover", func(w http.ResponseWriter, r *http.Request) {
		handler.Discover(f.snapshotConfig(), w, r)
	})
	router.Get("/api/remote/board", func(w http.ResponseWriter, r *http.Request) {
		handler.RemoteBoard(f.snapshotConfig(), &f.remoteBoard, f.logger, w, r)
	})
	router.Get("/api/audit", handler.ListAudit(f.auditLog))
	router.Get("/api/audit/types", handler.ListAuditTypes)
	router.With(f.audited(audit.TypeExportAudit)).Get("/api/audit/export", handler.ExportAudit(f.auditLog))
	router.Get("/api/backups", func(w http.ResponseWriter, r *http.Request) {
		handler.ListBackups(f.config, w, r)
	})
	router.With(f.audited(audit.TypeDownloadBackups)).Get("/api/backups/download", func(w http.ResponseWriter, r *http.Request) {
		handler.DownloadBackups(f.logger, f.config, w, r)
	})
	router.With(f.audited(audit.TypeSwitchPrimary)).Put("/api/miners/pool/primary/enable", func(w http.ResponseWriter, r *http.Request) {
		handler.SwitchPool(f.logger, f.snapshotConfig(), config.Primary, w, r)
	})
	router.With(f.audited(audit.TypeSwitchFallback)).Put("/api/miners/pool/fallback/enable", func(w http.ResponseWriter, r *http.Request) {
		handler.SwitchPool(f.logger, f.snapshotConfig(), config.Fallback, w, r)
	})
	router.Route("/api/miners/{hostnameOrIp}", func(r chi.Router) {
		r.Use(func(h http.Handler) http.Handler {
			return MinerCtx(h, f.snapshotConfig())
		})
		r.Get("/stats", func(w http.ResponseWriter, r *http.Request) {
			WithMinerCtx(w, r, func(miner config.Bitaxe) {
				handler.Stats(miner, f.snapshotConfig(), w, r)
			})
		})
		r.With(f.audited(audit.TypeRestart)).Post("/restart", func(w http.ResponseWriter, r *http.Request) {
			WithMinerCtx(w, r, func(miner config.Bitaxe) {
				handler.Restart(miner, f.logger, f.snapshotConfig(), w)
			})
		})
	})

	return router
}

func (f *Router) listenAndServe() {
	router := f.Handler()

	port := f.config.Server.Port
	if port == "" {
		port = "8080"
	}

	f.logger.Info(fmt.Sprintf("dashboard-api listening on :%s", port))
	if err := http.ListenAndServe(":"+port, router); err != nil {
		f.logger.Error("Failed to start server!", "error", err)
	}
}

func WithMinerCtx(w http.ResponseWriter, r *http.Request, handler func(config.Bitaxe)) {
	ctx := r.Context()
	miner, ok := ctx.Value(minerContextKey).(config.Bitaxe)
	if !ok {
		http.Error(w, http.StatusText(http.StatusUnprocessableEntity), http.StatusUnprocessableEntity)
		return
	}
	handler(miner)
}

func MinerCtx(next http.Handler, cfg config.Config) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Resolve the miner from the URL path parameter (ip/hostname).
		hostnameOrIp := chi.URLParam(r, "hostnameOrIp")
		miners := cfg.GetMinersFilterBy(hostnameOrIp)
		if len(miners) == 0 {
			http.Error(w, "miner not found", http.StatusNotFound)
			return
		}
		ctx := context.WithValue(r.Context(), minerContextKey, miners[0])
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
