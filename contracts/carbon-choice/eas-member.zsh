#!/usr/bin/env zsh
# Member attestations for the green fee demo (Sepolia, EAS). Operator only.
#
# Needs: forge, op (1Password CLI). The key is read from 1Password for this run only.
# Usage:
#   zsh eas-member.zsh register              one time: register the schema "bool member"
#   zsh eas-member.zsh attest 0xWALLET       say "this wallet is a member"
#   zsh eas-member.zsh revoke 0xATTESTATION  take it back (subsidy stops at once)
# DRY=1 simulates without sending anything.
set -euo pipefail
cd "${0:A:h}"
RPC="${RPC:-https://ethereum-sepolia-rpc.publicnode.com}"
cmd="${1:-}"
case "$cmd" in
  register) sig='register()' ;;
  attest) sig='attest()'; export MEMBER="${2:?wallet address}" ;;
  revoke) sig='revoke()'; export ATTESTATION_UID="${2:?attestation id}" ;;
  *) print -u2 "usage: zsh eas-member.zsh register|attest <wallet>|revoke <uid>"; exit 2 ;;
esac
PRIVATE_KEY="$(op item get 'Clio-X Sepolia trial wallet' --fields private_key --reveal)"
export PRIVATE_KEY
if [[ -n "${DRY:-}" ]]; then
  forge script script/EasMember.s.sol:EasMember --sig "$sig" --rpc-url "$RPC" 2>&1 | grep -E 'schema|attested|revoked|0x|Error|revert'
else
  # --skip-simulation: Sepolia charges ~4x the gas forge's local EVM predicts, so let the node estimate.
  forge script script/EasMember.s.sol:EasMember --sig "$sig" --rpc-url "$RPC" --broadcast --slow --skip-simulation 2>&1 | grep -E 'schema|attested|revoked|ONCHAIN EXECUTION|Error|revert'
  # The UID the script logs is from its local run; EAS mixes in the block time, so read the real one from the receipt.
  if [[ "$cmd" == attest ]]; then
    print "attestation uid (on chain): $(jq -r '.receipts[0].logs[0].data' broadcast/EasMember.s.sol/11155111/attest-latest.json)"
  fi
fi
unset PRIVATE_KEY
