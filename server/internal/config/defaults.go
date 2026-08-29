// internal/config/defaults.go
package config

// DefaultPoolDashboards is the built-in registry of well-known stratum
// pool hostname -> web dashboard URL template mappings, shipped with the
// binary -- extend this list in code (a new release) rather than asking
// every user to hand-edit their own settings.yml. A user can still
// add a mapping for a pool not listed here from /settings; see
// AppSettingsFile.Pools and mergePoolDashboards. Read-only: every caller
// only reads it or produces a fresh merged copy, never mutates it in
// place.
var DefaultPoolDashboards = map[string]string{
	"stratum.braiins.com": "https://pool.braiins.com/mining/overview/{user}",
	"solo.atlaspool.io":   "https://atlaspool.io/dashboard.html?wallet={user}",
}

// DefaultFirmwareRepos is the built-in GitHub "latest release" API URL per
// supported model, shipped with the binary. A user can override a single
// model's URL from /settings (e.g. to point at a fork/mirror); see
// AppSettingsFile.Firmware and mergeFirmwareRepos. Same read-only contract
// as DefaultPoolDashboards.
var DefaultFirmwareRepos = map[Model]string{
	ModelBitaxe:  "https://api.github.com/repos/bitaxeorg/esp-miner/releases/latest",
	ModelNerdaxe: "https://api.github.com/repos/shufps/ESP-Miner-NerdQAxePlus/releases/latest",
}

// mergePoolDashboards returns a fresh map: DefaultPoolDashboards overlaid
// by overrides (overrides win on hostname collision). Never mutates
// either input, so it's safe to call on every hot-reload tick -- an
// override that was since removed from settings.yml simply isn't in
// the result anymore, rather than lingering in a map mutated in place.
func mergePoolDashboards(overrides map[string]string) map[string]string {
	merged := make(map[string]string, len(DefaultPoolDashboards)+len(overrides))
	for host, url := range DefaultPoolDashboards {
		merged[host] = url
	}
	for host, url := range overrides {
		merged[host] = url
	}
	return merged
}

// mergeFirmwareRepos is the same idea as mergePoolDashboards, keyed by
// Model and flattened to the map[string]string shape Config.Firmware.Repos
// and internal/firmware already consume.
func mergeFirmwareRepos(overrides map[Model]string) map[string]string {
	merged := make(map[string]string, len(DefaultFirmwareRepos)+len(overrides))
	for model, url := range DefaultFirmwareRepos {
		merged[string(model)] = url
	}
	for model, url := range overrides {
		merged[string(model)] = url
	}
	return merged
}
