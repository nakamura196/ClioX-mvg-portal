#!/usr/bin/env zsh
# Local end-to-end check of the green reward, on a throwaway anvil chain:
#   deploy PLAY (GreenFeeDemo) + GreenReward -> a sponsor deposits 1,000 PLAY
#   -> the checker reads a REAL finished job from cliox-node.ldas.jp and signs
#   -> someone submits the claim -> the job owner's PLAY balance goes up.
# Nothing touches Sepolia. Keys: anvil's published dev keys and a throwaway
# checker key made here (not saved).
# Usage: zsh try-reward-local.zsh <jobId>
set -euo pipefail
JOB="${1:?usage: try-reward-local.zsh <jobId>}"
cd "${0:A:h}"
PORT=8645
lsof -ti tcp:$PORT >/dev/null && { print "✗ port $PORT is taken"; exit 1; }
anvil --port $PORT --silent & ANVIL=$!
trap 'kill $ANVIL 2>/dev/null' EXIT
i=0; until cast chain-id --rpc-url http://127.0.0.1:$PORT >/dev/null 2>&1 || (( i++ > 30 )); do sleep 0.3; done
RPC=http://127.0.0.1:$PORT
# anvil's well-known dev account 0 (deployer/sponsor); a throwaway submitter
K0=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
K1=0x$(openssl rand -hex 32)
cast rpc anvil_setBalance $(cast wallet address --private-key $K1) 0x8AC7230489E80000 --rpc-url $RPC >/dev/null
export GREEN_REWARD_CHECKER_KEY=0x$(openssl rand -hex 32)
CHECKER=$(cast wallet address --private-key $GREEN_REWARD_CHECKER_KEY)

print "▶ Deploy PLAY and GreenReward (1 PLAY per mg, at most 500 PLAY per job)"
PLAY=$(forge create src/GreenFeeDemo.sol:GreenFeeDemo --rpc-url $RPC --private-key $K0 --broadcast 2>/dev/null | awk '/Deployed to/ {print $3}')
RW=$(forge create src/GreenReward.sol:GreenReward --rpc-url $RPC --private-key $K0 --broadcast --constructor-args $CHECKER $PLAY 1000000 500000000 2>/dev/null | awk '/Deployed to/ {print $3}')
print "  PLAY $PLAY"; print "  GreenReward $RW (checker $CHECKER)"
cast send $PLAY 'faucet()' --rpc-url $RPC --private-key $K0 >/dev/null
cast send $PLAY 'transfer(address,uint256)' $RW 1000000000 --rpc-url $RPC --private-key $K0 >/dev/null
print "  pool: $(( $(cast call $PLAY 'balanceOf(address)(uint256)' $RW --rpc-url $RPC | awk '{print $1}') / 1000000 )) PLAY"

print "▶ Checker reads job $JOB from the node and signs"
Q=$(node script/quote-reward.mjs "$JOB" $(cast chain-id --rpc-url $RPC) $RW 2>/dev/null)
print -r -- "$Q" | python3 script/show-quote.py
read -r JH TO CK HK CU HU EX SIG <<<"$(print -r -- "$Q" | python3 -c 'import json,sys; q=json.load(sys.stdin); c=q["claim"]; print(c["jobIdHash"],c["recipient"],c["chosenKey"],c["highestKey"],c["chosenUg"],c["highestUg"],c["expiry"],q["signature"])')"
unset GREEN_REWARD_CHECKER_KEY

before=$(cast call $PLAY 'balanceOf(address)(uint256)' $TO --rpc-url $RPC | awk '{print $1}')
print "▶ Someone else (a throwaway wallet) submits the claim"
cast send $RW 'claim(bytes32,address,string,string,uint64,uint64,uint64,bytes)' $JH $TO $CK $HK $CU $HU $EX $SIG --rpc-url $RPC --private-key $K1 >/dev/null
after=$(cast call $PLAY 'balanceOf(address)(uint256)' $TO --rpc-url $RPC | awk '{print $1}')
print "  owner's PLAY: $before → $after (+$(python3 -c "print(($after-$before)/1e6)") PLAY)"

print "▶ Second claim for the same job"
if cast send $RW 'claim(bytes32,address,string,string,uint64,uint64,uint64,bytes)' $JH $TO $CK $HK $CU $HU $EX $SIG --rpc-url $RPC --private-key $K1 >/dev/null 2>&1; then print "✗ paid twice"; exit 1; else print "  refused (AlreadyClaimed) ✓"; fi
print "▶ Claimed event"
cast logs --from-block 0 --address $RW --rpc-url $RPC 'Claimed(bytes32 indexed,address indexed,string,string,uint64,uint64,uint256)' 2>/dev/null | grep -E 'topics|data' -A0 | head -4 | sed 's/^/  /'
print "✓ done (anvil stopped on exit)"
