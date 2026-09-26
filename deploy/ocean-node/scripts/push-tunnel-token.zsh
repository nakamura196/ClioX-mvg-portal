#!/usr/bin/env zsh
# Put the Cloudflare Tunnel connector token into /opt/cliox-node/.env on the VM.
# Run this yourself; it needs the 1Password CLI (`op`) signed in.
#
# The token goes 1Password -> ssh stdin -> .env (mode 600). It is never printed,
# never written to local disk and never passed as a command-line argument.
#
# Usage:
#   zsh deploy/ocean-node/scripts/push-tunnel-token.zsh <ssh-host> <op-item-title> <field>
# Example:
#   zsh deploy/ocean-node/scripts/push-tunnel-token.zsh mdx-clio "Cloudflare Tunnel cliox-node" token
#
# Then start the tunnel with: zsh deploy/ocean-node/scripts/deploy.zsh <ssh-host>
set -euo pipefail

HOST="${1:?ssh host}"; ITEM="${2:?1Password item title}"; FIELD="${3:?field label}"
VAULT="${OP_VAULT:-Personal}"
REMOTE_DIR=/opt/cliox-node

TOKEN="$(op item get "$ITEM" --vault "$VAULT" --fields "label=$FIELD" --reveal | tr -d '\r\n ')"
# Connector tokens are base64 JSON starting with "eyJ" and a few hundred chars long.
[[ "$TOKEN" == eyJ* && ${#TOKEN} -gt 100 ]] || { print "✗ value does not look like a tunnel token (length ${#TOKEN})"; unset TOKEN; exit 1 }

printf '%s\n' "$TOKEN" | ssh -o BatchMode=yes "$HOST" "
  set -e; cd $REMOTE_DIR; umask 077; touch .env; chmod 600 .env
  read -r t
  sed -i '/^CLOUDFLARE_TUNNEL_TOKEN=/d' .env
  printf 'CLOUDFLARE_TUNNEL_TOKEN=%s\n' \"\$t\" >> .env
  echo \"  written: CLOUDFLARE_TUNNEL_TOKEN (\${#t} chars)\"
"
unset TOKEN
print "✓ done. Next: zsh deploy/ocean-node/scripts/deploy.zsh $HOST"
