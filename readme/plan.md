# Plan — axeos-dashboard

Running log: ideas, in-progress features, and bugs to fix. Updated at
every commit.

## Table of contents

- [Done](#done)
- [To do](#to-do)
- [Known bugs](#known-bugs)
- [Cross-cutting guardrails](#cross-cutting-guardrails)

## Done

- ✅ **Auto miner detection + config via the UI**: network scan or
  add-by-IP to find AxeOS devices on the LAN, `/settings` page to select
  and save them into the managed miners config, hot-reloaded by the
  feeder and dashboard-api with no restart and no `-miners` flag
  required.
- ✅ **Config-driven UI visibility**: new `ui:` block in
  `dashboard.yml`/`remote-dashboard.yml` (`config.UIConfig`, exposed via
  `GET /api/info`) with a 3-state `enabled`/`readonly`/`hidden` per
  page/action, defaulting to fully shown — one React codebase instead of
  hardcoding local/remote differences. `ui.page.settings` gates the
  `/settings` route+nav item, `ui.action.minerRestart`/`minerPoolSwitch`
  gate the per-miner action buttons. `remote-dashboard.yml` sets all three
  to `hidden` to keep today's behavior unchanged.
- ✅ **Per-miner scheduler in Settings**: expand a configured miner's row
  to add/remove cron-based jobs, with a live human-readable preview and
  next-run times — no more hand-editing `schedule` in `miners.yml`. Takes
  effect on dashboard-api immediately (the scheduler hot-reloads from the
  same managed miners store as the rest of Settings), no restart needed.
- ✅ **Restart action on the scheduler**: a scheduled job's `action` is
  `switch_primary`, `switch_fallback`, or `restart`, all handled by the
  same single `internal/scheduler` package and the same `ScheduleEditor`
  UI (one cron-job mechanism, one action dispatch, rather than a separate
  scheduler per action) -- adding a future action means one more `case`,
  not a new package.
- ✅ **Rest of user-level config editable from the UI**: electricity rate,
  custom pool dashboards, and remote (hashboard) push credentials now live
  in a new managed `settings.yml`, editable from a new "App settings"
  section on `/settings` — no more hand-editing `dashboard.yml` +
  restarting both binaries for these. Each section saves itself
  immediately (its own Save button for electricity/remote, instant save on
  adding/removing a pool) rather than one global Save, and always sends
  the server's own last-known state for every other section so an
  unconfirmed edit sitting in one field can never block or leak into
  another section's save. Well-known pool dashboard links and firmware
  repo URLs are built into the binary
  (`server/internal/config/defaults.go`) rather than duplicated per
  deployment, so fixing/adding one is a code change + `latest-up`;
  `settings.yml` only stores custom pool extras on top of that built-in
  list (firmware repos are shown read-only, not overridable from this UI
  at all). Launch-time settings that genuinely need a restart
  (`feeder.interval`, `healthCheck.interval`, `firmware.cacheTTL`) are
  shown read-only too, each next to an at-a-glance last-run indicator
  (derived from already-loaded miner data, color-coded stale/fresh) so a
  stuck feeder or health-check loop is visible without digging through
  logs.

## To do

### Alerts

- **Episode detail on click**: clicking an episode row on `/alerts` should
  expand it into the individual alert occurrences it groups — today an
  episode only shows `firstSeen`/`lastSeen`/`occurrences`/peak, with no way
  to see the actual occurrences that make it up. Listing them would make
  the frequency of the underlying condition visible (e.g. a fan alert that
  flapped ten times in an hour vs. one that just stayed up continuously).
- **Daily alerts email**: send an email each evening summarizing the
  day's alerts.
- **Alerts page filters are poorly designed**: `Alerts.tsx` calls
  `useMiners()` (`/api/miners`) only to populate the IP filter's
  dropdown — architecturally unrelated. On this page, **day** is the only
  real query (hits the server via
  `/api/miners/alerts/history?date=...`); the **IP** and **Type** filters
  are just applied to the response already received for that day, so they
  should be derived from `data.episodes` (which already carries
  `minerIp`/`hostname`/`type` per episode) instead of a separate call to
  the miners list. Extra benefit of dropping the `useMiners()` dependency:
  the IP filter would no longer offer miners with no alert that day
  (options that today filter nothing once selected).

### Settings

- **Remote-usable content on the Settings page**: the config-driven
  visibility mechanism exists (see Done), and app settings are now
  editable from `/settings` (see Done), but `/settings` still has nothing
  a remote viewer could use yet — everything there today (discovery, the
  managed miners config including the scheduler, and the new app
  settings section) writes to the local dashboard-api's own managed files,
  which doesn't apply to a remote board; today, if reached anyway (nothing
  currently blocks on `readonly`, only on `hidden` -- see
  `RequireSettingsEnabled`), each section fails differently against
  `remote-dashboard-api`'s missing `/api/config/*` routes: the miners
  table + scheduler silently vanish (their hook's `error` is never
  read), the app settings form renders fully but blank (same gap), and
  only the discovery/scan section surfaces a (generic) error. Direction
  agreed: the feeder pushes the miners/settings config (not just live
  stats) to the remote board alongside its existing data push --
  `remote.apiKey`/`pushURL` themselves excluded from what's pushed/exposed,
  since leaking that back out over a read-only remote view would be a real
  secret exposure -- and `remote-dashboard-api` grows the same
  `GET /api/config/*` routes reading from that pushed data, so the exact
  same React components render either side with no remote-specific
  branching. `readonly` then becomes a real third state (today identical
  to `enabled` in the actual code): page renders, every write affordance
  (Save buttons, Add/remove, discovery, enable/disable, restart/switch
  pool) disabled, not hidden. At that point `remote-dashboard.yml` flips
  `ui.page.settings` from `hidden` to `readonly`.
- **Assisted cron builder in the scheduler editor**: `ScheduleEditor`
  today only accepts a raw 6-field cron string (seconds included), typed
  by hand -- easy to get subtly wrong (e.g. `* */5 * * * *`, which fires
  every second for the whole minute, instead of `0 */5 * * * *`, which
  fires once). A small guided UI on top of the existing free-text field --
  presets like "every N minutes/hours" or "at a specific time on selected
  weekdays" that generate the cron string for you -- would remove that
  failure mode while still allowing the raw expression for advanced cases.

## Known bugs

None open right now.

## Cross-cutting guardrails

- Scan/probe is always manually triggered, never run in the background.
- YAML writes only ever target the managed miners file, never
  `dashboard.yml`.
- No `/api/config/*` route on `remote-dashboard-api`.
