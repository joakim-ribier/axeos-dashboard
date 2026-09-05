#!/bin/bash
# Bootstraps axeos-dashboard via Docker on any machine with Docker + the
# compose plugin already installed -- no git clone, no Go/Node toolchain.
# Installs into ./axeos-dashboard, relative to wherever you run this from
# (cd somewhere first if you want it elsewhere -- /tmp, a data drive, ...).
# Safe to re-run: it never overwrites an existing config/dashboard.yml, and
# re-running it later is how you update (docker compose pull grabs the
# newer "latest" image).
set -e

mkdir -p axeos-dashboard && cd axeos-dashboard
curl -O https://raw.githubusercontent.com/joakim-ribier/axeos-dashboard/main/docker-compose.yml
if [ ! -f config/dashboard.yml ]; then
  curl --create-dirs -o config/dashboard.yml https://raw.githubusercontent.com/joakim-ribier/axeos-dashboard/main/docker/dashboard.yml.example
fi
if [ ! -f .env ]; then
  echo "HTTP_PORT=80" > .env
fi
docker compose pull
docker compose up -d

echo ">>> Done. Open http://<this-machine-ip>/ from any device on your LAN."
