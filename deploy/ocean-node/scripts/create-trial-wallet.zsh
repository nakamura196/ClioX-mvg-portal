#!/usr/bin/env zsh
# Create a wallet for the Sepolia trial (publishing sample assets and running
# free compute jobs from the command line) and store it in 1Password.
#
# Prerequisites: 1Password CLI (`op`) signed in; run from the repository root
# after `npm ci` (uses the repository's ethers).
#
# Usage:
#   zsh deploy/ocean-node/scripts/create-trial-wallet.zsh [vault]   # default vault: Personal
#
# What it does:
#   1. Generates a new random key inside Node.js.
#   2. Pipes a 1Password item template straight into `op item create`, so the
#      key never appears on screen, in a shell variable or in a file.
#   3. Prints only the address (public; needed for the faucet and the allowlist).
#
# The wallet is for the Sepolia test network only. Sepolia ETH has no value,
# but keep the key in 1Password anyway: whoever holds it can publish in its name.
set -euo pipefail

VAULT="${1:-Personal}"
TITLE="Clio-X Sepolia trial wallet"
cd "${0:A:h:h:h:h}"

if op item get "$TITLE" --vault "$VAULT" >/dev/null 2>&1; then
  print "✗ \"$TITLE\" already exists in vault $VAULT. Nothing changed."
  print "  address: $(op item get "$TITLE" --vault "$VAULT" --fields address)"
  exit 1
fi

TITLE="$TITLE" node -e '
const { ethers } = require("ethers")
const w = ethers.Wallet.createRandom()
process.stdout.write(JSON.stringify({
  title: process.env.TITLE,
  category: "API_CREDENTIAL",
  notesPlain: "用途: Clio-X Sepolia 試用環境で見本の登録と無償の計算ジョブ | 使用先: cliox-node.ldas.jp | 範囲: Sepolia のみ",
  fields: [
    { id: "credential", type: "CONCEALED", label: "private_key", value: w.privateKey },
    { id: "address", type: "STRING", label: "address", value: w.address }
  ]
}))
' | op item create --vault "$VAULT" - >/dev/null

print "✓ Created \"$TITLE\" in vault $VAULT"
print "  address: $(op item get "$TITLE" --vault "$VAULT" --fields address)"
print "  key length: $(op read "op://$VAULT/$TITLE/private_key" | tr -d '\n' | wc -c | tr -d ' ') chars (expected 66)"
