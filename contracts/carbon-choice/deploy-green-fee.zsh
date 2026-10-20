#!/usr/bin/env zsh
# Deploy GreenFeeDemo (play-money feebate + sponsor deposit) to Sepolia with
# the trial wallet, using the price table from the portal's location registry.
#
# Needs: forge, op (1Password CLI), forge-std in lib/, node_modules in the repo
# Usage: zsh deploy-green-fee.zsh          (DRY=1 to simulate without sending)
# Prints the contract address; put it in src/@utils/greenFee.ts.
set -euo pipefail
cd "${0:A:h}"
RPC="${RPC:-https://ethereum-sepolia-rpc.publicnode.com}"
mkdir -p cache
../../node_modules/.bin/ts-node-transpile-only --compiler-options '{"module":"commonjs"}' script/green-fee-locations.ts > cache/green-fee-locations.json
PRIVATE_KEY="$(op item get 'Clio-X Sepolia trial wallet' --fields private_key --reveal)"
export PRIVATE_KEY
if [[ -n "${DRY:-}" ]]; then
  forge script script/DeployGreenFee.s.sol:DeployGreenFee --rpc-url "$RPC" 2>&1 | grep -E 'GreenFeeDemo|block|Error|revert'
else
  forge script script/DeployGreenFee.s.sol:DeployGreenFee --rpc-url "$RPC" --broadcast --slow --skip-simulation 2>&1 | grep -E 'GreenFeeDemo|block|Hash|ONCHAIN EXECUTION|Error|revert'
fi
unset PRIVATE_KEY
