package audit

import (
	"log/slog"
	"net/http"
	"slices"
	"strconv"

	"github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/config"
)

// The security-relevant changes a config save made through the dashboard
// can carry -- each its own type, so they can be searched for on their
// own, on top of the generic save_miners / save_settings entry the save
// itself gets.
const (
	TypeMinerPool     = "miner_pool"     // a pool's url/port/user changed (where the hashrate goes)
	TypeMinerSchedule = "miner_schedule" // a scheduled job added or removed
	TypeMinerIdentity = "miner_identity" // a configured miner's IP changed
	TypeMinerEnabled  = "miner_enabled"
	TypeMinerDisabled = "miner_disabled" // no longer polled nor scheduled
	TypeMinerAdded    = "miner_added"
	TypeRemotePush    = "remote_push" // where (and with which key) the data is pushed
)

// Change is one field's value before and after -- or, for a list (the
// scheduled jobs, the other devices, the pool dashboards), one item added
// (After) or removed (Before). Kind says which, so a reader never has to
// guess it from the field. Before and After are both left empty for a value
// that must never be written down (the remote push API key): the entry then
// only says it changed.
type Change struct {
	Field  string     `json:"field"`
	Kind   ChangeKind `json:"kind"`
	Before string     `json:"before,omitempty"`
	After  string     `json:"after,omitempty"`
}

type ChangeKind string

const (
	ChangeChanged ChangeKind = "changed"
	ChangeAdded   ChangeKind = "added"
	ChangeRemoved ChangeKind = "removed"
)

// poolChanges is the stratum slots that changed, under the names the UI
// labels them by.
func poolChanges(was, now config.Bitaxe) []Change {
	return compareFields([][3]string{
		{"url", was.Url, now.Url},
		{"port", portString(was.Port), portString(now.Port)},
		{"user", was.User, now.User},
		{"fallbackUrl", was.FallbackURL, now.FallbackURL},
		{"fallbackPort", portString(was.FallbackPort), portString(now.FallbackPort)},
		{"fallbackUser", was.FallbackUser, now.FallbackUser},
	})
}

func portString(port int) string {
	if port == 0 {
		return ""
	}
	return strconv.Itoa(port)
}

// compareFields is each {field, before, after} whose two values differ.
func compareFields(fields [][3]string) []Change {
	var changes []Change
	for _, f := range fields {
		if f[1] != f[2] {
			changes = append(changes, Change{Field: f[0], Kind: ChangeChanged, Before: f[1], After: f[2]})
		}
	}
	return changes
}

// MinerChanges is what a miners.yml save changed that matters for security
// -- one entry per miner and type, target the miner's IP. Miners are matched
// by MAC (the storage key): a save upserts, it never removes one.
func MinerChanges(before, after []config.Bitaxe) []Entry {
	previous := make(map[string]config.Bitaxe, len(before))
	for _, b := range before {
		previous[b.StorageKey()] = b
	}

	var entries []Entry
	for _, now := range after {
		was, existed := previous[now.StorageKey()]
		if !existed {
			// Where its hashrate goes and what it runs, from the start.
			changes := append(poolChanges(config.Bitaxe{}, now), scheduleChanges(nil, now.Schedule)...)
			entries = append(entries, Entry{Type: TypeMinerAdded, Target: now.Ip, Changes: changes})
			continue
		}
		if was.Ip != now.Ip {
			entries = append(entries, Entry{Type: TypeMinerIdentity, Target: now.Ip,
				Changes: []Change{{Field: "ip", Kind: ChangeChanged, Before: was.Ip, After: now.Ip}}})
		}
		if was.Enabled != now.Enabled {
			typ := TypeMinerDisabled
			if now.Enabled {
				typ = TypeMinerEnabled
			}
			entries = append(entries, Entry{Type: typ, Target: now.Ip})
		}
		if changes := poolChanges(was, now); changes != nil {
			entries = append(entries, Entry{Type: TypeMinerPool, Target: now.Ip, Changes: changes})
		}
		if changes := scheduleChanges(was.Schedule, now.Schedule); changes != nil {
			entries = append(entries, Entry{Type: TypeMinerSchedule, Target: now.Ip, Changes: changes})
		}
		// What isn't sensitive still says what it was, under the save's own
		// type.
		if changes := minerDetails(was, now); changes != nil {
			entries = append(entries, Entry{Type: TypeSaveMiners, Target: now.Ip, Changes: changes})
		}
	}
	return entries
}

// scheduleChanges is each job removed (Before) and added (After) -- a job
// is never edited in place, it's one or the other. A job is its cron
// expression and action, e.g. "0 0 2 * * * switch_fallback".
func scheduleChanges(before, after []config.CronSchedule) []Change {
	return listChanges(mapList(before, job), mapList(after, job), "scheduleAdded", "scheduleRemoved")
}

// minerDetails is a miner's non-sensitive fields that changed.
func minerDetails(was, now config.Bitaxe) []Change {
	return compareFields([][3]string{
		{"alias", was.Alias, now.Alias},
		{"hostname", was.Hostname, now.Hostname},
		{"model", string(was.Model), string(now.Model)},
	})
}

// listChanges is each item removed from before (Before) and added in after
// (After), duplicates counted -- for lists whose items are added or
// removed, never edited: a changed item is one removed and one added.
func listChanges(before, after []string, addedField, removedField string) []Change {
	unmatched := make(map[string]int, len(before))
	for _, item := range before {
		unmatched[item]++
	}
	var added []Change
	for _, item := range after {
		if unmatched[item] > 0 {
			unmatched[item]--
			continue
		}
		added = append(added, Change{Field: addedField, Kind: ChangeAdded, After: item})
	}
	var changes []Change
	for _, item := range before {
		if unmatched[item] > 0 {
			unmatched[item]--
			changes = append(changes, Change{Field: removedField, Kind: ChangeRemoved, Before: item})
		}
	}
	return append(changes, added...)
}

func mapList[T any](items []T, f func(T) string) []string {
	out := make([]string, len(items))
	for i, item := range items {
		out[i] = f(item)
	}
	return out
}

func job(j config.CronSchedule) string {
	return j.Cron + " " + string(j.Action)
}

// SettingsChanges is what a settings.yml save changed: where the data is
// pushed to and with which key (remote_push, the key itself never written
// down), and the rest under the save's own type -- the electricity rate,
// the other devices, the custom pool dashboards and firmware repos.
func SettingsChanges(before, after config.AppSettingsFile) []Entry {
	var entries []Entry

	var remote []Change
	if before.Remote.PushURL != after.Remote.PushURL {
		remote = append(remote, Change{Field: "pushURL", Kind: ChangeChanged, Before: before.Remote.PushURL, After: after.Remote.PushURL})
	}
	if before.Remote.APIKey != after.Remote.APIKey {
		remote = append(remote, Change{Field: "apiKey", Kind: ChangeChanged})
	}
	if remote != nil {
		entries = append(entries, Entry{Type: TypeRemotePush, Changes: remote})
	}

	var details []Change
	if b, a := before.Electricity.RatePerKwh, after.Electricity.RatePerKwh; b != a {
		details = append(details, Change{Field: "ratePerKwh", Kind: ChangeChanged, Before: number(b), After: number(a)})
	}
	details = append(details, listChanges(
		mapList(before.Electricity.Devices, device), mapList(after.Electricity.Devices, device),
		"deviceAdded", "deviceRemoved")...)
	details = append(details, listChanges(
		dashboards(before.Pools.Dashboards), dashboards(after.Pools.Dashboards),
		"poolDashboardAdded", "poolDashboardRemoved")...)
	details = append(details, listChanges(
		repos(before.Firmware.Repos), repos(after.Firmware.Repos),
		"firmwareRepoAdded", "firmwareRepoRemoved")...)
	if details != nil {
		entries = append(entries, Entry{Type: TypeSaveSettings, Changes: details})
	}
	return entries
}

func number(v float64) string {
	return strconv.FormatFloat(v, 'f', -1, 64)
}

func device(d config.PowerDevice) string {
	return d.Name + " (" + number(d.Power) + " W)"
}

// dashboards lists a pool-dashboards map as "host: url", sorted so the
// comparison doesn't depend on map order.
func dashboards(m map[string]string) []string {
	out := make([]string, 0, len(m))
	for host, url := range m {
		out = append(out, host+": "+url)
	}
	slices.Sort(out)
	return out
}

// repos lists a firmware-repos map as "model: url", sorted like dashboards.
func repos(m map[config.Model]string) []string {
	out := make([]string, 0, len(m))
	for model, url := range m {
		out = append(out, string(model)+": "+url)
	}
	slices.Sort(out)
	return out
}

// RecordChanges records entries (from MinerChanges/SettingsChanges) as made
// through r, once its save succeeded: client IP, User-Agent and request ID
// filled in, as for any API entry. They then stand in for the route's generic save_miners /
// save_settings entry, which would only repeat the same save -- that one is
// left for a failed save. A save that changed nothing records nothing.
func (l *Log) RecordChanges(r *http.Request, entries []Entry, logger *slog.Logger) {
	recorded := len(entries) == 0
	for _, e := range entries {
		entry := requestEntry(e.Type, r)
		entry.Target, entry.Changes = e.Target, e.Changes
		// Only ever called once the save succeeded.
		entry.Status = http.StatusOK
		if err := l.Record(entry); err != nil {
			logger.Error("failed to record audit entry", "type", e.Type, "error", err)
			continue
		}
		recorded = true
	}
	// Changes made but none written: the route's generic entry is still the
	// save's only trace, so it's left to the middleware.
	if detailed, ok := r.Context().Value(detailedKey{}).(*bool); ok && recorded {
		*detailed = true
	}
}
