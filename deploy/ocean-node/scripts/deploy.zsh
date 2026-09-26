#!/usr/bin/env zsh
# Deploy the Clio-X backend (deploy/ocean-node) to a VM over SSH.
#
# Prerequisites on the VM: Docker Engine + compose plugin, the SSH user in the
# `docker` group, passwordless sudo (only used once to create the directory).
#
# Usage (from the repository root):
#   zsh deploy/ocean-node/scripts/deploy.zsh <ssh-host>            # sync + start
#   zsh deploy/ocean-node/scripts/deploy.zsh <ssh-host> subgraph   # (re)deploy subgraph
#   zsh deploy/ocean-node/scripts/deploy.zsh <ssh-host> status
#
# What it does:
#   1. Copies the compose files to /opt/cliox-node (never the .env).
#   2. Creates /opt/cliox-node/.env (mode 600) if missing and generates the
#      internal passwords on the VM. They are never printed or copied back.
#   3. Refuses to start until PRIVATE_KEY and C2D_ALLOWED_ADDRESSES are set.
#   4. Pulls pinned images and starts the stack (plus the tunnel if a token is set).
set -euo pipefail

HOST="${1:?usage: deploy.zsh <ssh-host> [subgraph|status]}"
ACTION="${2:-up}"
REMOTE_DIR=/opt/cliox-node
SRC_DIR="${0:A:h:h}"

remote() { ssh -o BatchMode=yes "$HOST" "cd $REMOTE_DIR && $1"; }

status() {
  remote 'docker compose ps --format "table {{.Name}}\t{{.Status}}"'
  print -- "--- node"
  remote 'curl -fsS -m 5 http://127.0.0.1:8001/ | head -c 300; echo'
  print -- "--- subgraph"
  remote "curl -fsS -m 5 -H 'content-type: application/json' --data '{\"query\":\"{_meta{block{number} hasIndexingErrors}}\"}' http://127.0.0.1:8000/subgraphs/name/oceanprotocol/ocean-subgraph; echo"
}

case "$ACTION" in
  status) status; exit 0 ;;
  subgraph)
    remote 'docker compose --profile deploy-subgraph build subgraph-deployer && docker compose --profile deploy-subgraph run --rm subgraph-deployer'
    exit 0 ;;
  up) ;;
  *) print "unknown action: $ACTION"; exit 1 ;;
esac

print "▶ Syncing $SRC_DIR -> $HOST:$REMOTE_DIR"
ssh -o BatchMode=yes "$HOST" "sudo install -d -o \$(id -u) -g \$(id -g) -m 755 $REMOTE_DIR"
rsync -a --delete --exclude .env --exclude scripts "$SRC_DIR/" "$HOST:$REMOTE_DIR/"

print "▶ Preparing .env on the VM (values are not printed)"
remote '
  umask 077; touch .env; chmod 600 .env
  for k in TYPESENSE_API_KEY GRAPH_POSTGRES_PASSWORD; do
    if ! grep -q "^$k=." .env; then
      sed -i "/^$k=/d" .env
      printf "%s=%s\n" "$k" "$(openssl rand -hex 24)" >> .env
      echo "  generated $k"
    fi
  done
  missing=""
  grep -q "^PRIVATE_KEY=0x[0-9a-fA-F]\{64\}$" .env || missing="$missing PRIVATE_KEY"
  grep -q "^C2D_ALLOWED_ADDRESSES=\[\"0x" .env || missing="$missing C2D_ALLOWED_ADDRESSES"
  if [ -n "$missing" ]; then echo "  ✗ missing in .env:$missing"; exit 3; fi
  echo "  .env ok ($(grep -c = .env) keys)"
'

profiles=""
if remote 'grep -q "^CLOUDFLARE_TUNNEL_TOKEN=." .env'; then profiles="--profile tunnel"; fi

print "▶ Starting ($profiles)"
remote "docker compose $profiles pull -q && docker compose $profiles up -d --remove-orphans"
sleep 15
status
