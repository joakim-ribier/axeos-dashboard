package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/model"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/version"
)

func TestInfo_localMode(t *testing.T) {
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/info", nil)

	Info(testVersionChecker(), "", config.UIConfig{})(w, r)

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
	// A zero-value config.UIConfig (no ui: block in dashboard.yml) must
	// normalize to everything enabled -- see UIVisibility.Normalized.
	if got.UI.Page.Settings != "enabled" {
		t.Errorf("UI.Page.Settings = %q, want %q", got.UI.Page.Settings, "enabled")
	}
	if got.UI.Action.MinerRestart != "enabled" || got.UI.Action.MinerPoolSwitch != "enabled" {
		t.Errorf("UI.Action = %+v, want both enabled", got.UI.Action)
	}
}

func TestInfo_remoteMode(t *testing.T) {
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/info", nil)

	ui := config.UIConfig{
		Page:   config.UIPageConfig{Settings: config.UIHidden},
		Action: config.UIActionConfig{MinerRestart: config.UIHidden, MinerPoolSwitch: config.UIHidden},
	}
	Info(testVersionChecker(), "https://hashboard.live", ui)(w, r)

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
	if got.UI.Page.Settings != "hidden" {
		t.Errorf("UI.Page.Settings = %q, want %q", got.UI.Page.Settings, "hidden")
	}
}
