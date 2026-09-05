#!/bin/bash
# Bootstraps axeos-dashboard via Docker on any machine with Docker + the
# compose plugin already installed -- no git clone, no Go/Node toolchain.
# Installs into ./axeos-dashboard, relative to wherever you run this from
# (cd somewhere first if you want it elsewhere -- /tmp, a data drive, ...).
# Safe to re-run: it never overwrites an existing config/dashboard.yml, and
# re-running it later is how you update (docker compose pull grabs the
# newer "latest" image).
#
# Pass IMAGE_TAG to pin a specific build instead of "latest" -- e.g. to
# test a PR's images (tagged sha-<short-sha>, built when the
# "test-integration" label is added to it):
#   curl -fsSL .../docker-install.sh | IMAGE_TAG=sha-3e09149 bash
set -e

mkdir -p axeos-dashboard && cd axeos-dashboard
curl -fO https://raw.githubusercontent.com/joakim-ribier/axeos-dashboard/main/docker-compose.yml
if [ ! -f config/dashboard.yml ]; then
  curl -f --create-dirs -o config/dashboard.yml https://raw.githubusercontent.com/joakim-ribier/axeos-dashboard/main/docker/dashboard.yml.example
fi
if [ ! -f .env ]; then
  echo "HTTP_PORT=80" > .env
fi
if [ -n "${IMAGE_TAG:-}" ]; then
  sed -i.bak "/^IMAGE_TAG=/d" .env && rm -f .env.bak
  echo "IMAGE_TAG=$IMAGE_TAG" >> .env
fi
docker compose pull
docker compose up -d

echo ">>> Done. Open http://<this-machine-ip>/ from any device on your LAN."
