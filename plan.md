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

## To do

- **Daily alerts email**: send an email each evening summarizing the
  day's alerts.
- **Fine-grained local/remote UI config**: let `dashboard.yml` control
  which parts of the UI are shown per mode (e.g. expose the Settings page
  but only its "remote" sub-section, hiding auto device detection) instead
  of the current all-or-nothing local/remote split. Next task up.
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
