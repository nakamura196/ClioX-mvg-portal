#!/usr/bin/env zsh
# Let the portal's server functions (Vercel) reach the chatbot through Cloudflare.
#
# Why: the portal's /api/chatbot/* routes run on Vercel and call
# https://cliox-chat.ldas.jp from data-centre addresses. Bot protection on
# ldas.jp answers them with a challenge (measured 2026-09-27: the portal's
# /api/chatbot/health returned "Health check failed: Forbidden"), the same way
# it blocked the node VM (see cloudflare-allow-node.zsh).
# Vercel's addresses are not fixed, so the rule is by hostname only. The
# chatbot itself refuses every request without the X-Chatbot-Key header
# (only /api/health answers without it), so opening the hostname does not open
# the service.
#
# What it does: adds one WAF custom rule (action "skip") to zone ldas.jp for
# host cliox-chat.ldas.jp, skipping the same products as the node rule.
# Running it twice does not add a second rule.
#
# Prerequisites: 1Password item "Cloudflare scan protection" (Zone WAF Edit on ldas.jp).
# Usage:   zsh deploy/ocean-node/scripts/cloudflare-allow-chatbot.zsh
# Undo:    Cloudflare dashboard → Security → WAF → Custom rules → delete "allow: cliox-chat …"
set -euo pipefail

HOST=cliox-chat.ldas.jp
DESC="allow: cliox-chat (Clio-X trial chatbot, called by the portal on Vercel) 2026-09-27 — サービス側で鍵を確認する。チャットボットを止めたら消すこと"
EXPR="(http.host eq \"$HOST\")"

TOK=$(op item get "Cloudflare scan protection" --fields credential --reveal | tr -d '\r\n')
API=https://api.cloudflare.com/client/v4
cf() { curl -s -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" "$@"; }

ZID=$(cf "$API/zones?name=ldas.jp" | python3 -c 'import json,sys;print(json.load(sys.stdin)["result"][0]["id"])')
EP=$(cf "$API/zones/$ZID/rulesets/phases/http_request_firewall_custom/entrypoint")
RS=$(print -r -- "$EP" | python3 -c 'import json,sys;print(json.load(sys.stdin)["result"]["id"])')

if print -r -- "$EP" | grep -q 'allow: cliox-chat'; then
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
    if "cliox-chat" in (r.get("description") or ""):
        print("added:", r["id"], r["expression"])
'
fi
unset TOK

print "▶ Checking through the portal (expect ollama_connected true, was Forbidden)"
sleep 5
curl -s -m 30 https://cliox.ldas.jp/api/chatbot/health; print
