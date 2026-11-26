#!/usr/bin/env zsh
# Member attestations for the green fee demo (Sepolia, EAS). Operator only.
#
# Needs: forge, cast, jq, curl, op (1Password CLI). The key is read from 1Password for this run only.
# Usage:
#   zsh eas-member.zsh register              one time: register the schema "bool member"
#   zsh eas-member.zsh check 0xWALLET        show live attestations for a wallet and what the contract says (no key, no send)
#   zsh eas-member.zsh attest 0xWALLET       say "this wallet is a member" (skipped if one already exists; FORCE=1 writes anyway)
#   zsh eas-member.zsh attest-file FILE      attest every address in FILE (one per line, '#' starts a comment)
#   zsh eas-member.zsh revoke 0xATTESTATION  take it back (subsidy stops at once)
# DRY=1 simulates without sending anything.
#
# Keep FILE outside the repository if it pairs addresses with names: names never go on chain or into git.
set -euo pipefail
cd "${0:A:h}"
RPC="${RPC:-https://ethereum-sepolia-rpc.publicnode.com}"
GREEN_FEE="${GREEN_FEE:-0xF1C2738b41ACf84708e611ebe7883f4D51E158f6}"
SCHEMA=0x751f5a7e7ba19e6c1db68b77340edd298fc144a39070afc766a9320ffe80130d
ATTESTER=0xedAa08237554bBafC218f0EaA86704e1aDe9262E
EASSCAN=https://sepolia.easscan.org

# Live (not revoked) attestations from our attester for a wallet, newest first. easscan wants checksummed addresses.
live_uids() {
  local q='query($s:StringFilter,$a:StringFilter,$r:StringFilter){attestations(where:{schemaId:$s,attester:$a,recipient:$r,revoked:{equals:false}},orderBy:[{time:desc}]){id}}'
  curl -sf "$EASSCAN/graphql" -H 'content-type: application/json' \
    -d "$(jq -n --arg q "$q" --arg s "$SCHEMA" --arg a "$ATTESTER" --arg r "$1" '{query:$q,variables:{s:{equals:$s},a:{equals:$a},r:{equals:$r}}}')" \
    | jq -r '.data.attestations[].id'
}

checksum() { cast to-check-sum-address "$1" 2>/dev/null || { print -u2 "not an address: $1"; return 1 }; }

check() {
  local w uid
  w="$(checksum "$1")"
  local uids=("${(@f)$(live_uids "$w")}")
  if [[ -z "${uids[1]:-}" ]]; then print "$w: no attestation"; return; fi
  for uid in "${uids[@]}"; do
    print "$w: $uid  contract isMember=$(cast call "$GREEN_FEE" 'isMember(address,bytes32)(bool,uint8)' "$w" "$uid" --rpc-url "$RPC" | tr '\n' ' ')"
    print "  $EASSCAN/attestation/view/$uid"
  done
}

attest_one() {
  local w existing
  w="$(checksum "$1")"
  existing="$(live_uids "$w" | head -1)"
  if [[ -n "$existing" && -z "${FORCE:-}" ]]; then
    print "$w: already attested ($existing), skipped"
    return
  fi
  export MEMBER="$w"
  if [[ -n "${DRY:-}" ]]; then
    forge script script/EasMember.s.sol:EasMember --sig 'attest()' --rpc-url "$RPC" 2>&1 | grep -E 'attested|Error|revert'
    return
  fi
  # --skip-simulation: Sepolia charges ~4x the gas forge's local EVM predicts, so let the node estimate.
  forge script script/EasMember.s.sol:EasMember --sig 'attest()' --rpc-url "$RPC" --broadcast --slow --skip-simulation 2>&1 | grep -E 'ONCHAIN EXECUTION|Error|revert'
  # The UID the script logs is from its local run; EAS mixes in the block time, so read the real one from the receipt.
  local f=broadcast/EasMember.s.sol/11155111/attest-latest.json
  print "$w: attested $(jq -r '.receipts[0].logs[0].data' $f)  tx $(jq -r '.receipts[0].transactionHash' $f)"
}

load_key() {
  PRIVATE_KEY="$(op item get 'Clio-X Sepolia trial wallet' --fields private_key --reveal)"
  export PRIVATE_KEY
}

cmd="${1:-}"
case "$cmd" in
  check)
    check "${2:?wallet address}" ;;
  attest)
    load_key; attest_one "${2:?wallet address}" ;;
  attest-file)
    f="${2:?file of wallet addresses}"
    addrs=("${(@f)$(sed -e 's/#.*//' -e 's/[[:space:]]//g' "$f" | grep -v '^$')}")
    for a in "${addrs[@]}"; do checksum "$a" >/dev/null; done   # stop before sending anything if one line is bad
    print "${#addrs} addresses; wallet balance $(cast balance "$ATTESTER" --rpc-url "$RPC" --ether) ETH"
    load_key
    for a in "${addrs[@]}"; do attest_one "$a"; done ;;
  register|revoke)
    if [[ "$cmd" == register ]]; then sig='register()'; else sig='revoke()'; export ATTESTATION_UID="${2:?attestation id}"; fi
    load_key
    if [[ -n "${DRY:-}" ]]; then
      forge script script/EasMember.s.sol:EasMember --sig "$sig" --rpc-url "$RPC" 2>&1 | grep -E 'schema|revoked|0x|Error|revert'
    else
      forge script script/EasMember.s.sol:EasMember --sig "$sig" --rpc-url "$RPC" --broadcast --slow --skip-simulation 2>&1 | grep -E 'schema|revoked|ONCHAIN EXECUTION|Error|revert'
    fi ;;
  *) print -u2 "usage: zsh eas-member.zsh register | check <wallet> | attest <wallet> | attest-file <file> | revoke <uid>"; exit 2 ;;
esac
unset PRIVATE_KEY
