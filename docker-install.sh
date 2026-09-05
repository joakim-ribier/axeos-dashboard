#!/bin/bash
# Bootstraps axeos-dashboard via Docker on any machine with Docker + the
# compose plugin already installed -- no git clone, no Go/Node toolchain.
# Installs into ./axeos-dashboard, relative to wherever you run this from
# (cd somewhere first if you want it elsewhere -- /tmp, a data drive, ...).
# Safe to re-run: it never overwrites an existing config/dashboard.yml, and
# re-running it later is how you update (docker compose pull grabs the
# newer "latest" image).
#
# nginx lands on a random free port by default (see docker-compose.yml --
# check it with `docker compose ps`), so this never conflicts with
# whatever else is already running on the machine. Pass HTTP_PORT for a
# fixed, memorable one instead (e.g. 80 on a machine dedicated to this):
#   curl -fsSL .../docker-install.sh | HTTP_PORT=80 bash
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
touch .env
for var in HTTP_PORT IMAGE_TAG; do
  eval "value=\${$var:-}"
  if [ -n "$value" ]; then
    sed -i.bak "/^$var=/d" .env && rm -f .env.bak
    echo "$var=$value" >> .env
  fi
done
docker compose pull
docker compose up -d

echo ">>> Done. Open http://<this-machine-ip>:<port>/ from any device on your LAN"
echo "    (see the PORTS column below for <port>, unless you passed HTTP_PORT):"
docker compose ps
