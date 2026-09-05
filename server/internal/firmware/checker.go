// internal/firmware/checker.go
package firmware

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

const cacheFile = "firmware_cache.json"

type ModelCache struct {
	Version   string    `json:"version"`
	CheckedAt time.Time `json:"checkedAt"`
}

type Cache struct {
	Models map[string]ModelCache `json:"models"`
}

type githubRelease struct {
	TagName string `json:"tag_name"`
}

func CheckAndCache(model string, repos map[string]string, cacheTTL time.Duration, dataDir string, logger *slog.Logger) {
	cache := loadFromDisk(dataDir)

	if mc, ok := cache.Models[model]; ok {
		if time.Since(mc.CheckedAt) < cacheTTL {
			return
		}
	}

	version, err := fetchLatest(model, repos)
	if err != nil {
		logger.Error("Failed to fetch latest firmware version", "model", model, "error", err)
		return
	}

	logger.Info("Latest firmware version fetched", "model", model, "version", version)

	cache.Models[model] = ModelCache{
		Version:   version,
		CheckedAt: time.Now(),
	}

	if err := saveToDisk(dataDir, cache); err != nil {
		logger.Error("Failed to save firmware cache", "model", model, "error", err)
	}
}

// LoadCache is safe to call in the request path — no network calls.
func LoadCache(dataDir string) Cache {
	return loadFromDisk(dataDir)
}

// LatestCheck returns the most recent ModelCache.CheckedAt across every
// model in cache, or the zero time if cache has no entries yet. Shared by
// dashboard-api's own GET /api/config/settings (see handler.writeAppSettingsResponse)
// and the feeder's remote push (see cmd/feeder.pushSettingsConfigToRemote) --
// both need the same "when did we last actually check GitHub" value.
func LatestCheck(cache Cache) time.Time {
	var latest time.Time
	for _, mc := range cache.Models {
		if mc.CheckedAt.After(latest) {
			latest = mc.CheckedAt
		}
	}
	return latest
}

func fetchLatest(model string, repos map[string]string) (string, error) {
	url, ok := repos[model]
	if !ok {
		return "", fmt.Errorf("no firmware repository configured for model: %s", model)
	}

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "axeos-bitaxe-dashboard")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("GitHub API returned %s for model %s", resp.Status, model)
	}

	var release githubRelease
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return "", err
	}

	return release.TagName, nil
}

func loadFromDisk(dataDir string) Cache {
	data, err := os.ReadFile(filepath.Join(dataDir, cacheFile))
	if err != nil {
		return Cache{Models: make(map[string]ModelCache)}
	}
	var c Cache
	if err := json.Unmarshal(data, &c); err != nil {
		return Cache{Models: make(map[string]ModelCache)}
	}
	if c.Models == nil {
		c.Models = make(map[string]ModelCache)
	}
	return c
}

func saveToDisk(dataDir string, c Cache) error {
	data, err := json.Marshal(c)
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dataDir, cacheFile), data, 0o644)
}
