#!/usr/bin/env zsh
# Install the weekly cleanup (cleanup-cache.sh) on the Ocean Node VM.
#
# Usage:  zsh deploy/ocean-node/scripts/install-cleanup.zsh mdx-clio
#
# Copies the script to /opt/cliox-node/scripts/ and adds one line to the SSH
# user's crontab: every Monday 03:00 server time (the VM is on Asia/Tokyo). Output goes to
# /opt/cliox-node/cleanup.log (kept to the last 500 lines). Running it twice
# leaves one crontab line.
set -euo pipefail

HOST=${1:?usage: install-cleanup.zsh <ssh-host>}
HERE=${0:A:h}

ssh -o BatchMode=yes "$HOST" 'mkdir -p /opt/cliox-node/scripts'
scp -q "$HERE/cleanup-cache.sh" "$HOST:/opt/cliox-node/scripts/cleanup-cache.sh"
ssh -o BatchMode=yes "$HOST" 'chmod 755 /opt/cliox-node/scripts/cleanup-cache.sh'

LINE='0 3 * * 1 /opt/cliox-node/scripts/cleanup-cache.sh >> /opt/cliox-node/cleanup.log 2>&1; tail -n 500 /opt/cliox-node/cleanup.log > /opt/cliox-node/cleanup.log.tmp && mv /opt/cliox-node/cleanup.log.tmp /opt/cliox-node/cleanup.log'
ssh -o BatchMode=yes "$HOST" "( crontab -l 2>/dev/null | grep -v 'cleanup-cache.sh' ; echo '$LINE' ) | crontab -"

echo "installed on $HOST:"
ssh -o BatchMode=yes "$HOST" 'crontab -l | grep cleanup-cache.sh; df -h / | tail -1'
