#!/usr/bin/env zsh
# Deploy GreenReward to Sepolia with the operator (trial wallet) and deposit the
# operator's PLAY (topped up to 1,000 from the faucet) as the sponsor pool.
# Checker = the address of 1Password "Clio-X Sepolia green reward checker"
# (only its public address is read here; its key goes to the Worker, not here).
# Usage: zsh deploy-green-reward.zsh       (DRY=1 to simulate without sending)
# TARGET picks the script contract: MigrateGreenReward (default, 2026-11-27: new
# hardened contract + carry over the old one's claim and pool) or DeployGreenReward
# (first deploy, tops up from the faucet).
set -euo pipefail
cd "${0:A:h}"
RPC="${RPC:-https://ethereum-sepolia-rpc.publicnode.com}"
export CHECKER="$(op item get 'Clio-X Sepolia green reward checker' --vault Personal --fields address)"
PRIVATE_KEY="$(op item get 'Clio-X Sepolia trial wallet' --vault Personal --fields private_key --reveal)"
export PRIVATE_KEY
TARGET="${TARGET:-MigrateGreenReward}"
if [[ -n "${DRY:-}" ]]; then
  forge script script/DeployGreenReward.s.sol:$TARGET --rpc-url "$RPC" 2>&1 | grep -E 'GreenReward|checker|pool|PLAY|Error|revert'
else
  forge script script/DeployGreenReward.s.sol:$TARGET --rpc-url "$RPC" --broadcast --slow --skip-simulation --gas-estimate-multiplier 130 2>&1 | grep -E 'GreenReward|checker|pool|PLAY|Hash|ONCHAIN EXECUTION|Error|revert'
fi
unset PRIVATE_KEY
