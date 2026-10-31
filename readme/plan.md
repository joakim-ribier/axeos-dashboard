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
- ✅ **Remote-usable Settings page** *(since replaced: a board now shows
  its miners' stats only, see below)*: the feeder now also pushes the
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
- ✅ **Per-miner display alias**: optional `alias` in `miners.yml`
  overrides the hostname shown everywhere in the UI, without ever being
  overwritten by a network re-scan the way hostname itself would be —
  pushed through to remote-dashboard-api too.
- ✅ **Per-miner pool config editor + config/live drift detection**: edit a
  miner's primary/fallback pool (URL/port/user) straight from its row on
  `/settings`, with a warning (banner, row badge, and page-top summary)
  whenever the saved config disagrees with what the miner is actually
  reporting.
- ✅ **Dashboard redesign around the fleet**: a 24 h fleet summary, the
  miners as a dense list or tiles with their problems first, and a detail
  panel per miner replace the old cards.
- ✅ **Page title in a sticky top bar**: every page's title now sits in a
  top bar that stays on screen, with a compact layout on a phone.
- ✅ **Audit log**: every restart, pool switch, config save, audit export,
  backups download and network scan -- from the dashboard (with the
  client's IP, browser and request parameters) or by the scheduler -- is
  recorded, success or failure; a config save says what it changed (its
  own searchable type, before → after, for a pool, a scheduled job, an IP,
  enable/disable, an added miner or the remote push; the rest under the
  save's type), one entry per fact, and browsable on a new `/audit` page
  (last 24 h by default, filters by miner/type/day, copy an entry, JSON
  export). Alerts and Audit now share one filter bar with removable
  chips.
- ✅ **Monthly backups**: each completed day of the miners' history goes
  into its month's zip archive, frozen by its MD5 once the month is over,
  listed and downloadable from a Backups page.
- ✅ **Firmware quick filter**: the home screen filters the miners by
  firmware version, with a count per version.
- ✅ **Other power devices**: non-miner consumers (fan, router...) declared
  in Settings count in the installation's estimated daily cost.
- ✅ **One Configuration page**: its sections (Miners, Electricity,
  Notifications, Remote, System) picked from a menu that flags the ones to
  look at.
- ✅ **Foldable sidebar**: on a desktop the sidebar folds into an icon rail,
  the app's icon on top.
- ✅ **Mails from a dedicated mailer service**: SMTP set up in
  Configuration › Notifications with a test mail, the audit report sent at
  night at the chosen frequency, and the mails' wording in editable
  templates.
- ✅ **Platform status**: a sidebar card says whether each service
  (dashboard-api, feeder, health check, mailer, firmware cache) is running.
- ✅ **Local dashboard linked to its board**: the menu and the home screen
  show the hashboard board this instance pushes to.
- ✅ **A board shows its miners' stats only**: the feeder pushes readings,
  totals and offline polls, nothing of the configuration, and a board is
  the fleet's home page alone.
- ✅ **Personal data kept off hashboard**: the Wi-Fi name and IPv6 always,
  and the pools' user, the pools and the miners' IPs unless shared from
  Configuration › Remote, are masked before every push.
- ✅ **Icon pack**: one set of icons in `brand/` for the app, the docs site
  and hashboard.live.
- ✅ **Alerts by mail**: one HTML mail (editable template, logo, text
  version) per feeder poll that raises alerts, sent by the mailer when
  turned on in Configuration › Notifications.
- ✅ **Audit report in HTML**: the same layout as the alerts mail, a card
  per event grouped by type, the test mail staying plain text.
- ✅ **Alerts on a change of state**: an alert is recorded once when it
  starts and once when it ends (hysteresis on temperature and fan, offline
  after 2 missed polls), the ones in progress stay on top of the Alerts
  page with their current reading and a sidebar badge, and the bell's
  "read" is shared by every device.

## To do

### Alerts

- **Pool drift alert**: warn (bell, Alerts page) when a miner's live
  pools stop matching `miners.yml` -- e.g. a pool or user changed straight
  in its own AxeOS UI. An alert, not an audit entry: the audit only traces
  what was done through the dashboard. Same rule as the Settings page's
  drift badge (`poolMismatches`): a non-Bitaxe running its configured
  pools swapped is a switch, not a drift.

### Audit

- **"Security" menu group**: once a second security feature exists (e.g.
  the new-IP alert below), group it with `/audit` under a "Security"
  section of the sidebar. A group holding only Audit isn't worth it.
- **New-IP security email**: when an API action comes from an IP never
  seen before (kept in a known-IPs list), send an email along the lines of
  "we detected a new IP address, was it you?" -- through the mailer.

### Settings

- **Same "saved" confirmation for every save**: the snackbar shows after
  saving discovered miners, "disable all" and every App settings section,
  but not after a miner's own edits -- alias (`AliasEditor`), pools
  (`PoolEditor`, only its button spinner), schedule add/remove
  (`ScheduleEditor`), or the enable/disable toggle. Every successful save
  should confirm the same way.
- **Assisted cron builder in the scheduler editor**: `ScheduleEditor`
  today only accepts a raw 6-field cron string (seconds included), typed
  by hand -- easy to get subtly wrong (e.g. `* */5 * * * *`, which fires
  every second for the whole minute, instead of `0 */5 * * * *`, which
  fires once). A small guided UI on top of the existing free-text field --
  presets like "every N minutes/hours" or "at a specific time on selected
  weekdays" that generate the cron string for you -- would remove that
  failure mode while still allowing the raw expression for advanced cases.

### Notifications

- **The audit report triggered from outside the mailer**: the mailer still
  plans it itself (checks every minute whether it's due, reads the audit
  on disk, retries hourly). Like the alerts mail, the trigger should come
  from elsewhere -- e.g. a nightly job in dashboard-api's scheduler working
  out the period and calling the mailer -- so the mailer only builds and
  sends mails.

### Release

- **Deploy the Pi from releases only**: CI builds a `staging` prerelease
  on every push to `staging`, the release ships its own start script, and
  `make deploy` goes away.
- **Cut a 1.0**: first stable tagged release.

## Known bugs

None at the moment.

## Cross-cutting guardrails

- Scan/probe is always manually triggered, never run in the background.
- YAML writes only ever target the managed files (`miners.yml`,
  `settings.yml`), never `dashboard.yml`.
- `remote-dashboard-api` is read-only: it never accepts a write.
- `remote.pushURL`/`apiKey` are never included in what the feeder pushes
  to hashboard, under any circumstance.
- What's personal (Wi-Fi name, IPv6, and the pools' user, the pools and
  the IPs unless shared) is masked before every push, never after.
