package bitaxe

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
)

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func serverAddr(server *httptest.Server) string {
	return strings.TrimPrefix(server.URL, "http://")
}

func TestClient_FetchSystemInfo(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path != "/api/system/info" {
				t.Errorf("request path = %q, want %q", r.URL.Path, "/api/system/info")
			}
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"temp":55}`))
		}))
		defer server.Close()

		c := NewClient(testLogger(), "api/system/info", time.Second)
		got, err := c.FetchSystemInfo(context.Background(), serverAddr(server))
		if err != nil {
			t.Fatalf("FetchSystemInfo() unexpected error: %v", err)
		}
		if string(got) != `{"temp":55}` {
			t.Errorf("FetchSystemInfo() = %s, want %s", got, `{"temp":55}`)
		}
	})

	t.Run("non-200 status returns error", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusServiceUnavailable)
		}))
		defer server.Close()

		c := NewClient(testLogger(), "api/system/info", time.Second)
		if _, err := c.FetchSystemInfo(context.Background(), serverAddr(server)); err == nil {
			t.Fatal("FetchSystemInfo() error = nil, want error for non-200 status")
		}
	})

	t.Run("unreachable host returns error", func(t *testing.T) {
		c := NewClient(testLogger(), "api/system/info", 100*time.Millisecond)
		if _, err := c.FetchSystemInfo(context.Background(), "127.0.0.1:1"); err == nil {
			t.Fatal("FetchSystemInfo() error = nil, want error for unreachable host")
		}
	})
}

func TestClient_UpdateSystemStratumSettings(t *testing.T) {
	var gotMethod, gotContentType string
	var gotBody config.BitaxeServerSettings

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMethod = r.Method
		gotContentType = r.Header.Get("Content-Type")
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	c := NewClient(testLogger(), "api/system", time.Second)
	settings := config.BitaxeServerSettings{Url: "pool.example", Port: 3333, User: "acct"}

	if err := c.UpdateSystemStratumSettings(serverAddr(server), settings); err != nil {
		t.Fatalf("UpdateSystemStratumSettings() unexpected error: %v", err)
	}
	if gotMethod != http.MethodPatch {
		t.Errorf("method = %q, want %q", gotMethod, http.MethodPatch)
	}
	if gotContentType != "application/json" {
		t.Errorf("Content-Type = %q, want %q", gotContentType, "application/json")
	}
	if gotBody != settings {
		t.Errorf("body = %+v, want %+v", gotBody, settings)
	}
}

func TestClient_UpdateSystemWifiSettings_errorStatus(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
	}))
	defer server.Close()

	c := NewClient(testLogger(), "api/system", time.Second)
	err := c.UpdateSystemWifiSettings(serverAddr(server), config.BitaxeWifiSettings{Name: "ssid"})
	if err == nil {
		t.Fatal("UpdateSystemWifiSettings() error = nil, want error for non-200 status")
	}
}

func TestClient_Restart(t *testing.T) {
	var gotMethod string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMethod = r.Method
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	c := NewClient(testLogger(), "api/system/restart", time.Second)
	if err := c.Restart(serverAddr(server)); err != nil {
		t.Fatalf("Restart() unexpected error: %v", err)
	}
	if gotMethod != http.MethodPost {
		t.Errorf("method = %q, want %q", gotMethod, http.MethodPost)
	}
}
