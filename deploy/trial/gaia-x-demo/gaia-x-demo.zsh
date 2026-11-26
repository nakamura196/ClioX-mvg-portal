#!/usr/bin/env zsh
# Publish a sample record on the Clio-X Sepolia trial with a DEMO Gaia-X
# Service Credential, so the portal's Verify page has something to show.
#
# What it does:
#   1. Creates the signing key + self-signed certificate in 1Password
#      ("Clio-X Gaia-X demo signing key") if it is not there yet. Nothing on disk.
#   2. Publishes the sample (metadata/gaia-x-demo-dataset.json) with the trial wallet.
#   3. Waits until cliox-node has indexed it.
#   4. Writes did.json, the certificate and the signed credential into
#      public/.well-known/ of the portal, checks the signatures, and commits
#      everything on deploy/hosting. It does NOT push.
#
# Prerequisites: 1Password CLI with desktop integration (Touch ID),
# `npm ci` done in deploy/trial.
# Usage: zsh gaia-x-demo.zsh
set -euo pipefail

REPO=$HOME/git/web3/cliox.worktrees/hosting
HERE=${0:A:h}
ITEM="Clio-X Gaia-X demo signing key"
VAULT=${OP_VAULT:-Personal}
NAME=declaration-demo
[[ -d $HOME/.nvm/versions/node/v22.22.2/bin ]] && export PATH=$HOME/.nvm/versions/node/v22.22.2/bin:$PATH

cd $REPO
[[ $(git branch --show-current) == deploy/hosting ]] || { echo "not on deploy/hosting"; exit 1 }

echo "== copy the scripts into deploy/trial"
mkdir -p deploy/trial/gaia-x-demo
cp $HERE/build.mjs $HERE/check.mjs deploy/trial/gaia-x-demo/
cp $HERE/gaia-x-demo.zsh deploy/trial/gaia-x-demo/
cp $HERE/gaia-x-demo-dataset.json deploy/trial/metadata/

echo "== 1. signing key in 1Password"
if ! op item get "$ITEM" --vault "$VAULT" >/dev/null 2>&1; then
  K=$(openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 2>/dev/null)
  C=$(openssl req -x509 -new -key <(print -r -- "$K") -days 3650 -subj "/CN=cliox.ldas.jp/O=Clio-X Sepolia trial DEMO - not a trust anchor" 2>/dev/null)
  op item create --category="API Credential" --vault="$VAULT" --title="$ITEM" "private_key[concealed]=$K" "certificate[text]=$C" "notesPlain=用途: Gaia-X 検証ページの練習用 (did:web:cliox.ldas.jp) | 使用先: deploy/trial/gaia-x-demo | 範囲: 試用のみ" >/dev/null
  a=$(print -r -- "$K" | openssl pkey -pubout 2>/dev/null)
  b=$(op read "op://$VAULT/$ITEM/private_key" | openssl pkey -pubout 2>/dev/null)
  unset K C
  [[ -n $a && $a == $b ]] || { echo "key stored in 1Password does not match; stop"; exit 1 }
  echo "created"
else
  echo "exists"
fi

echo "== 2. publish the sample"
cd deploy/trial
export NODE_URL=https://cliox-node.ldas.jp
export RPC=https://ethereum-sepolia-rpc.publicnode.com
export AVOID_LOOP_RUN=true DISABLE_P2P=true
out=$(PRIVATE_KEY=$(op read "op://$VAULT/Clio-X Sepolia trial wallet/private_key") npx --no-install ocean-cli publish metadata/gaia-x-demo-dataset.json 2>&1)
print -r -- "$out" | tail -2
did=$(print -r -- "$out" | grep -o 'did:op:[0-9a-f]\{64\}' | tail -1)
[[ -n $did ]] || { echo "publish failed"; exit 1 }

echo "== 3. wait for cliox-node to index $did"
i=0
until curl -sf "$NODE_URL/api/aquarius/assets/ddo/$did" >/dev/null; do
  (( i++ < 30 )) || { echo "not indexed after 5 minutes: $did"; exit 1 }
  sleep 10
done

echo "== 4. sign and write public/.well-known"
GX_DEMO_KEY=$(op read "op://$VAULT/$ITEM/private_key") GX_DEMO_CERT=$(op read "op://$VAULT/$ITEM/certificate") node gaia-x-demo/build.mjs $did $NAME $REPO/public/.well-known
node gaia-x-demo/check.mjs $REPO/public/.well-known/gaia-x-demo/$NAME.vp.json $REPO/public/.well-known/did.json

cd $REPO
git add public/.well-known/did.json public/.well-known/gaia-x-demo/certificate-chain.crt public/.well-known/gaia-x-demo/$NAME.vp.json deploy/trial/gaia-x-demo/build.mjs deploy/trial/gaia-x-demo/check.mjs deploy/trial/gaia-x-demo/gaia-x-demo.zsh deploy/trial/metadata/gaia-x-demo-dataset.json
git commit -q -m "feat(trial): Gaia-X 検証ページの練習用クレデンシャルと見本 1 件 ($did)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git log --oneline -1

echo
echo "DID: $did"
echo "next: git -C $REPO push fork deploy/hosting"
