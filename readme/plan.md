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
- ✅ **Remote-usable Settings page**: the feeder now also pushes the
  managed miners list and app settings (electricity, custom pool
  dashboards, firmware repos -- `remote.pushURL`/`apiKey` themselves are
  never sent) every poll cycle, alongside its existing data push;
  `remote-dashboard-api` gains matching `GET /api/{boardId}/config/miners`
  and `.../config/settings` routes reading that pushed data (hashboard
  stores it verbatim via new `POST /api/push/config/miners`/`config/settings`
  handlers), so the exact same React `/settings` components render for a
  remote board. `remote-dashboard.yml` flips `ui.page.settings` from
  `hidden` to `readonly`: unlike per-miner restart/pool-switch buttons
  elsewhere (disabled-but-visible), readonly here removes every write
  affordance entirely rather than showing it inert -- no Save buttons, no
  pool-add form, no scheduler add/remove controls (just the currently
  configured cron entries), no network scan or add-by-IP. The pushed
  settings also carry `firmwareCacheCheckedAt`, so the "Process settings"
  table doubles as an at-a-glance "is the source Pi's feeder still alive"
  signal on a remote board, not just blank rows.

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
- `remote-dashboard-api`'s `/api/{boardId}/config/*` routes are read-only --
  they never accept a write, regardless of `ui.page.settings`.
- `remote.pushURL`/`apiKey` are never included in what the feeder pushes
  to hashboard, under any circumstance.
