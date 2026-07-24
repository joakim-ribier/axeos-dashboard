package handler

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/hashboardaccess"
)

func writeAccessFixture(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func passThroughHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
}

func TestRequireBoardAccess_publicBoardPassesThrough(t *testing.T) {
	dir := t.TempDir()
	writeAccessFixture(t, filepath.Join(dir, "accounts", "someboard0000000.json"), `{"public":true}`)
	checker := hashboardaccess.New(dir)

	handler := RequireBoardAccess(checker)(passThroughHandler())

	w := httptest.NewRecorder()
	r := withURLParams(httptest.NewRequest(http.MethodGet, "/api/someboard0000000/miners", nil), map[string]string{"boardId": "someboard0000000"})
	handler.ServeHTTP(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
}

func TestRequireBoardAccess_privateBoardNoCookieRejected(t *testing.T) {
	dir := t.TempDir()
	writeAccessFixture(t, filepath.Join(dir, "accounts", "someboard0000000.json"), `{"public":false}`)
	checker := hashboardaccess.New(dir)

	handler := RequireBoardAccess(checker)(passThroughHandler())

	w := httptest.NewRecorder()
	r := withURLParams(httptest.NewRequest(http.MethodGet, "/api/someboard0000000/miners", nil), map[string]string{"boardId": "someboard0000000"})
	handler.ServeHTTP(w, r)

	if w.Code != http.StatusForbidden {
		t.Errorf("status = %d, want %d", w.Code, http.StatusForbidden)
	}
}

func TestRequireBoardAccess_privateBoardValidSessionPassesThrough(t *testing.T) {
	dir := t.TempDir()
	writeAccessFixture(t, filepath.Join(dir, "accounts", "someboard0000000.json"), `{"public":false}`)
	writeAccessFixture(t, filepath.Join(dir, "sessions", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.json"),
		`{"boardId":"someboard0000000","expiresAt":"2999-01-01T00:00:00Z"}`)
	checker := hashboardaccess.New(dir)

	handler := RequireBoardAccess(checker)(passThroughHandler())

	w := httptest.NewRecorder()
	r := withURLParams(httptest.NewRequest(http.MethodGet, "/api/someboard0000000/miners", nil), map[string]string{"boardId": "someboard0000000"})
	r.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"})
	handler.ServeHTTP(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
}
