#!/usr/bin/env zsh
# [local patch] Start `next dev` on port 3017 with the green reward checker key,
# so Profile → History → compute job → Details → "Receive the reward" works locally.
# The key is read from 1Password into the environment of the dev server only
# (never printed, never written to disk).
# Usage: zsh scripts/dev-green-reward.zsh
set -euo pipefail
cd "${0:A:h}/.."
GREEN_REWARD_CHECKER_KEY="$(op item get 'Clio-X Sepolia green reward checker' --vault Personal --fields private_key --reveal | tr -d '\n')"
[[ ${#GREEN_REWARD_CHECKER_KEY} -ge 64 ]] || { print "✗ checker key not read"; exit 1; }
export GREEN_REWARD_CHECKER_KEY
export NODE_OPTIONS=--no-experimental-webstorage NEXT_PUBLIC_METADATACACHE_URI=https://cliox-node.ldas.jp
exec npx next dev -p 3017
