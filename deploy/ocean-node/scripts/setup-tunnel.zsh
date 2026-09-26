#!/usr/bin/env zsh
# Create the Cloudflare Tunnel for the Clio-X backend with the cloudflared CLI,
# store its connector token in 1Password, and hand it to the VM.
#
# Prerequisites: cloudflared logged in (~/.cloudflared/cert.pem for the zone),
# 1Password CLI (`op`) signed in. Routing is in ../cloudflared/config.yml.
#
# Usage (from the repository root):
#   zsh deploy/ocean-node/scripts/setup-tunnel.zsh <ssh-host> [tunnel-name]
# Example:
#   zsh deploy/ocean-node/scripts/setup-tunnel.zsh mdx-clio cliox-node
#
# What it does (safe to re-run; each step is skipped if already done):
#   1. Creates the tunnel. Deletes the local credentials file afterwards; the
#      token is enough to run it.
#   2. Adds DNS CNAMEs for every hostname in cloudflared/config.yml.
#   3. Saves the connector token as a 1Password item (never printed).
#   4. Writes it to the VM's .env via push-tunnel-token.zsh.
# Then start it with: zsh deploy/ocean-node/scripts/deploy.zsh <ssh-host>
set -euo pipefail

HOST="${1:?usage: setup-tunnel.zsh <ssh-host> [tunnel-name]}"
NAME="${2:-cliox-node}"
VAULT="${OP_VAULT:-Personal}"
ITEM="Cloudflare Tunnel token: $NAME"
SRC_DIR="${0:A:h:h}"
HOSTNAMES=(${(f)"$(sed -n 's/^ *- hostname: *//p' "$SRC_DIR/cloudflared/config.yml")"})

print "▶ 1. Tunnel $NAME"
if cloudflared tunnel list --name "$NAME" 2>/dev/null | grep -q " $NAME "; then
  print "  exists"
else
  cloudflared tunnel create "$NAME" >/dev/null
  ID="$(cloudflared tunnel list --name "$NAME" 2>/dev/null | awk -v n="$NAME" '$2==n{print $1}')"
  rm -f ~/.cloudflared/"$ID".json
  print "  created (local credentials file removed)"
fi

print "▶ 2. DNS"
for h in $HOSTNAMES; do
  cloudflared tunnel route dns "$NAME" "$h" 2>&1 | sed -n 's/.*INF /  /p'
done

print "▶ 3. 1Password item \"$ITEM\""
if op item get "$ITEM" --vault "$VAULT" >/dev/null 2>&1; then
  print "  exists"
else
  TOKEN="$(cloudflared tunnel token "$NAME" | tr -d '\r\n ')"
  jq -n --arg t "$TOKEN" --arg title "$ITEM" --arg note "用途: Clio-X backend tunnel | 使用先: $HOST cliox-cloudflared | 範囲: ${HOSTNAMES[*]}" \
    '{title:$title, category:"API_CREDENTIAL", fields:[
      {id:"credential", label:"credential", type:"CONCEALED", value:$t},
      {id:"notesPlain", label:"notesPlain", type:"STRING", purpose:"NOTES", value:$note}]}' \
    | op item create --vault "$VAULT" >/dev/null
  unset TOKEN
  print "  saved"
fi

print "▶ 4. VM"
zsh "${0:A:h}/push-tunnel-token.zsh" "$HOST" "$ITEM" credential
