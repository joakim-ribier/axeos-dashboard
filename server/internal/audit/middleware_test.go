package audit

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func serveAudited(t *testing.T, h http.HandlerFunc, path string, resolveTarget func(string) string) Entry {
	t.Helper()
	log := NewLog(t.TempDir())
	audited := log.Middleware(TypeRestart, resolveTarget, slog.New(slog.NewTextHandler(io.Discard, nil)))

	r := httptest.NewRequest(http.MethodPost, path, nil)
	r.Header.Set("User-Agent", "test-agent/1.0")
	audited(h).ServeHTTP(httptest.NewRecorder(), r)

	entries, err := log.ReadRange(time.Now().Add(-time.Hour), time.Now().Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 {
		t.Fatalf("got %d entries, want 1", len(entries))
	}
	return entries[0]
}

func noResolve(s string) string { return s }

func TestMiddleware(t *testing.T) {
	t.Run("a failure keeps its status and its JSON error's message", func(t *testing.T) {
		e := serveAudited(t, func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusBadGateway)
			_, _ = w.Write([]byte(`{"error":"Bad Gateway","message":"miner unreachable","code":502}`))
		}, "/restart", noResolve)

		if e.Status != http.StatusBadGateway || e.Error != "miner unreachable" {
			t.Errorf("status %d, error %q, want 502 and the message", e.Status, e.Error)
		}
	})

	t.Run("a success with no explicit WriteHeader is the implicit 200, with no error", func(t *testing.T) {
		e := serveAudited(t, func(w http.ResponseWriter, r *http.Request) {
			_, _ = w.Write([]byte(`{"ok":true}`))
		}, "/restart", noResolve)

		if e.Status != http.StatusOK || e.Error != "" {
			t.Errorf("status %d, error %q, want 200 and no error", e.Status, e.Error)
		}
	})

	t.Run("records who asked, what for, and the miner by its IP", func(t *testing.T) {
		e := serveAudited(t, func(w http.ResponseWriter, r *http.Request) {}, "/switch?miner=bitaxe-1",
			func(s string) string {
				if s == "bitaxe-1" {
					return "10.0.0.1"
				}
				return s
			})

		want := Entry{Source: SourceAPI, Type: TypeRestart, Target: "10.0.0.1", IP: "192.0.2.1", UserAgent: "test-agent/1.0", Query: "miner=bitaxe-1"}
		if e.Source != want.Source || e.Type != want.Type || e.Target != want.Target || e.IP != want.IP || e.UserAgent != want.UserAgent || e.Query != want.Query {
			t.Errorf("entry = %+v, want %+v", e, want)
		}
	})
}

func TestErrorBody(t *testing.T) {
	t.Run("keeps an error response's body", func(t *testing.T) {
		rw := &errorBody{ResponseWriter: httptest.NewRecorder()}
		rw.WriteHeader(http.StatusBadGateway)
		_, _ = rw.Write([]byte("unreachable\n"))
		if rw.errorMessage() != "unreachable" {
			t.Errorf("errorMessage = %q, want the plain-text body", rw.errorMessage())
		}
	})

	t.Run("passes a success through without keeping it", func(t *testing.T) {
		rec := httptest.NewRecorder()
		rw := &errorBody{ResponseWriter: rec}
		_, _ = rw.Write([]byte("zip bytes"))
		if rw.body.Len() != 0 || rec.Body.String() != "zip bytes" {
			t.Errorf("kept %q, sent %q, want nothing kept and the body sent", rw.body.String(), rec.Body.String())
		}
	})
}
