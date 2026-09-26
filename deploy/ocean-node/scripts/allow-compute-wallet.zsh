#!/usr/bin/env zsh
# Allow more wallets to run free compute jobs on the node, then redeploy.
#
# Usage (from anywhere):
#   zsh deploy/ocean-node/scripts/allow-compute-wallet.zsh <ssh-host> <0xAddress> [<0xAddress> ...]
#
# What it does:
#   1. Adds the addresses to C2D_ALLOWED_ADDRESSES in /opt/cliox-node/.env on
#      the VM (a JSON list; addresses already listed are skipped). Only that one
#      line is read and changed; no secret is read or printed. A backup of the
#      file is kept as .env.bak (mode 600).
#   2. Runs deploy.zsh, which syncs the compose file and recreates the node so
#      the new list takes effect, then prints the list the node now reports.
set -euo pipefail

HOST="${1:?usage: allow-compute-wallet.zsh <ssh-host> <0xAddress> [...]}"
shift
(( $# > 0 )) || { print "✗ give at least one address"; exit 1; }
for a in "$@"; do
  [[ "$a" =~ '^0x[0-9a-fA-F]{40}$' ]] || { print "✗ not an address: $a"; exit 1; }
done

print "▶ Adding to C2D_ALLOWED_ADDRESSES on $HOST: $*"
ssh -o BatchMode=yes "$HOST" "cd /opt/cliox-node && umask 077 && cp -p .env .env.bak && ADDRS='$*' python3 -" <<'PY'
import json, os
path = ".env"
lines = open(path).read().splitlines()
new = os.environ["ADDRS"].split()
for i, line in enumerate(lines):
    if line.startswith("C2D_ALLOWED_ADDRESSES="):
        current = json.loads(line.split("=", 1)[1])
        for a in new:
            if any(c.lower() == a.lower() for c in current):
                print("  already listed:", a)
            else:
                current.append(a)
                print("  added:", a)
        lines[i] = "C2D_ALLOWED_ADDRESSES=" + json.dumps(current, separators=(",", ":"))
        open(path, "w").write("\n".join(lines) + "\n")
        print("  now:", ", ".join(current))
        break
else:
    raise SystemExit("C2D_ALLOWED_ADDRESSES not found in .env")
PY

zsh "${0:A:h}/deploy.zsh" "$HOST"

print "▶ Allowed addresses the node reports now"
curl -fsS -m 20 https://cliox-node.ldas.jp/api/services/computeEnvironments \
  | python3 -c 'import json,sys; [print("  ", a) for e in json.load(sys.stdin) for a in e.get("free",{}).get("access",{}).get("addresses",[])]'
