#!/usr/bin/env zsh
# Run one free compute job on "Provisional place B" (the second environment of the
# mdx-clio Ocean Node) with the consumer wallet (田中 0x05f1…1085), and save the
# job status for checking the location the portal resolves.
#
# Usage: zsh deploy/ocean-node/scripts/try-place-b-job.zsh <out-dir>
#
# Uses the ocean-cli installed for the ch14 video (~/git/blog/cliox/scripts/ch14)
# and the dataset + algorithm from that video (the closed ise-monogatari ZIP and
# the NDL OCR-Lite algorithm). Nothing new is published.
# The private key is read from 1Password into a variable, never printed or
# written; the out-dir is checked for it at the end.
set -euo pipefail

OUT="${1:?usage: try-place-b-job.zsh <out-dir>}"
mkdir -p "$OUT"
CH14=~/git/blog/cliox/scripts/ch14
OCEAN=$CH14/node_modules/.bin/ocean-cli
export NODE_URL=https://cliox-node.ldas.jp RPC=https://ethereum-sepolia-rpc.publicnode.com AVOID_LOOP_RUN=true DISABLE_P2P=true
ds=$(<$CH14/run/dataset.did); al=$(<$CH14/run/algo.did)

print "▶ Finding Provisional place B on the node"
env=$(curl -fsS -m 20 "$NODE_URL/api/services/computeEnvironments" | python3 -c 'import json,sys; print(next(e["id"] for e in json.load(sys.stdin) if (e.get("description") or "").startswith("Provisional place B")))')
print "  env: $env"; print -r -- "$env" > "$OUT/env.id"

PRIVATE_KEY="$(op item get 'Clio-X Sepolia tanaka buyer' --vault Personal --fields private_key --reveal)"; export PRIVATE_KEY
[[ ${#PRIVATE_KEY} -ge 64 ]] || { print "✗ key not read"; exit 1; }

print "▶ Starting a free job (dataset $ds, algorithm $al)"
"$OCEAN" startFreeCompute "$ds" "$al" "$env" 2>&1 | tee "$OUT/start.txt"
job=$(grep -o 'JobID: [^ ]*' "$OUT/start.txt" | head -1 | cut -d' ' -f2)
[[ -n $job ]] || { print "✗ no job id"; unset PRIVATE_KEY; exit 1; }
print -r -- "$job" > "$OUT/job.id"

print "▶ Waiting for the job (up to 10 min)"
i=0
while (( i++ < 40 )); do
  "$OCEAN" getJobStatus "$ds" "$job" > "$OUT/status.txt" 2>&1 || true
  grep -q 'Job finished\|"status": *70' "$OUT/status.txt" && break
  grep -q '"status": *7[1-9]' "$OUT/status.txt" && break
  sleep 15
done
grep -o "environment: [^,]*\|status: [0-9]*\|statusText: '[^']*'\|algoStartTimestamp: '[^']*'\|algoStopTimestamp: '[^']*'" "$OUT/status.txt" | sed 's/\x1b\[[0-9;]*m//g' | sort -u

if grep -rqF -- "$PRIVATE_KEY" "$OUT"; then print "✗ SECRET FOUND in $OUT"; unset PRIVATE_KEY; exit 1; fi
unset PRIVATE_KEY
print "✓ done: $OUT"
