---
title: Feeder
nav_order: 9
group: Dev
lang: en
subnav:
  - title: Firmware
    anchor: firmware-update-detection
  - title: Backups
    anchor: backups
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
date — this is what shows the newer version available in the miner list
and in a miner's details.

[Go to The miner list →]({{ '/en/dashboard.html#list' | relative_url }}){: .btn .btn-primary }

## Monthly backups
{: #backups }

Every hour, the feeder adds each completed (UTC) day not yet archived to
its month's archive, `{dataDir}/data/backups/YYYY-MM.zip` — in
practice, the previous day, right after midnight UTC. Days already
archived are copied over as-is without being recompressed, and the
archive is only replaced once fully written. Once a month is over, its
archive's MD5 is recorded in `checksums.md5`: the archive is then final
and never opened again. All of this runs alongside polling, without ever
delaying it.

[Go to Backups →]({{ '/en/backups.html' | relative_url }}){: .btn .btn-primary }
