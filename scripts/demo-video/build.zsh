#!/usr/bin/env zsh
# Records a Clio-X demo video from a running portal.
#
# Needs: a dev server of this branch, ffmpeg, and a Chromium headless shell
# (Playwright's; the newest one in ~/Library/Caches/ms-playwright is used
# unless CHROMIUM_PATH is set). Playwright itself is not a dependency of the
# portal, so it is installed into a throw-away folder unless PLAYWRIGHT_DIR
# points at one that has it.
#
# Usage: zsh scripts/demo-video/build.zsh <script.json> [base-url] [out-dir] [langs]
#   e.g. zsh scripts/demo-video/build.zsh scripts/demo-video/green-fee.json http://localhost:3011
# Output: <out-dir>/<name>.<lang>.mp4 and its caption files, one per language (default: en ja)
set -euo pipefail

here=${0:A:h}
script=${1:A}
base=${2:-http://localhost:8140}
out=${3:-$here/../../docs/prototypes/demo-video/out}
langs=(${=${4:-en ja}})

if [[ -z ${CHROMIUM_PATH:-} ]]; then
  shells=(~/Library/Caches/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-mac-arm64/chrome-headless-shell(N))
  (( ${#shells} )) || { print -u2 "no Chromium headless shell found; set CHROMIUM_PATH"; exit 1 }
  export CHROMIUM_PATH=${shells[-1]}
fi
if [[ -z ${PLAYWRIGHT_DIR:-} ]]; then
  PLAYWRIGHT_DIR=$(mktemp -d)
  npm install --prefix $PLAYWRIGHT_DIR --no-save --ignore-scripts playwright@1.55.0 >/dev/null
fi
export PLAYWRIGHT_DIR

mkdir -p ${out:A}
for lang in $langs; do
  node $here/record.mjs $base ${out:A} $script $lang
done
ls -la ${out:A}/*.mp4
