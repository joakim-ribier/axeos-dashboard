# Deployment (Docker)

Step-by-step guide for running axeos-dashboard as a long-lived service on
your LAN via Docker -- any machine with Docker installed works (Linux,
Windows, macOS, a NAS...), it doesn't have to be the Raspberry Pi the rest
of this project is designed around.

See the main [README](../README.md) for architecture, features, and the full
config reference -- this doc only covers getting a fresh machine running.

## Docker

The stack (feeder + dashboard-api + the UI behind nginx) ships as 2
prebuilt images (multi-arch: `linux/amd64` + `linux/arm64`), built by CI on
every push to `main` and published to `ghcr.io/joakim-ribier/axeos-dashboard`.

```bash
curl -fsSL https://raw.githubusercontent.com/joakim-ribier/axeos-dashboard/main/docker-install.sh | bash
```

That's the whole install: it creates `./axeos-dashboard/` in whatever
directory you ran it from (`cd` somewhere first if you want it elsewhere),
fetches `docker-compose.yml` + a `dashboard.yml` config template, pins
nginx to port `80`, then pulls and starts both images. Safe to re-run
later -- it never overwrites an existing `config/dashboard.yml` or `.env`,
and re-running it is how you update to whatever `docker compose pull`
finds under the `latest` tag.

Open `http://<host-ip>/` from any device on your LAN once it's done.
`config/` and `data/` are bind-mounted host folders -- your configuration
and everything the feeder writes persist on disk across restarts and
updates.

`docker-compose.yml` publishes nginx on a random free port by default (so
nobody hits a conflict just running it) -- `docker-install.sh` pins it to
the memorable `80` instead by writing `HTTP_PORT=80` to `.env`. Delete
`.env` if you don't mind an unpredictable port instead; check which one
got picked with `docker compose ps`.

Nothing else to do to survive reboots: `docker-compose.yml` sets
`restart: unless-stopped` on both containers, so they come back up
whenever the Docker daemon does (on Linux servers, that's on boot by
default; on Docker Desktop, whenever it's next started).

**Updating** to a newer release, from that same directory:

```bash
docker compose pull && docker compose up -d
```

**Logs**: `docker compose logs app` / `docker compose logs nginx` follow
each container's stdout -- no file-based logging or logrotate setup needed
on the host.

### Building the images yourself (advanced)

Useful for testing a local change before it's merged/released:

```bash
git clone https://github.com/joakim-ribier/axeos-dashboard.git
cd axeos-dashboard
mkdir -p config && cp docker/dashboard.yml.example config/dashboard.yml
make docker-build   # docker compose build, with the real git SHA baked in
docker compose up -d
docker compose ps   # see which random port nginx landed on
```

`docker-compose.yml`'s two services:

| Service | Role |
|---|---|
| `app` | Runs `feeder` + `dashboard-api` in the same container (`docker/services.Dockerfile`) -- they're always deployed as a pair, and if either process dies the whole container exits so Docker's restart policy relaunches both together |
| `nginx` | Serves the built UI (`ui/dist`) and reverse-proxies `/api/` to `app:8080`, the only port published on the LAN (`docker/dashboard.Dockerfile`) |
