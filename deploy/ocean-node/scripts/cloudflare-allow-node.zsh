#!/usr/bin/env zsh
# Let the node VM reach its own public hostnames through Cloudflare.
# Created at the user's explicit request (2026-09-26).
#
# Why: the node decrypts encrypted assets by calling the decryptor URL recorded
# on chain, which is its own public URL (https://cliox-node.ldas.jp). That call
# leaves the VM and comes back through Cloudflare. On ldas.jp, Super Bot Fight
# Mode answers requests from the VM's data-centre addresses with a challenge
# (403, cf-mitigated: challenge), so encrypted assets never get indexed.
#
# What it does: adds one WAF custom rule (action "skip") to zone ldas.jp:
#   source = the VM's addresses, host = cliox-node / cliox-subgraph
#   skips   = Super Bot Fight Mode, security level, browser integrity check,
#             hotlink, UA block, zone lockdown (same scope as the existing
#             "home line" rule). Block rules in the same list still apply.
# Running it twice does not add a second rule.
#
# Prerequisites: 1Password item "Cloudflare scan protection" (Zone WAF Edit on ldas.jp).
# Usage:   zsh deploy/ocean-node/scripts/cloudflare-allow-node.zsh
# Undo:    Cloudflare dashboard → Security → WAF → Custom rules → delete "allow: mdx-clio …"
set -euo pipefail

V4=163.220.178.20
V6=2001:2f8:1041:2d3::/64
DESC="allow: mdx-clio (Clio-X Ocean Node, $V4 / $V6) 2026-09-26 — ノードが自分の公開URLへ復号を依頼するため。VM を廃止したら消すこと"
EXPR="(http.host in {\"cliox-node.ldas.jp\" \"cliox-subgraph.ldas.jp\"} and ip.src in {$V4 $V6})"

TOK=$(op item get "Cloudflare scan protection" --fields credential --reveal | tr -d '\r\n')
API=https://api.cloudflare.com/client/v4
cf() { curl -s -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" "$@"; }

ZID=$(cf "$API/zones?name=ldas.jp" | python3 -c 'import json,sys;print(json.load(sys.stdin)["result"][0]["id"])')
EP=$(cf "$API/zones/$ZID/rulesets/phases/http_request_firewall_custom/entrypoint")
RS=$(print -r -- "$EP" | python3 -c 'import json,sys;print(json.load(sys.stdin)["result"]["id"])')

if print -r -- "$EP" | grep -q 'allow: mdx-clio'; then
  print "✓ The rule already exists. Nothing changed."
else
  BODY=$(DESC="$DESC" EXPR="$EXPR" python3 -c '
import json, os
print(json.dumps({
  "description": os.environ["DESC"],
  "expression": os.environ["EXPR"],
  "action": "skip",
  "action_parameters": {"phases": ["http_request_sbfm"],
                        "products": ["securityLevel", "bic", "hot", "uaBlock", "zoneLockdown"]},
  "logging": {"enabled": True},
  "enabled": True
}, ensure_ascii=False))')
  cf -X POST -d "$BODY" "$API/zones/$ZID/rulesets/$RS/rules" | python3 -c '
import json, sys
d = json.load(sys.stdin)
print("success:", d.get("success"), d.get("errors") or "")
for r in (d.get("result") or {}).get("rules", []):
    if "mdx-clio" in (r.get("description") or ""):
        print("added:", r["id"])
        print("  ", r["expression"])
'
fi
unset TOK

print "▶ Checking from the VM (expect 200, was 403)"
ssh -o BatchMode=yes mdx-clio 'for f in -4 -6; do printf "  %s %s\n" "$f" "$(curl $f -s -o /dev/null -w "%{http_code}" -m 15 https://cliox-node.ldas.jp/)"; done'
