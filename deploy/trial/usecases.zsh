#!/usr/bin/env zsh
# Publish what the portal's use-case pages need on the Sepolia trial, and run
# one free job for each page so there is something to show:
#   - dataset   The Federalist Papers, 85 dated essays   (metadata/federalist-dataset.json)
#   - algorithm Text analysis   -> /usecases/visualizations (metadata/text-analysis-algorithm.json)
#   - algorithm Knowledge passages -> /usecases/chatbot     (metadata/chatbot-knowledge-algorithm.json)
#
# The pages list only jobs whose algorithm and dataset DIDs are in the portal's
# allowlists (src/components/TextAnalysis/_constants.ts,
# src/components/ChatbotTrial/_constants.ts), so add the printed DIDs there.
# The jobs belong to the trial wallet; connect that wallet to see them, or
# start your own jobs from the portal.
#
# One 1Password approval covers every step (the key is injected once).
#
# Usage:
#   zsh deploy/trial/usecases.zsh              # publish + two test jobs
#   zsh deploy/trial/usecases.zsh --jobs <dataset did> <text algo did> <chatbot algo did>
#                                              # only start the jobs again
set -euo pipefail
SELF="${0:A}"   # resolve before cd; a relative $0 would break the re-run under op
cd "${SELF:h}"

export NODE_URL="${NODE_URL:-https://cliox-node.ldas.jp}"
export RPC="${RPC:-https://ethereum-sepolia-rpc.publicnode.com}"
export AVOID_LOOP_RUN=true
export DISABLE_P2P=true

if [[ -z "${PRIVATE_KEY:-}" ]]; then
  export PRIVATE_KEY="op://${OP_VAULT:-Personal}/Clio-X Sepolia trial wallet/private_key"
  exec op run -- zsh "$SELF" "$@"
fi

ocean() { npx --no-install ocean-cli "$@" 2>&1 }
did_of() { print -r -- "$1" | grep -o 'did:op:[0-9a-f]\{64\}' | tail -1 }

if [[ "${1:-}" == --jobs ]]; then
  dataset=$2 text=$3 kb=$4
else
  echo "== publish dataset";              out=$(ocean publish metadata/federalist-dataset.json); dataset=$(did_of "$out")
  echo "== publish text analysis";        out=$(ocean publishAlgo metadata/text-analysis-algorithm.json); text=$(did_of "$out")
  echo "== publish knowledge passages";   out=$(ocean publishAlgo metadata/chatbot-knowledge-algorithm.json); kb=$(did_of "$out")
  [[ -n "$dataset" && -n "$text" && -n "$kb" ]] || { print -r -- "$out" | tail -5; echo "publish failed"; exit 1 }

  echo "== wait for the node to index all three"
  for did in $dataset $text $kb; do
    i=0
    until curl -sf "$NODE_URL/api/aquarius/assets/ddo/$did" >/dev/null; do
      (( i++ < 30 )) || { echo "not indexed: $did"; exit 1 }
      sleep 10
    done
  done
fi

env=$(ocean getComputeEnvironments | grep -o '0x[0-9a-f]\{64\}-0x[0-9a-f]\{64\}' | head -1)
jobs=()
for algo in $text $kb; do
  echo "== start a free job: $algo"
  out=$(ocean startFreeCompute $dataset $algo $env); print -r -- "$out" | tail -1
  jobs+=($(print -r -- "$out" | grep -o 'JobID: [^ ]*' | cut -d' ' -f2))
done

echo "== wait for the jobs (up to 10 minutes)"
for job in $jobs; do
  i=0
  while (( i++ < 30 )); do
    st=$(ocean getJobStatus $dataset $job)
    # ocean-cli prints a JS object (keys may be unquoted)
    print -r -- "$st" | grep -Eq "statusText\"?: *['\"]Job finished|status\"?: *70\b" && break
    sleep 20
  done
  print -r -- "$job: $(print -r -- "$st" | grep -Eo "statusText\"?: *['\"][^'\"]*" | tail -1)"
done

echo
echo "dataset:            $dataset"
echo "text analysis:      $text"
echo "knowledge passages: $kb"
echo "jobs:               $jobs"
