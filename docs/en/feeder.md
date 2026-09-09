---
title: Feeder
nav_order: 8
group: Dev
lang: en
subnav:
  - title: Firmware
    anchor: firmware-update-detection
---

# Feeder

## Firmware update detection
{: #firmware-update-detection }

The feeder checks GitHub for the latest release once per
`firmware.cacheTTL` (24h by default) and per miner model present in the
configuration. The result is cached in
`{dataDir}/data/firmware_cache.json`.

Each miner in the API response includes:

```json
{
  "version": "v2.4.0",
  "latestVersion": "v2.5.1",
  "updateAvailable": true
}
```

`updateAvailable` is `false` on the very first startup (before the
feeder has completed a cycle) or when the firmware is already up to
date — this is what triggers the orange update badge on a miner card.

[Go to Miner card →]({{ '/en/dashboard.html#miner-card' | relative_url }}){: .btn .btn-primary }
