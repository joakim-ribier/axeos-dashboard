#!/bin/bash
# Bootstraps axeos-dashboard via Docker on any machine with Docker + the
# compose plugin already installed -- no git clone, no Go/Node toolchain.
# Installs into ./axeos-dashboard, relative to wherever you run this from
# (cd somewhere first if you want it elsewhere -- /tmp, a data drive, ...).
# Safe to re-run: it never overwrites an existing config/dashboard.yml, and
# re-running it later is how you update (IMAGE_TAG=latest grabs the newest
# build of main).
#
# nginx lands on a random free port by default (see docker-compose.yml --
# check it with `docker compose ps`), so this never conflicts with
# whatever else is already running on the machine. Pass HTTP_PORT for a
# fixed, memorable one instead (e.g. 80 on a machine dedicated to this):
#   curl -fsSL .../docker-install.sh | HTTP_PORT=80 bash
#
# IMAGE_TAG is required, and never remembered from a previous run: which
# build gets installed is always the one named on the command line --
# "latest" (the tip of main), a release ("0.1.0"), or a PR's images
# (tagged sha-<short-sha>, built when the "test-integration" label is
# added to it):
#   curl -fsSL .../docker-install.sh | IMAGE_TAG=latest bash
#   curl -fsSL .../docker-install.sh | IMAGE_TAG=0.1.0 bash
set -e

if [ -z "${IMAGE_TAG:-}" ]; then
  echo "IMAGE_TAG is required -- the version to install, e.g.:" >&2
  echo "  curl -fsSL https://raw.githubusercontent.com/joakim-ribier/axeos-dashboard/main/docker-install.sh | IMAGE_TAG=latest bash" >&2
  echo "  (latest = the tip of main; or a release, e.g. IMAGE_TAG=0.1.0)" >&2
  exit 1
fi

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
echo ">>> Image tag: $IMAGE_TAG"
docker compose pull
docker compose up -d

echo ">>> Done. Open http://<this-machine-ip>:<port>/ from any device on your LAN"
echo "    (see the PORTS column below for <port>, unless you passed HTTP_PORT):"
docker compose ps
