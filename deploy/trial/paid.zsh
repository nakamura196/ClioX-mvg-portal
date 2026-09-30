#!/usr/bin/env zsh
# Paid-record trial on Sepolia. Seller = "Clio-X Sepolia trial wallet",
# buyer = "ocean test consumer" (a different account). Keys are injected by
# 1Password only for the duration of the command.
#
# Usage:
#   zsh deploy/trial/paid.zsh publish
#   zsh deploy/trial/paid.zsh buy <did>
set -euo pipefail
cd "${0:A:h}"

export NODE_URL="${NODE_URL:-https://cliox-node.ldas.jp}"
export RPC="${RPC:-https://ethereum-sepolia-rpc.publicnode.com}"
export SELLER_KEY="op://${OP_VAULT:-Personal}/Clio-X Sepolia trial wallet/private_key"
export BUYER_KEY="op://${OP_VAULT:-Personal}/ocean test consumer/private_key"

exec op run -- node paid.mjs "$@"
