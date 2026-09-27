#!/usr/bin/env zsh
# Publish the Kōi Genji monogatari TEI (54 chapters, one tar.gz) and its
# chapter-profile algorithm as Compute assets on the Clio-X Sepolia trial node,
# then start one free compute job to check that they work together.
#
# One 1Password approval covers every step (the key is injected once).
#
# Usage:
#   zsh deploy/trial/genji.zsh                      # publish + test job
#   zsh deploy/trial/genji.zsh --deprecate <did>... # also mark older versions as deprecated
set -euo pipefail
cd "${0:A:h}"

export NODE_URL="${NODE_URL:-https://cliox-node.ldas.jp}"
export RPC="${RPC:-https://ethereum-sepolia-rpc.publicnode.com}"
export AVOID_LOOP_RUN=true
export DISABLE_P2P=true

if [[ -z "${PRIVATE_KEY:-}" ]]; then
  export PRIVATE_KEY="op://${OP_VAULT:-Personal}/Clio-X Sepolia trial wallet/private_key"
  exec op run -- zsh "${0:A}" "$@"
fi

ocean() { npx --no-install ocean-cli "$@" 2>&1 }

old=()
if [[ "${1:-}" == --deprecate ]]; then shift; old=("$@"); fi

echo "== publish dataset"
out=$(ocean publish metadata/genji-dataset.json); print -r -- "$out" | tail -2
dataset=$(print -r -- "$out" | grep -o 'did:op:[0-9a-f]\{64\}' | tail -1)

echo "== publish algorithm"
out=$(ocean publishAlgo metadata/genji-algorithm.json); print -r -- "$out" | tail -2
algo=$(print -r -- "$out" | grep -o 'did:op:[0-9a-f]\{64\}' | tail -1)

[[ -n "$dataset" && -n "$algo" ]] || { echo "publish failed"; exit 1 }

echo "== wait for the node to index both"
for did in $dataset $algo; do
  i=0
  until curl -sf "$NODE_URL/api/aquarius/assets/ddo/$did" >/dev/null; do
    (( i++ < 30 )) || { echo "not indexed: $did"; exit 1 }
    sleep 10
  done
done

echo "== start a free compute job"
env=$(ocean getComputeEnvironments | grep -o '0x[0-9a-f]\{64\}-0x[0-9a-f]\{64\}' | head -1)
out=$(ocean startFreeCompute $dataset $algo $env); print -r -- "$out" | tail -1
job=$(print -r -- "$out" | grep -o 'JobID: [^ ]*' | cut -d' ' -f2)

echo "== wait for the job (up to 10 minutes)"
i=0
while (( i++ < 30 )); do
  st=$(ocean getJobStatus $dataset $job)
  print -r -- "$st" | grep -q '"statusText": *"Job finished"\|"status": *70' && break
  sleep 20
done
print -r -- "$st" | grep -o '"statusText": *"[^"]*"' | tail -1

if (( ${#old} )); then
  echo "== mark older versions as deprecated"
  node deprecate.mjs $old
fi

echo
echo "dataset:   $dataset"
echo "algorithm: $algo"
echo "job:       $job"
echo "results:   zsh deploy/trial/cli.zsh downloadJobResults $job <index of outputs.tar> ./results"
