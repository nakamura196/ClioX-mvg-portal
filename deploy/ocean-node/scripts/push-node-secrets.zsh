#!/usr/bin/env zsh
# Put the Ocean Node key and the compute allowlist into /opt/cliox-node/.env on
# the VM. Run this yourself; it needs the 1Password CLI (`op`) signed in.
#
# The key goes 1Password -> ssh stdin -> .env (mode 600). It is never printed,
# never written to local disk and never passed as a command-line argument.
#
# Usage:
#   zsh deploy/ocean-node/scripts/push-node-secrets.zsh <ssh-host> <op-item-title> <field> '<json-array-of-wallets>'
# Example:
#   zsh deploy/ocean-node/scripts/push-node-secrets.zsh mdx-clio "Ocean Node sepolia eu-north-1" private_key '["0xabc..."]'
#
# If you don't know the field name, run it with "?" as <field>: it lists the
# field labels of the item (labels only, no values).
set -euo pipefail

HOST="${1:?ssh host}"; ITEM="${2:?1Password item title}"; FIELD="${3:?field label, or ?}"; ALLOW="${4:-}"
VAULT="${OP_VAULT:-Personal}"
REMOTE_DIR=/opt/cliox-node

if [[ "$FIELD" == "?" ]]; then
  op item get "$ITEM" --vault "$VAULT" --format json | jq -r '.fields[] | "\(.label)\t(\(.type))"'
  exit 0
fi

[[ "$ALLOW" == \[\"0x* ]] || { print '✗ 4th argument must be a JSON array like ["0x..."]'; exit 1 }

KEY="$(op item get "$ITEM" --vault "$VAULT" --fields "label=$FIELD" --reveal | tr -d '\r\n')"
[[ "$KEY" == 0x* && ${#KEY} -eq 66 ]] || { print "✗ value is not 0x + 64 hex (length ${#KEY})"; unset KEY; exit 1 }

ssh -o BatchMode=yes "$HOST" "sudo install -d -o \$(id -u) -g \$(id -g) -m 755 $REMOTE_DIR"
# Key and allowlist travel on stdin, one per line.
printf '%s\n%s\n' "$KEY" "$ALLOW" | ssh -o BatchMode=yes "$HOST" "
  set -e; cd $REMOTE_DIR; umask 077; touch .env; chmod 600 .env
  read -r k; read -r a
  sed -i '/^PRIVATE_KEY=/d; /^C2D_ALLOWED_ADDRESSES=/d' .env
  printf 'PRIVATE_KEY=%s\nC2D_ALLOWED_ADDRESSES=%s\n' \"\$k\" \"\$a\" >> .env
  echo \"  written: PRIVATE_KEY (\${#k} chars), C2D_ALLOWED_ADDRESSES=\$a\"
"
unset KEY
print "✓ done. Next: zsh deploy/ocean-node/scripts/deploy.zsh $HOST"
