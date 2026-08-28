// cmd/dashboard-api/router.go
package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/appversion"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/handler"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/healtcheck"
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
}

func NewRouter(logger *slog.Logger, config config.Config, watcher *healtcheck.Watcher, versionChecker *appversion.Checker) *Router {
	return &Router{
		logger:         logger.With("namespace", "Router"),
		config:         config,
		watcher:        watcher,
		versionChecker: versionChecker,
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
	router.Get("/api/miners/alerts/history", func(w http.ResponseWriter, r *http.Request) {
		handler.ListAlertsHistory(f.snapshotConfig())(w, r)
	})
	router.Get("/api/info", handler.Info(f.versionChecker, "", f.config.UI))
	router.Get("/api/config/miners", func(w http.ResponseWriter, r *http.Request) {
		handler.ListMinersConfig(f.snapshotConfig(), w, r)
	})
	router.Post("/api/config/miners", func(w http.ResponseWriter, r *http.Request) {
		if merged, ok := handler.SaveMinersConfig(f.snapshotConfig(), w, r); ok && f.minersStore != nil {
			f.minersStore.Set(merged)
		}
	})
	router.Get("/api/config/settings", func(w http.ResponseWriter, r *http.Request) {
		handler.GetAppSettings(f.snapshotConfig(), f.currentAppSettings(), w, r)
	})
	router.Post("/api/config/settings", func(w http.ResponseWriter, r *http.Request) {
		if saved, ok := handler.SaveAppSettings(f.snapshotConfig(), w, r); ok && f.appSettingsStore != nil {
			f.appSettingsStore.Set(saved)
		}
	})
	router.Get("/api/config/discover", func(w http.ResponseWriter, r *http.Request) {
		handler.Discover(f.snapshotConfig(), w, r)
	})
	router.Put("/api/miners/pool/primary/enable", func(w http.ResponseWriter, r *http.Request) {
		handler.SwitchPool(f.logger, f.snapshotConfig(), config.Primary, w, r)
	})
	router.Put("/api/miners/pool/fallback/enable", func(w http.ResponseWriter, r *http.Request) {
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
		r.Post("/restart", func(w http.ResponseWriter, r *http.Request) {
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
