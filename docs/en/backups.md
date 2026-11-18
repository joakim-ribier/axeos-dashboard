---
title: Backups
nav_order: 6
group: Pages
lang: en
subnav:
  - title: The page
    anchor: page
  - title: Restore
    anchor: restore
---

{% include page_nav.html position="top" %}

<div class="toc-grid">
  <a href="#page" class="toc-card">
    <span class="toc-card-icon">📋</span>
    <span class="toc-card-text">
      <span class="toc-card-title">The page</span>
      <span class="toc-card-sub">One zip per month, to download</span>
    </span>
  </a>
  <a href="#restore" class="toc-card">
    <span class="toc-card-icon">♻️</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Restore</span>
      <span class="toc-card-sub">Put a month back on disk</span>
    </span>
  </a>
</div>

Your miners' history, archived automatically: one zip per month.

## 📋 The page
{: #page }

![Backups page]({{ '/assets/images/backups.png' | relative_url }}){: width="701" }

1. Download — the months ticked, in a single zip; their total size shows
   next to it.
2. Tick all — the months of the year shown. The selection stays from one
   year to the next.
3. In progress — the current month, added to every night with the day
   before.
4. A month — downloads its archive.
5. Year — one year at a time, the current one by default.

Every night, within the hour after midnight UTC, the day before joins its
month's archive. On the 1st of the next month, the archive is complete: it no
longer changes, and its checksum (MD5) shows. On the first start, all the
history already on disk is archived; after the feeder was stopped, the
missing days are caught up.

---

## ♻️ Restore
{: #restore }

An archive holds your miners' folders, one file per day. Unzip it into the
data folder; `-n` keeps the files already there:

<div class="terminal-card">
  <div class="terminal-card-header">
    <span class="terminal-card-icon">&gt;_</span>
    <span class="terminal-card-title">Terminal</span>
  </div>
  <pre class="terminal-card-body"><span class="term-command">$ unzip -n axeos-backup-2026-09.zip -d ./storage</span></pre>
</div>

Then rebuild the totals.
[Scripts › rebuild-totals]({{ '/en/rebuild-totals.html#rebuild-totals' | relative_url }}){: .link-page }

{% include page_nav.html position="bottom" %}
