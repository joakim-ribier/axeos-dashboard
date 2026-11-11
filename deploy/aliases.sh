# axeos-dashboard's shortcuts on the server. make deploy copies this file to
# dist/deploy/; load it from ~/.bashrc, once (with your DEPLOY_DIR):
#   [ -f ~/axeos-dashboard/dist/deploy/aliases.sh ] && . ~/axeos-dashboard/dist/deploy/aliases.sh

# The deployment folder, two levels above this file, wherever it is.
AXEOS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

alias axeos='cd "$AXEOS_DIR"'
alias axeos-restart='make -C "$AXEOS_DIR" restart'
alias axeos-update='make -C "$AXEOS_DIR" update'
alias axeos-status='systemctl status axeos-dashboard-api axeos-dashboard-feeder axeos-dashboard-mailer --no-pager'
alias axeos-logs='journalctl -u axeos-dashboard-api -u axeos-dashboard-feeder -u axeos-dashboard-mailer -f'

axeos-help() {
  cat <<EOF
axeos          go to $AXEOS_DIR
axeos-restart  restart dashboard-api, feeder and mailer
axeos-update   update to the last release, and restart (RELEASE_TAG=0.2.0 axeos-update for another)
axeos-status   status of the three services
axeos-logs     their logs, live (Ctrl+C to quit)
axeos-help     this list
EOF
}
