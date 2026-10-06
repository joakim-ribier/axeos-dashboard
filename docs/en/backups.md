---
title: Backups
nav_order: 6
group: Pages
lang: en
subnav:
  - title: Archive contents
    anchor: contents
  - title: Restore
    anchor: restore
  - title: Hide the page
    anchor: hide
---

# Backups

<div class="toc-grid">
  <a href="#contents" class="toc-card">
    <span class="toc-card-icon">📦</span>
    <span class="toc-card-title">Archive contents</span>
  </a>
  <a href="#restore" class="toc-card">
    <span class="toc-card-icon">♻️</span>
    <span class="toc-card-title">Restore</span>
  </a>
  <a href="#hide" class="toc-card">
    <span class="toc-card-icon">🙈</span>
    <span class="toc-card-title">Hide the page</span>
  </a>
</div>

The miners' history, archived automatically by the feeder, one zip
archive per month. Available from the sidebar, right below
Configuration.

![Backups page]({{ '/assets/images/backups.png' | relative_url }})

Every night, the previous day is added to its month's archive, within
the hour after midnight UTC. The current month is flagged **in
progress** and so holds everything up to yesterday. On the 1st of the
next month, its archive is complete and becomes final: it will never be
modified again, and its checksum (MD5) shows in the table.

On first startup, all the history already on disk is archived, month by
month. If the feeder was stopped for a few days, the missing days are
caught up when it restarts.

- **One month** — the icon at the end of the row downloads its archive.
- **Several months** — tick them, then **Download**: a single zip
  bundling them, with their approximate total size shown next to the
  button. The selection is kept from one year to another.
- **By year** — the table footer shows one year at a time, the current
  year by default; the arrows move to previous years.

---

## 📦 Archive contents
{: #contents }

Each miner's `.jsonl` files for the month, laid out as in the data
directory:

```
axeos-backup-2026-09.zip
└── data/bitaxes/
    ├── aabbccddee01/
    │   ├── 2026-09-01.jsonl
    │   ├── 2026-09-02.jsonl
    │   └── ...
    └── aabbccddee02/
        └── ...
```

A multi-month download has exactly the same shape, with the days of
every selected month.

Archives are stored in `{dataDir}/data/backups/`
(`./storage/data/backups/` with Docker), along with `checksums.md5`, the
MD5 of each final archive. To check them from that directory:

<div class="terminal-card">
  <div class="terminal-card-header">
    <span class="terminal-card-icon">&gt;_</span>
    <span class="terminal-card-title">Terminal</span>
  </div>
  <pre class="terminal-card-body"><span class="term-command">$ md5sum -c checksums.md5</span></pre>
</div>

---

## ♻️ Restore
{: #restore }

Unzip the archive into the dashboard's `dataDir` — `-n` keeps files
already there instead of overwriting them:

<div class="terminal-card">
  <div class="terminal-card-header">
    <span class="terminal-card-icon">&gt;_</span>
    <span class="terminal-card-title">Terminal</span>
  </div>
  <pre class="terminal-card-body"><span class="term-command">$ unzip -n axeos-backup-2026-09.zip -d ./storage</span></pre>
</div>

Then rebuild the totals with
[rebuild-totals]({{ '/en/rebuild-totals.html#rebuild-totals' | relative_url }}).

---

## 🙈 Hide the page
{: #hide }

The page and its sidebar entry can be hidden from `dashboard.yml`
(dashboard restart required). The feeder keeps archiving every night.

```yaml
ui:
  page:
    backups: hidden   # enabled (default) | hidden
```
