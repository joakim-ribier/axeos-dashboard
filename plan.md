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

## To do

- **Daily alerts email**: send an email each evening summarizing the
  day's alerts.
- **Remote-usable content on the Settings page**: the config-driven
  visibility mechanism exists (see Done), but `/settings` still has
  nothing a remote viewer could use yet (discovery + `miners.yml` editing
  are inherently local-only) — `ui.page.settings` is `readonly`-capable
  but unused until the pool scheduler and user-config sections below
  land, at which point `remote-dashboard.yml` flips from `hidden` to
  `readonly` and Settings.tsx renders only what applies.
- **Per-miner pool scheduler in Settings**: let the cron-based pool
  schedule (`poolSchedule`) be configured from the `/settings` page
  instead of hand-editing the managed miners config.
- **Rest of user-level config editable from the UI**: settings tied to
  the user/deployment rather than a specific miner, e.g. `electricity`
  (rate per kWh) and `pool.dashboards` — currently only hand-edited in
  `dashboard.yml`.
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

## Known bugs

None open right now.

## Cross-cutting guardrails

- Scan/probe is always manually triggered, never run in the background.
- YAML writes only ever target the managed miners file, never
  `dashboard.yml`.
- No `/api/config/*` route on `remote-dashboard-api`.
