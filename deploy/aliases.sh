# axeos-dashboard's shortcuts on the server. It lands in dist/deploy/ with every
# make update / make install (or make deploy), and make install-services adds the
# line that loads it to ~/.bashrc, once -- a new shell has the new ones.

# The deployment folder, two levels above this file, wherever it is.
AXEOS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

alias axeos='cd "$AXEOS_DIR"'
alias axeos-restart='make -C "$AXEOS_DIR" restart'
alias axeos-update='make -C "$AXEOS_DIR" update'
alias axeos-update-latest='make -C "$AXEOS_DIR" update RELEASE_TAG=latest'
alias axeos-status='systemctl status axeos-dashboard-api axeos-dashboard-feeder axeos-dashboard-mailer --no-pager'
alias axeos-logs='journalctl -u axeos-dashboard-api -u axeos-dashboard-feeder -u axeos-dashboard-mailer -f'

axeos-help() {
  cat <<EOF
axeos                go to $AXEOS_DIR
axeos-restart        restart dashboard-api, feeder and mailer
axeos-update         update to the last stable version, and restart (RELEASE_TAG=1.0.0 axeos-update: a given one)
axeos-update-latest  update to the last commit on main, and restart
axeos-status         status of the three services
axeos-logs           their logs, live (Ctrl+C to quit)
axeos-help           this list
EOF
}
