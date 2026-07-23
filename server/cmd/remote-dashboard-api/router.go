// cmd/remote-dashboard-api/router.go
package main

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/appversion"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/handler"
)

// NewRouter builds the remote-dashboard-api HTTP router.
func NewRouter(cfg config.Config, versionChecker *appversion.Checker) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))

	r.Route("/api/{boardId}", func(r chi.Router) {
		r.Get("/miners", handler.ListRemoteMiners(cfg, versionChecker))
		r.Get("/{ip}/stats", handler.RemoteStats(cfg))
	})

	return r
}
