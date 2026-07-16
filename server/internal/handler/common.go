// internal/handler/miner.go
package handler

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/model"
)

// envDataRoot is the name of the environment variable that can override the
// default location of the BitAxe data directory.
const envDataRoot = "BITAXE_DATA_ROOT"

// getDataRoot returns the directory that holds the per-miner folders.
// It first checks the BITAXE_DATA_ROOT env var; if empty it falls back to
// {dataDir}/data/bitaxes.
func getDataRoot(c config.StorageConfig) string {
	if dir := os.Getenv(envDataRoot); dir != "" {
		return dir
	}
	return c.BitaxesDir()
}

// ---------------------------------------------------------------------------
// File structures (mirror the JSON layout of BitAxe data files)
// ---------------------------------------------------------------------------

// latestFileStructure mirrors the exact JSON layout of a `latest.json` file
// (and of each line in a daily `.jsonl` file).
// Only the fields needed by the API are declared; everything else is ignored.
type latestFileStructure struct {
	Timestamp       string           `json:"ts"`
	IP              string           `json:"ip,omitempty"`
	Hostname        string           `json:"hostname,omitempty"`
	Model           string           `json:"model,omitempty"`
	Payload         PayloadStructure `json:"payload"`
	ElectricityRate float64          `json:"electricityRatePerKwh,omitempty"`
	LatestFirmware  string           `json:"latestFirmware,omitempty"`
}

type PayloadStructure struct {
	MacAddr string `json:"macAddr"`

	SharesAccepted int64 `json:"sharesAccepted"`
	SharesRejected int64 `json:"sharesRejected"`
	BlockFound     int64 `json:"blockFound"`  // bitaxe
	FoundBlocks    int64 `json:"foundBlocks"` // nerdaxe

	Version       string `json:"version"`
	UptimeSeconds int64  `json:"uptimeSeconds"`

	HashRate          float64 `json:"hashRate"`          // GH/s (as stored in the file)
	NetworkDifficulty float64 `json:"networkDifficulty"` // NerdAxe sends scientific notation
	BestDiff          int64   `json:"bestDiff"`

	Power    float64 `json:"power"`
	Voltage  float64 `json:"voltage"`
	Temp     float64 `json:"temp"`
	FanSpeed float64 `json:"fanspeed"`

	// Pool urls
	StratumURL          string `json:"stratumURL"`
	StratumUser         string `json:"stratumUser"`
	FallbackStratumURL  string `json:"fallbackStratumURL"`
	FallbackStratumUser string `json:"fallbackStratumUser"`

	//-- Specific to miner model --//

	// .BitAxe
	ResponseTime           float64 `json:"responseTime"`
	IsUsingFallbackStratum int64   `json:"isUsingFallbackStratum"`

	// .NerdQaxe
	Ping          float64       `json:"lastpingrtt"`
	StratumConfig StratumConfig `json:"stratum"`
	DeviceModel   string        `json:"deviceModel"`
	BoardVersion  string        `json:"boardVersion"`
}

type StratumConfig struct {
	UsingFallback bool `json:"usingFallback"`
}

func (p PayloadStructure) getResponseTime(miner config.Bitaxe) float64 {
	if miner.Model == "bitaxe" {
		return p.ResponseTime
	}
	return p.Ping
}

func (p PayloadStructure) getIsUsingFallbackStratum(miner config.Bitaxe) int64 {
	if miner.Model == "bitaxe" {
		return p.IsUsingFallbackStratum
	}
	if p.StratumConfig.UsingFallback {
		return 1
	}
	return 0
}

// getBlockFound returns block count regardless of field name (bitaxe: blockFound, nerdaxe: foundBlocks).
func (p PayloadStructure) getBlockFound() int64 {
	if p.FoundBlocks > 0 {
		return p.FoundBlocks
	}
	return p.BlockFound
}

// getDeviceModel resolves the best human-readable model string.
// Priority: deviceModel from payload > "Bitaxe {boardVersion}" > config model.
func (p PayloadStructure) getDeviceModel(miner config.Bitaxe) string {
	if p.DeviceModel != "" {
		return p.DeviceModel
	}
	if p.BoardVersion != "" {
		return "Bitaxe " + p.BoardVersion
	}
	return miner.Model
}

// toMinerInfo converts a parsed latestFileStructure into the API-facing
// MinerInfo model. This is the single source of truth for field mapping,
// unit conversions (GH/s → TH/s), and derived calculations (J/TH).
// poolDashboardURL builds the web dashboard URL for a pool by looking up the
// stratum hostname in the dashboards map and substituting {user} with the
// account part of the stratum user (everything before the first dot).
func poolDashboardURL(stratumURL, stratumUser string, dashboards map[string]string) string {
	tmpl, ok := dashboards[stratumURL]
	if !ok || stratumUser == "" {
		return ""
	}
	account := stratumUser
	if idx := strings.IndexByte(stratumUser, '.'); idx >= 0 {
		account = stratumUser[:idx]
	}
	return strings.ReplaceAll(tmpl, "{user}", account)
}

// firmwareReleaseURL converts a GitHub API "latest release" URL (as configured
// under firmware.repos, e.g. "https://api.github.com/repos/owner/repo/releases/latest")
// into the equivalent web page URL. Returns "" if apiURL isn't a recognized
// GitHub API releases URL.
func firmwareReleaseURL(apiURL string) string {
	const prefix = "https://api.github.com/repos/"
	if !strings.HasPrefix(apiURL, prefix) {
		return ""
	}
	return "https://github.com/" + strings.TrimPrefix(apiURL, prefix)
}

func toMinerInfo(raw latestFileStructure, miner config.Bitaxe, latestFirmwareVersion, firmwareAPIURL string, dashboards map[string]string) model.MinerInfo {
	// Convert GH/s → TH/s (1 TH = 1 000 GH)
	hashRateTHs := raw.Payload.HashRate / 1_000.0

	// Energy consumption per terahash (J/TH)
	var energyJPerTh float64
	if hashRateTHs > 0 {
		energyJPerTh = raw.Payload.Power / hashRateTHs
	}

	updateAvailable := latestFirmwareVersion != "" &&
		raw.Payload.Version != "" &&
		raw.Payload.Version != latestFirmwareVersion

	return model.MinerInfo{
		Timestamp: raw.Timestamp,

		IP:          miner.Ip,
		MacAddr:     raw.Payload.MacAddr,
		Hostname:    miner.Hostname,
		DeviceModel: raw.Payload.getDeviceModel(miner),

		SharesAccepted: raw.Payload.SharesAccepted,
		SharesRejected: raw.Payload.SharesRejected,
		BlockFound:     raw.Payload.getBlockFound(),

		Version:         raw.Payload.Version,
		LatestVersion:   latestFirmwareVersion,
		UpdateAvailable: updateAvailable,
		ReleaseURL:      firmwareReleaseURL(firmwareAPIURL),
		UptimeSeconds:   raw.Payload.UptimeSeconds,
		ResponseTime:    raw.Payload.getResponseTime(miner),

		HashRateTHs:       hashRateTHs,
		EnergyJPerTh:      energyJPerTh,
		NetworkDifficulty: int64(raw.Payload.NetworkDifficulty),
		BestDiff:          raw.Payload.BestDiff,

		Power:    raw.Payload.Power,
		Voltage:  raw.Payload.Voltage,
		Temp:     raw.Payload.Temp,
		FanSpeed: raw.Payload.FanSpeed,

		IsUsingFallbackStratum:      raw.Payload.getIsUsingFallbackStratum(miner),
		StratumURL:                  raw.Payload.StratumURL,
		StratumUser:                 raw.Payload.StratumUser,
		StratumDashboardURL:         poolDashboardURL(raw.Payload.StratumURL, raw.Payload.StratumUser, dashboards),
		FallbackStratumURL:          raw.Payload.FallbackStratumURL,
		FallbackStratumUser:         raw.Payload.FallbackStratumUser,
		FallbackStratumDashboardURL: poolDashboardURL(raw.Payload.FallbackStratumURL, raw.Payload.FallbackStratumUser, dashboards),

		ElectricityRatePerKwh: raw.ElectricityRate,
	}
}

// ---------------------------------------------------------------------------
// Shared file-reading helpers
// ---------------------------------------------------------------------------

// decodeLatestJSON reads and decodes a single `latest.json` file.
// Returns an error if the file cannot be opened or contains invalid JSON.
func decodeLatestJSON(path string) (latestFileStructure, error) {
	f, err := os.Open(path)
	if err != nil {
		return latestFileStructure{}, fmt.Errorf("failed to open %s: %w", path, err)
	}
	defer func() {
		if err := f.Close(); err != nil {
			log.Printf("warning: failed to close file %s: %v", path, err)
		}
	}()

	var raw latestFileStructure
	if err := json.NewDecoder(f).Decode(&raw); err != nil {
		return latestFileStructure{}, fmt.Errorf("corrupted JSON in %s: %w", path, err)
	}
	return raw, nil
}

// decodeJSONL reads a `.jsonl` file line by line and returns all successfully
// parsed entries. Malformed lines are logged and skipped so that a single bad
// entry does not discard the rest of the day's history.
func decodeJSONL(path string) ([]latestFileStructure, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("failed to open %s: %w", path, err)
	}
	defer func() {
		if err := f.Close(); err != nil {
			log.Printf("warning: failed to close file %s: %v", path, err)
		}
	}()

	var entries []latestFileStructure
	lineNum := 0

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		lineNum++
		line := scanner.Text()

		// Skip blank lines
		if len(line) == 0 {
			continue
		}

		var raw latestFileStructure
		if err := json.Unmarshal([]byte(line), &raw); err != nil {
			log.Printf("warning: skipping malformed JSON line %d in %s: %v", lineNum, path, err)
			continue
		}
		entries = append(entries, raw)
	}

	if err := scanner.Err(); err != nil {
		return entries, fmt.Errorf("error reading %s: %w", path, err)
	}
	return entries, nil
}
