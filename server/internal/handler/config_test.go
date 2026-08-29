package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
)

func fakeAxeOsDevice(t *testing.T, hostname, mac string) string {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]string{
			"hostname": hostname,
			"macAddr":  mac,
		})
	}))
	t.Cleanup(srv.Close)

	u, err := url.Parse(srv.URL)
	if err != nil {
		t.Fatalf("parse test server URL: %v", err)
	}
	return u.Host
}

func testDiscoverConfig() config.Config {
	return config.Config{
		Endpoints: config.EndpointConfig{Info: "api/system/info"},
	}
}

func TestListMinersConfig(t *testing.T) {
	cfg := config.Config{
		Bitaxes: []config.Bitaxe{
			{Ip: "10.0.0.1", Mac: "aabbccddeeff", Hostname: "bitaxe-1", Enabled: true},
			{Ip: "10.0.0.2", Mac: "112233445566", Hostname: "bitaxe-2", Enabled: false},
		},
	}

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/config/miners", nil)
	ListMinersConfig(cfg, w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}

	var got bitaxesResponse
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(got.Bitaxes) != 2 {
		t.Fatalf("Bitaxes = %d entries, want 2 (including the disabled one)", len(got.Bitaxes))
	}
}

func TestListMinersConfig_includesLastUpdatedFromFileMtime(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "miners.yml")
	if err := os.WriteFile(path, []byte("bitaxes: []\n"), 0o644); err != nil {
		t.Fatalf("write miners file: %v", err)
	}

	cfg := config.Config{MinersFilePath: path}

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/config/miners", nil)
	ListMinersConfig(cfg, w, r)

	var got bitaxesResponse
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if got.LastUpdated == "" {
		t.Fatal("LastUpdated = \"\", want the miners file's mtime")
	}
	if _, err := time.Parse(time.RFC3339, got.LastUpdated); err != nil {
		t.Errorf("LastUpdated %q is not RFC3339: %v", got.LastUpdated, err)
	}
}

func TestListMinersConfig_noManagedFileOmitsLastUpdated(t *testing.T) {
	cfg := config.Config{Bitaxes: []config.Bitaxe{{Ip: "10.0.0.1", Mac: "aabbccddeeff", Hostname: "bitaxe-1"}}}

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/config/miners", nil)
	ListMinersConfig(cfg, w, r)

	var got bitaxesResponse
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if got.LastUpdated != "" {
		t.Errorf("LastUpdated = %q, want empty when MinersFilePath is unset", got.LastUpdated)
	}
}

func TestListMinersConfig_emptyReturnsEmptyArrayNotNull(t *testing.T) {
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/config/miners", nil)
	ListMinersConfig(config.Config{}, w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}
	if body := w.Body.String(); body != `{"bitaxes":[]}`+"\n" {
		t.Errorf("body = %q, want an empty (not null) bitaxes array", body)
	}
}

func postSaveMiners(t *testing.T, cfg config.Config, body any) (*httptest.ResponseRecorder, []config.Bitaxe, bool) {
	t.Helper()
	payload, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal request body: %v", err)
	}

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPost, "/api/config/miners", bytes.NewReader(payload))
	merged, ok := SaveMinersConfig(cfg, w, r)
	return w, merged, ok
}

func TestSaveMinersConfig_noMinersFilePathReturns409(t *testing.T) {
	w, _, ok := postSaveMiners(t, config.Config{}, bitaxesResponse{
		Bitaxes: []config.Bitaxe{{Ip: "10.0.0.1", Mac: "aabbccddeeff", Hostname: "new"}},
	})

	if ok {
		t.Fatal("SaveMinersConfig() ok = true, want false")
	}
	if w.Code != http.StatusConflict {
		t.Errorf("status = %d, want %d", w.Code, http.StatusConflict)
	}
}

func TestSaveMinersConfig_addsNewEntryForcedEnabled(t *testing.T) {
	dir := t.TempDir()
	minersPath := filepath.Join(dir, "miners.yml")
	cfg := config.Config{MinersFilePath: minersPath}

	w, merged, ok := postSaveMiners(t, cfg, bitaxesResponse{
		Bitaxes: []config.Bitaxe{
			{Ip: "10.0.0.1", Mac: "aabbccddeeff", Hostname: "new-miner", Model: "bitaxe", Enabled: false},
		},
	})

	if !ok {
		t.Fatalf("SaveMinersConfig() ok = false, status = %d, body = %s", w.Code, w.Body.String())
	}
	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
	if len(merged) != 1 || !merged[0].Enabled {
		t.Fatalf("merged = %+v, want the new entry forced enabled", merged)
	}
	if _, err := os.Stat(minersPath); err != nil {
		t.Errorf("miners file not written: %v", err)
	}
}

func TestSaveMinersConfig_updatesExistingEntryByMacInPlace(t *testing.T) {
	dir := t.TempDir()
	minersPath := filepath.Join(dir, "miners.yml")
	cfg := config.Config{
		MinersFilePath: minersPath,
		Bitaxes: []config.Bitaxe{
			{Ip: "10.0.0.1", Mac: "AA:BB:CC:DD:EE:FF", Hostname: "old-name", Enabled: true},
			{Ip: "10.0.0.2", Mac: "112233445566", Hostname: "other", Enabled: true},
		},
	}

	_, merged, ok := postSaveMiners(t, cfg, bitaxesResponse{
		// Same MAC as the first entry, different separators/case -- must
		// still match by normalized MAC and update in place, not append.
		Bitaxes: []config.Bitaxe{
			{Ip: "10.0.0.99", Mac: "aabbccddeeff", Hostname: "renamed", Enabled: false},
		},
	})

	if !ok {
		t.Fatal("SaveMinersConfig() ok = false")
	}
	if len(merged) != 2 {
		t.Fatalf("merged = %+v, want 2 entries (update, not append)", merged)
	}
	if merged[0].Hostname != "renamed" || merged[0].Ip != "10.0.0.99" || merged[0].Enabled {
		t.Errorf("merged[0] = %+v, want it replaced by the incoming entry (enabled respected, not forced, on an update)", merged[0])
	}
	if merged[1].Hostname != "other" {
		t.Errorf("merged[1] = %+v, want the untouched second entry preserved", merged[1])
	}
}

func TestSaveMinersConfig_duplicateMacInRequestRejected(t *testing.T) {
	dir := t.TempDir()
	cfg := config.Config{MinersFilePath: filepath.Join(dir, "miners.yml")}

	w, _, ok := postSaveMiners(t, cfg, bitaxesResponse{
		Bitaxes: []config.Bitaxe{
			{Ip: "10.0.0.1", Mac: "aabbccddeeff", Hostname: "a"},
			{Ip: "10.0.0.2", Mac: "AA-BB-CC-DD-EE-FF", Hostname: "b"},
		},
	})

	if ok {
		t.Fatal("SaveMinersConfig() ok = true, want false")
	}
	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestSaveMinersConfig_validation(t *testing.T) {
	tests := []struct {
		name   string
		bitaxe config.Bitaxe
	}{
		{name: "missing ip", bitaxe: config.Bitaxe{Mac: "aabbccddeeff", Hostname: "h"}},
		{name: "invalid ip", bitaxe: config.Bitaxe{Ip: "not-an-ip", Mac: "aabbccddeeff", Hostname: "h"}},
		{name: "missing hostname", bitaxe: config.Bitaxe{Ip: "10.0.0.1", Mac: "aabbccddeeff"}},
		{name: "missing mac", bitaxe: config.Bitaxe{Ip: "10.0.0.1", Hostname: "h"}},
		{name: "invalid mac", bitaxe: config.Bitaxe{Ip: "10.0.0.1", Mac: "not-a-mac", Hostname: "h"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir := t.TempDir()
			cfg := config.Config{MinersFilePath: filepath.Join(dir, "miners.yml")}

			w, _, ok := postSaveMiners(t, cfg, bitaxesResponse{Bitaxes: []config.Bitaxe{tt.bitaxe}})

			if ok {
				t.Fatal("SaveMinersConfig() ok = true, want false")
			}
			if w.Code != http.StatusBadRequest {
				t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
			}
		})
	}
}

func TestSaveMinersConfig_emptyBodyRejected(t *testing.T) {
	dir := t.TempDir()
	cfg := config.Config{MinersFilePath: filepath.Join(dir, "miners.yml")}

	w, _, ok := postSaveMiners(t, cfg, bitaxesResponse{Bitaxes: []config.Bitaxe{}})

	if ok {
		t.Fatal("SaveMinersConfig() ok = true, want false")
	}
	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestDiscover_byIP(t *testing.T) {
	addr := fakeAxeOsDevice(t, "my-bitaxe", "aabbccddeeff")

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/config/discover?ip="+addr, nil)

	Discover(testDiscoverConfig(), w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", w.Code, http.StatusOK, w.Body.String())
	}

	var got bitaxesResponse
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(got.Bitaxes) != 1 {
		t.Fatalf("Bitaxes = %d entries, want 1", len(got.Bitaxes))
	}
	if got.Bitaxes[0].Hostname != "my-bitaxe" || got.Bitaxes[0].Mac != "aabbccddeeff" {
		t.Errorf("Bitaxes[0] = %+v, want hostname/mac from the probed device", got.Bitaxes[0])
	}
	if !got.Bitaxes[0].Enabled {
		t.Error("Bitaxes[0].Enabled = false, want true")
	}
}

func TestDiscover_byIP_unreachableReturns404(t *testing.T) {
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/config/discover?ip=192.0.2.1&timeout=150ms", nil)

	Discover(testDiscoverConfig(), w, r)

	if w.Code != http.StatusNotFound {
		t.Errorf("status = %d, want %d", w.Code, http.StatusNotFound)
	}
}

func TestDiscover_byCIDR_tooLargeReturns400(t *testing.T) {
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/config/discover?cidr=10.0.0.0/8", nil)

	Discover(testDiscoverConfig(), w, r)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestDiscover_byCIDR_noDevicesFoundReturnsEmptyList(t *testing.T) {
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/config/discover?cidr=192.0.2.0/30&timeout=150ms", nil)

	Discover(testDiscoverConfig(), w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", w.Code, http.StatusOK, w.Body.String())
	}

	var got bitaxesResponse
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if got.Bitaxes == nil {
		t.Error("Bitaxes = nil, want an empty (but non-null) array")
	}
	if len(got.Bitaxes) != 0 {
		t.Errorf("Bitaxes = %d entries, want 0", len(got.Bitaxes))
	}
}

func TestDiscover_timeoutParam(t *testing.T) {
	tests := []struct {
		name       string
		timeout    string
		wantStatus int
	}{
		{name: "omitted uses the default", timeout: "", wantStatus: http.StatusNotFound},
		{name: "valid override within the cap", timeout: "500ms", wantStatus: http.StatusNotFound},
		{name: "not a duration", timeout: "not-a-duration", wantStatus: http.StatusBadRequest},
		{name: "zero rejected", timeout: "0s", wantStatus: http.StatusBadRequest},
		{name: "negative rejected", timeout: "-1s", wantStatus: http.StatusBadRequest},
		{name: "above the max rejected", timeout: "10s", wantStatus: http.StatusBadRequest},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			url := "/api/config/discover?ip=192.0.2.1"
			if tt.timeout != "" {
				url += "&timeout=" + tt.timeout
			}

			w := httptest.NewRecorder()
			r := httptest.NewRequest(http.MethodGet, url, nil)
			Discover(testDiscoverConfig(), w, r)

			if w.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d, body = %s", w.Code, tt.wantStatus, w.Body.String())
			}
		})
	}
}
