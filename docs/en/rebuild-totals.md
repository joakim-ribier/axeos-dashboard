---
title: Scripts
nav_order: 7
group: Dev
lang: en
subnav:
  - title: rebuild-totals
    anchor: rebuild-totals
---

# Scripts

## rebuild-totals
{: #rebuild-totals }

Recomputes persistent totals (uptime and accumulated shares, which
survive miner reboots) from each miner's full history. Useful after an
installation issue (`totals.json` lost or corrupted), a data migration,
or to backfill existing history from before this feature was enabled.

[Go to Stats bar →]({{ '/en/dashboard.html#stats-bar' | relative_url }}){: .btn .btn-primary }

<div class="terminal-card">
  <div class="terminal-card-header">
    <span class="terminal-card-icon">&gt;_</span>
    <span class="terminal-card-title">Terminal</span>
  </div>
  <pre class="terminal-card-body"><span class="term-comment"># from the folder containing config/dashboard.yml</span>
<span class="term-command">$ curl -fsSLO https://github.com/joakim-ribier/axeos-dashboard/releases/download/latest/rebuild-totals-arm64</span>
<span class="term-command">$ chmod +x rebuild-totals-arm64</span>
<span class="term-command">$ ./rebuild-totals-arm64 -config config/dashboard.yml</span></pre>
</div>

<div class="terminal-card">
  <div class="terminal-card-header">
    <span class="terminal-card-icon">&gt;_</span>
    <span class="terminal-card-title">Result</span>
  </div>
  <pre class="terminal-card-body">rebuild-totals: DRY RUN -- nothing will be written
data dir: /home/pi/axeos-dashboard/storage/data/bitaxes
miners: 5

[G602-1 / aabbccddee01]
  files: 181, lines: 45273 (skipped: 1), reboots detected: 22
  history: 2026-01-09 17:29 -&gt; 2026-09-09 07:04
  total uptime: 179j 13h 44m, total shares: accepted=2153000 rejected=734
  scan time: 9.324s

[G602-2 / aabbccddee02]
  files: 174, lines: 44267 (skipped: 0), reboots detected: 22
  history: 2026-01-16 18:18 -&gt; 2026-09-09 07:04
  total uptime: 175j 7h 26m, total shares: accepted=1960176 rejected=807
  scan time: 7.92s

[G602-3 / aabbccddee03]
  files: 156, lines: 41773 (skipped: 1), reboots detected: 57
  history: 2026-02-04 12:04 -&gt; 2026-09-09 07:04
  total uptime: 155j 12h 43m, total shares: accepted=1103582 rejected=1070
  scan time: 7.647s

[G602-4 / aabbccddee04]
  files: 156, lines: 41769 (skipped: 2), reboots detected: 61
  history: 2026-02-04 12:04 -&gt; 2026-09-09 07:04
  total uptime: 155j 12h 21m, total shares: accepted=1099062 rejected=924
  scan time: 8.569s

[NerdqaxePlusPlus / aabbccddee05]
  files: 142, lines: 39913 (skipped: 2), reboots detected: 44
  history: 2026-04-21 14:22 -&gt; 2026-09-09 07:04
  total uptime: 142j 8h 15m, total shares: accepted=1869958 rejected=1318
  scan time: 7.661s

<span class="term-comment">==================== SUMMARY ====================
mode: DRY RUN -- nothing was written
miners: 5 processed, 0 skipped
lines replayed: 212995 (skipped: 6), reboots detected: 206
elapsed: 41.122s
(a real run over the same data should take about as long)</span></pre>
</div>

{: .note }
> 💡 **Tip** — replace `arm64` with `amd64` depending on your machine's
> architecture. No repo clone or Go install needed, the binary is ready
> to run.

- **Dry-run by default** — the command above only shows what it would
  do; add `-dry-run=false` to actually write.
- **One miner** — `-miner <mac|hostname|ip>` to only recompute a single
  miner.
- **Safe by design** — an existing `totals.json` is first copied to
  `totals.json.bak`; the write is atomic (never a half-written file);
  the `.jsonl`/`latest.json` files are never modified.
