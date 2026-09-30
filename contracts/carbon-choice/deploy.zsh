#!/usr/bin/env zsh
# Deploy CarbonChoiceRecord to Sepolia with the trial wallet.
#
# Needs: forge, op (1Password CLI), forge-std in lib/
#   (forge install foundry-rs/forge-std --no-git)
# Usage: zsh deploy.zsh
# Prints the contract address; put it in address.config.js (carbonChoiceRecord).
set -euo pipefail
cd "${0:A:h}"
RPC="${RPC:-https://ethereum-sepolia-rpc.publicnode.com}"
PRIVATE_KEY="$(op item get 'Clio-X Sepolia trial wallet' --fields private_key --reveal)"
export PRIVATE_KEY
forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC" --broadcast 2>&1 | grep -E 'CarbonChoiceRecord|Hash|ONCHAIN EXECUTION|Error'
unset PRIVATE_KEY
