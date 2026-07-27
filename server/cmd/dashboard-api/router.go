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

	config         config.Config
	watcher        *healtcheck.Watcher
	versionChecker *appversion.Checker
}

func NewRouter(logger *slog.Logger, config config.Config, watcher *healtcheck.Watcher, versionChecker *appversion.Checker) *Router {
	return &Router{
		logger:         logger.With("namespace", "Router"),
		config:         config,
		watcher:        watcher,
		versionChecker: versionChecker,
	}
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
		handler.ListMiners(f.config, f.watcher, w, r)
	})
	router.Get("/api/info", handler.Info(f.versionChecker, ""))
	router.Put("/api/miners/pool/primary/enable", func(w http.ResponseWriter, r *http.Request) {
		handler.SwitchPool(f.logger, f.config, config.Primary, w, r)
	})
	router.Put("/api/miners/pool/fallback/enable", func(w http.ResponseWriter, r *http.Request) {
		handler.SwitchPool(f.logger, f.config, config.Fallback, w, r)
	})
	router.Put("/api/miners/set/wifi", func(w http.ResponseWriter, r *http.Request) {
		handler.SetWifi(f.logger, f.config, w, r)
	})
	router.Route("/api/miners/{hostnameOrIp}", func(r chi.Router) {
		r.Use(func(h http.Handler) http.Handler {
			return MinerCtx(h, f.config)
		})
		r.Get("/stats", func(w http.ResponseWriter, r *http.Request) {
			WithMinerCtx(w, r, func(miner config.Bitaxe) {
				handler.Stats(miner, f.config, w, r)
			})
		})
		r.Post("/restart", func(w http.ResponseWriter, r *http.Request) {
			WithMinerCtx(w, r, func(miner config.Bitaxe) {
				handler.Restart(miner, f.logger, f.config, w)
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
