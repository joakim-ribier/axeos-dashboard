package main

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
)

func TestMinerCtx(t *testing.T) {
	cfg := config.Config{
		Bitaxes: []config.Bitaxe{
			{Ip: "10.0.0.1", Mac: "aabbccddeeff", Hostname: "bitaxe-1", Enabled: true},
		},
	}

	router := chi.NewRouter()
	router.Route("/api/miners/{hostnameOrIp}", func(r chi.Router) {
		r.Use(func(h http.Handler) http.Handler { return MinerCtx(h, cfg) })
		r.Get("/ping", func(w http.ResponseWriter, r *http.Request) {
			WithMinerCtx(w, r, func(miner config.Bitaxe) {
				_, _ = w.Write([]byte(miner.Ip + " " + miner.Mac))
			})
		})
	})

	t.Run("known miner resolves, with its MAC carried through from config", func(t *testing.T) {
		w := httptest.NewRecorder()
		r := httptest.NewRequest(http.MethodGet, "/api/miners/bitaxe-1/ping", nil)

		router.ServeHTTP(w, r)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
		}
		if w.Body.String() != "10.0.0.1 aabbccddeeff" {
			t.Errorf("body = %q, want %q", w.Body.String(), "10.0.0.1 aabbccddeeff")
		}
	})

	t.Run("unknown miner returns 404 and never reaches the handler", func(t *testing.T) {
		w := httptest.NewRecorder()
		r := httptest.NewRequest(http.MethodGet, "/api/miners/unknown/ping", nil)

		router.ServeHTTP(w, r)

		if w.Code != http.StatusNotFound {
			t.Errorf("status = %d, want %d", w.Code, http.StatusNotFound)
		}
	})
}

func TestWithMinerCtx_missingContextValue(t *testing.T) {
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/miners/x/ping", nil)

	called := false
	WithMinerCtx(w, r, func(miner config.Bitaxe) { called = true })

	if called {
		t.Error("handler should not be called when the miner context value is missing")
	}
	if w.Code != http.StatusUnprocessableEntity {
		t.Errorf("status = %d, want %d", w.Code, http.StatusUnprocessableEntity)
	}
}
