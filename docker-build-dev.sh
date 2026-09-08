#!/bin/bash
# Builds axeos-dashboard's Docker images from the current checkout --
# including uncommitted changes -- and starts the stack locally, for
# testing the latest local code before pushing. Unlike docker-install.sh
# (which downloads files and pulls prebuilt images from GHCR), this one
# builds in place: run it from the repo root.
# Config/storage land in ./axeos-dashboard/ (gitignored) instead of the
# repo root, so they never mix with the source tree -- see
# docker/docker-compose.dev.yml, loaded as an override alongside the main
# docker-compose.yml (build context is untouched, still the repo root).
# Safe to re-run: it never overwrites an existing
# axeos-dashboard/config/dashboard.yml, and re-running rebuilds + restarts
# with whatever changed since last time.
#
# nginx lands on a random free port by default (see docker-compose.yml --
# check it with `docker compose ps`), so this never conflicts with
# whatever else is already running on the machine. Pass HTTP_PORT for a
# fixed, memorable one instead:
#   HTTP_PORT=8888 ./docker-build-dev.sh
set -e

if [ ! -f docker-compose.yml ]; then
  echo "Run this from the repo root (docker-compose.yml not found here)." >&2
  exit 1
fi

mkdir -p axeos-dashboard/config axeos-dashboard/storage
if [ ! -f axeos-dashboard/config/dashboard.yml ]; then
  cp docker/dashboard.yml.example axeos-dashboard/config/dashboard.yml
fi
touch .env
if [ -n "$HTTP_PORT" ]; then
  sed -i.bak "/^HTTP_PORT=/d" .env && rm -f .env.bak
  echo "HTTP_PORT=$HTTP_PORT" >> .env
fi

COMPOSE="docker compose -f docker-compose.yml -f docker/docker-compose.dev.yml"

GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo dev)
git diff --quiet 2>/dev/null || GIT_SHA="$GIT_SHA-dirty"

echo ">>> Building images from local source (GIT_SHA=$GIT_SHA)..."
$COMPOSE build --build-arg GIT_SHA="$GIT_SHA"
$COMPOSE up -d

echo ">>> Done. Open http://localhost:<port>/"
echo "    (see the PORTS column below for <port>, unless you passed HTTP_PORT):"
$COMPOSE ps
