// internal/model/miner.go
package model

// MinerInfo holds the information that is exposed for each miner.
type MinerInfo struct {
	Timestamp string `json:"timestamp"`

	MacAddr     string `json:"macAddr"`     // Mac address
	IP          string `json:"ip"`          // Miner IP address (derived from the folder name)
	Hostname    string `json:"hostname"`    // Human-readable name from config
	DeviceModel string `json:"deviceModel"` // Computed device model (e.g. "NerdQAxe++", "Bitaxe 602")

	SharesAccepted int64 `json:"sharesAccepted"`
	SharesRejected int64 `json:"sharesRejected"`
	BlockFound     int64 `json:"blockFound"`

	// Total* are persistent, reboot-surviving counters (see
	// internal/storage.Totals) -- unlike SharesAccepted/SharesRejected and
	// UptimeSeconds above, which reset whenever the device itself reboots,
	// these keep accumulating for as long as the miner has been tracked.
	// Zero until the feeder has written at least one totals.json for this
	// miner, or until the backfill tool has run.
	TotalUptimeSeconds  int64 `json:"totalUptimeSeconds,omitempty"`
	TotalSharesAccepted int64 `json:"totalSharesAccepted,omitempty"`
	TotalSharesRejected int64 `json:"totalSharesRejected,omitempty"`

	Version         string  `json:"version"`              // Firmware version (e.g. "v2.12.2")
	LatestVersion   string  `json:"latestVersion"`        // Latest firmware version available on GitHub
	UpdateAvailable bool    `json:"updateAvailable"`      // True when LatestVersion != Version
	ReleaseURL      string  `json:"releaseURL,omitempty"` // GitHub releases page for the latest firmware version
	UptimeSeconds   int64   `json:"uptimeSeconds"`        // Miner uptime in seconds
	ResponseTime    float64 `json:"responseTime"`         // Ping/latency to the pool (ms).

	// Additional fields requested by the API
	HashRateTHs       float64 `json:"hashRateTHs"`       // Hash rate expressed in terahashes per second (TH/s)
	EnergyJPerTh      float64 `json:"energyJPerTh"`      // Energy consumption per terahash (Joules per TH)
	NetworkDifficulty int64   `json:"networkDifficulty"` // Current network difficulty reported by the pool (unitless)
	BestDiff          int64   `json:"bestDiff"`          // Highest difficulty value ever solved by the miner since start‑up

	Power    float64 `json:"power"`    // Watts (Joules per second)
	Voltage  float64 `json:"voltage"`  // Volts (millivolts)
	Temp     float64 `json:"temp"`     // Primary temperature sensor reading (°C)
	FanSpeed float64 `json:"fanspeed"` // Fan speed (linked to the Temp field)

	// Health check
	Alive          bool   `json:"alive"`
	AliveCheckedAt string `json:"aliveCheckedAt,omitempty"`

	// Error surfaces a serious inconsistency the UI should call out
	// distinctly from a normal offline/unreachable state -- currently just
	// a mismatch between the configured mac: and what the device itself
	// reports (wrong device at this IP, or a config typo).
	Error string `json:"error,omitempty"`

	// Alerts is whatever the feeder computed and persisted at the poll that
	// produced this snapshot (temp/fan out of range, offline, mac mismatch,
	// firmware update) -- the current state as of Timestamp, not a live value.
	Alerts []Alert `json:"alerts,omitempty"`

	// Pool urls
	StratumURL                  string `json:"stratumURL"`                    // Hostname of the primary Stratum pool
	StratumUser                 string `json:"stratumUser"`                   // Username (typically miner ID) for the primary pool
	StratumDashboardURL         string `json:"stratumDashboardURL,omitempty"` // Web dashboard URL for the primary pool
	FallbackStratumURL          string `json:"fallbackStratumURL"`
	FallbackStratumUser         string `json:"fallbackStratumUser"`
	FallbackStratumDashboardURL string `json:"fallbackStratumDashboardURL,omitempty"` // Web dashboard URL for the fallback pool
	IsUsingFallbackStratum      int64  `json:"isUsingFallbackStratum"`

	// Electricity cost
	ElectricityRatePerKwh float64 `json:"electricityRatePerKwh,omitempty"`
}

// MinersResponse is the top‑level JSON structure returned by GET /api/miners.
type MinersResponse struct {
	Configured int         `json:"configured"` // Number of miners in config
	Total      int         `json:"total"`      // Number of miners successfully loaded
	Miners     []MinerInfo `json:"miners"`

	// BoardPublic reflects hashboard's Account.Public flag for this board
	// (remote-dashboard-api only) — meaningless/always false for local
	// dashboard-api, which has no such concept and whose UI never reads it.
	BoardPublic bool `json:"boardPublic"`
}

// InfoResponse is the JSON structure returned by GET /api/info — metadata
// about this server instance, not any particular board's data. Deliberately
// its own endpoint, outside any board-access gating: unlike miner data, none
// of this is board-specific, so it must stay visible even to a visitor
// locked out of a private board (see RequireBoardAccess).
type InfoResponse struct {
	BuildSHA string `json:"buildSHA,omitempty"` // Git commit this binary was built from

	// Whether this dashboard-api/remote-dashboard-api build itself is up to
	// date with GitHub's "latest" release ("unknown" | "upToDate" |
	// "updateAvailable") — see internal/appversion. Checked server-side at
	// most once a day, so every client reads the same cached answer.
	AppVersionStatus     string `json:"appVersionStatus,omitempty"`
	AppVersionReleaseURL string `json:"appVersionReleaseURL,omitempty"`

	// HashboardURL is the base URL of the hashboard instance backing this
	// remote-dashboard-api (remote-dashboard-api only, config.HashboardURL)
	// — lets the UI build a link to the board owner's hashboard account page.
	HashboardURL string `json:"hashboardURL,omitempty"`

	// UI mirrors config.UIConfig (each value normalized, so the frontend
	// never sees an empty string) -- the single React codebase shows
	// everything unless a flag here says otherwise, instead of hardcoding
	// what "local" vs "remote" means.
	UI UIFeatures `json:"ui"`
}

type UIFeatures struct {
	Page   UIPageFeatures   `json:"page"`
	Action UIActionFeatures `json:"action"`
}

type UIPageFeatures struct {
	// Settings: "enabled" | "readonly" | "hidden" -- see config.UIPageConfig.
	Settings string `json:"settings"`
}

type UIActionFeatures struct {
	// MinerRestart/MinerPoolSwitch: "enabled" | "readonly" | "hidden" --
	// see config.UIActionConfig. "readonly" renders the button disabled
	// (with a hint), "hidden" doesn't render it at all.
	MinerRestart    string `json:"minerRestart"`
	MinerPoolSwitch string `json:"minerPoolSwitch"`
}
