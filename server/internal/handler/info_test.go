package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/model"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/version"
)

func TestInfo_localMode(t *testing.T) {
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/info", nil)

	Info(testVersionChecker(), "")(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}
	var got model.InfoResponse
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if got.BuildSHA != version.GitSHA {
		t.Errorf("BuildSHA = %q, want %q", got.BuildSHA, version.GitSHA)
	}
	if got.HashboardURL != "" {
		t.Errorf("HashboardURL = %q, want empty for local mode", got.HashboardURL)
	}
}

func TestInfo_remoteMode(t *testing.T) {
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/info", nil)

	Info(testVersionChecker(), "https://hashboard.live")(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}
	var got model.InfoResponse
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if got.HashboardURL != "https://hashboard.live" {
		t.Errorf("HashboardURL = %q, want %q", got.HashboardURL, "https://hashboard.live")
	}
}
