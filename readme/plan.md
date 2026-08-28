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
- ✅ **Per-miner pool scheduler in Settings**: expand a configured miner's
  row to add/remove cron-based pool switches, with a live human-readable
  preview and next-run times — no more hand-editing `poolSchedule` in
  `miners.yml`. Takes effect on dashboard-api immediately (the scheduler
  now hot-reloads from the same managed miners store as the rest of
  Settings), no restart needed.

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
  visibility mechanism exists (see Done), but `/settings` still has
  nothing a remote viewer could use yet (discovery + the managed miners
  config, including the pool scheduler, are inherently local-only) —
  `ui.page.settings` is `readonly`-capable but unused until the
  user-config section below lands, at which point `remote-dashboard.yml`
  flips from `hidden` to `readonly` and Settings.tsx renders only what
  applies.
- **Rest of user-level config editable from the UI**: settings tied to
  the user/deployment rather than a specific miner, e.g. `electricity`
  (rate per kWh) and `pool.dashboards` — currently only hand-edited in
  `dashboard.yml`.
- **Configurable auto-restart of a miner via a cron**: let a miner be
  restarted on its own schedule (independent of the pool scheduler),
  same cron-based mechanism.

## Known bugs

None open right now.

## Cross-cutting guardrails

- Scan/probe is always manually triggered, never run in the background.
- YAML writes only ever target the managed miners file, never
  `dashboard.yml`.
- No `/api/config/*` route on `remote-dashboard-api`.
