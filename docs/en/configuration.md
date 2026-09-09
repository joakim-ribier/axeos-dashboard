---
title: Configuration
nav_order: 5
group: Pages
lang: en
subnav:
  - title: Automatic detection
    anchor: automatic-detection
  - title: Configured miners
    anchor: configured-miners
  - title: Electricity & pools
    anchor: electricity-pools
  - title: Remote (hashboard.live)
    anchor: remote-hashboardlive
---

# Configuration

<div class="toc-grid">
  <a href="#automatic-detection" class="toc-card">
    <span class="toc-card-icon">🔍</span>
    <span class="toc-card-title">Automatic detection</span>
  </a>
  <a href="#configured-miners" class="toc-card">
    <span class="toc-card-icon">🖥️</span>
    <span class="toc-card-title">Configured miners</span>
  </a>
  <a href="#electricity-pools" class="toc-card">
    <span class="toc-card-icon">⚡</span>
    <span class="toc-card-title">Electricity & pools</span>
  </a>
  <a href="#remote-hashboardlive" class="toc-card">
    <span class="toc-card-icon">☁️</span>
    <span class="toc-card-title">Remote (hashboard.live)</span>
  </a>
</div>

## 🔍 Automatic detection
{: #automatic-detection }

Scans the local network for AxeOS miners (bitaxe, nerdaxe). A miner that
can't be found this way (different subnet, firewall...) can be added
directly by IP, right next to it.

![Automatic detection]({{ '/assets/images/settings-scan-before.png' | relative_url }})

Miners found appear below, ready to be added to the configuration.

![Detection results]({{ '/assets/images/settings-scan-results.png' | relative_url }})

---

## 🖥️ Configured miners
{: #configured-miners }

The list of already-configured miners, with their IP, MAC, model and
status — enable/disable in one click, per miner or all at once.

![Configured miners]({{ '/assets/images/settings-configured-miners.png' | relative_url }})

### Name and pools

Clicking a miner expands its editor: display name, and primary /
fallback pool (URL, port, user).

![Name and pools]({{ '/assets/images/settings-alias-pools.png' | relative_url }})

### Scheduler

Schedules a pool switch or a restart on a cron schedule.

![Scheduler]({{ '/assets/images/settings-schedule.png' | relative_url }})

---

## ⚡ Electricity & pools
{: #electricity-pools }

### Electricity

The electricity rate (€/kWh) is used to estimate the daily cost shown on
the home screen.

![Electricity]({{ '/assets/images/settings-electricity.png' | relative_url }})

### Pool dashboards

Some pools already have a clickable link built in (Braiins, Atlas...).
For a pool the app doesn't natively recognize, you can add your own
mapping between its hostname and its dashboard URL, with `{user}` as a
placeholder for the stratum user's account part — the link then becomes
clickable on miner cards using that pool.

![Pool dashboards]({{ '/assets/images/settings-pools.png' | relative_url }})

---

## ☁️ Remote (hashboard.live)
{: #remote-hashboardlive }

Sends your data to [hashboard.live](https://hashboard.live) so you can
check on your miners from anywhere, no VPN needed — just paste the push
URL and your API key.

![Remote (hashboard)]({{ '/assets/images/settings-remote.png' | relative_url }})
