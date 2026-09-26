#!/usr/bin/env zsh
# Run the official Ocean CLI against the Clio-X Sepolia trial node, with the
# trial wallet's key injected by 1Password only for the duration of the command.
#
# Prerequisites: `npm ci` in this folder; 1Password item
# "Clio-X Sepolia trial wallet" (created by ../ocean-node/scripts/create-trial-wallet.zsh).
#
# Usage (any ocean-cli command):
#   zsh deploy/trial/cli.zsh getComputeEnvironments
#   zsh deploy/trial/cli.zsh publish --file metadata/dataset.json --encrypt false
#   zsh deploy/trial/cli.zsh publishAlgo --file metadata/algorithm.json --encrypt false
#   zsh deploy/trial/cli.zsh startFreeCompute --datasets <did> --algo <did> --env <envId>
set -euo pipefail
cd "${0:A:h}"

export NODE_URL="${NODE_URL:-https://cliox-node.ldas.jp}"
export RPC="${RPC:-https://sepolia.gateway.tenderly.co}"
export AVOID_LOOP_RUN=true   # one command per run
export DISABLE_P2P=true      # HTTP node only; do not dial public bootstrap peers
export PRIVATE_KEY="op://${OP_VAULT:-Personal}/Clio-X Sepolia trial wallet/private_key"

exec op run -- npx --no-install ocean-cli "$@"
