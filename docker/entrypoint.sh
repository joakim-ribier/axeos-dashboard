#!/bin/sh
set -e

CONFIG_PATH="${CONFIG_PATH:-/config/dashboard.yml}"

/usr/local/bin/dashboard-api -config "$CONFIG_PATH" &
pid1=$!
/usr/local/bin/feeder -config "$CONFIG_PATH" &
pid2=$!

trap 'kill "$pid1" "$pid2" 2>/dev/null' TERM INT

# If either process dies, stop the whole container so Docker's restart
# policy relaunches both together -- feeder and dashboard-api are always
# deployed as a pair, never independently. Polls rather than `wait -n`
# (a bashism not available in Alpine's plain /bin/sh) so no extra package
# is needed just for this.
while kill -0 "$pid1" 2>/dev/null && kill -0 "$pid2" 2>/dev/null; do
  sleep 1
done
kill "$pid1" "$pid2" 2>/dev/null
exit 1
