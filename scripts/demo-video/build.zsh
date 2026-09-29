#!/usr/bin/env zsh
# Records the Clio-X demo video (script.json) from a running portal.
#
# Needs: a dev server of this branch (default http://localhost:8140), ffmpeg,
# and a Chromium headless shell (Playwright's; override with CHROMIUM_PATH).
# Playwright itself is not a dependency of the portal, so it is installed
# into a throw-away folder unless PLAYWRIGHT_DIR points at one that has it.
#
# Usage: zsh scripts/demo-video/build.zsh [base-url] [out-dir]
# Output: <out-dir>/clio-x-first-look.mp4 and captions.{en,ja}.vtt
set -euo pipefail

here=${0:A:h}
base=${1:-http://localhost:8140}
out=${2:-$here/../../docs/prototypes/demo-video/out}

if [[ -z ${PLAYWRIGHT_DIR:-} ]]; then
  PLAYWRIGHT_DIR=$(mktemp -d)
  npm install --prefix $PLAYWRIGHT_DIR --no-save --ignore-scripts playwright@1.55.0 >/dev/null
fi
export PLAYWRIGHT_DIR

node $here/record.mjs $base ${out:A}
ls -la ${out:A}/*.mp4 ${out:A}/*.vtt
