#!/usr/bin/env zsh
# Turn on the chatbot for the portal's /usecases/chatbot page.
# Run this yourself; it needs the 1Password CLI (`op`) signed in and the
# Vercel CLI logged in.
#
# What it does (safe to re-run; an existing key is reused):
#   1. Has 1Password generate a random shared key ("Clio-X chatbot API key",
#      field password) unless it exists. The key is never printed, never
#      written to local disk and never passed as a command-line argument.
#   2. Writes CHATBOT_API_KEY into /opt/cliox-node/.env on the VM, so the next
#      deploy.zsh starts the chatbot + ollama services (profile chatbot).
#   3. Sets CHATBOT_API_URL and CHATBOT_API_KEY on the portal's Vercel project
#      (production + preview), which the portal's /api/chatbot/* routes use.
#
# Usage (from the repository root):
#   zsh deploy/ocean-node/scripts/setup-chatbot.zsh <ssh-host> <chatbot-url> <vercel-project-id> <vercel-team-id>
# Example:
#   zsh deploy/ocean-node/scripts/setup-chatbot.zsh mdx-clio https://cliox-chat.ldas.jp prj_pozX5pjVyiJIodyY2ND4ThS6qmAO team_bUBMO2iuHUM5l0Mt1UJ9Kt9U
#
# Then: zsh deploy/ocean-node/scripts/deploy.zsh <ssh-host>   (starts it and pulls the model)
# and redeploy the portal so the functions see the new variables.
set -euo pipefail

HOST="${1:?ssh host}"; URL="${2:?chatbot url}"; PROJECT="${3:?vercel project id}"; TEAM="${4:?vercel team id}"
VAULT="${OP_VAULT:-Personal}"
ITEM="Clio-X chatbot API key"
REMOTE_DIR=/opt/cliox-node

if ! op item get "$ITEM" --vault "$VAULT" >/dev/null 2>&1; then
  # 1Password generates the value itself, so it never exists outside it.
  op item create --category Password --vault "$VAULT" --title "$ITEM" \
    --generate-password='letters,digits,64' \
    "notesPlain=用途: ポータルの /api/chatbot/* からチャットボット（$HOST の cliox-chatbot）を呼ぶ共有鍵 | 使用先: $HOST の .env CHATBOT_API_KEY / Vercel $PROJECT | 範囲: このサービスだけ" >/dev/null
  print "  created 1Password item: $ITEM"
fi
KEY="$(op item get "$ITEM" --vault "$VAULT" --fields label=password --reveal | tr -d '\r\n ')"
[[ ${#KEY} -eq 64 ]] || { print "✗ key has unexpected length ${#KEY}"; unset KEY; exit 1 }

printf '%s\n' "$KEY" | ssh -o BatchMode=yes "$HOST" "
  set -e; cd $REMOTE_DIR; umask 077; touch .env; chmod 600 .env
  read -r k
  sed -i '/^CHATBOT_API_KEY=/d' .env
  printf 'CHATBOT_API_KEY=%s\n' \"\$k\" >> .env
  echo \"  VM: CHATBOT_API_KEY written (\${#k} chars)\"
"

# vercel api reads the request body from stdin, so the key does not appear in
# the process list.
put_env() {
  local name=$1 value=$2 type=$3
  jq -n --arg k "$name" --arg v "$value" --arg t "$type" \
    '{key:$k, value:$v, type:$t, target:["production","preview"]}' |
    vercel api "/v10/projects/$PROJECT/env?teamId=$TEAM&upsert=true" -X POST --input - >/dev/null
  print "  Vercel: $name set"
}
put_env CHATBOT_API_URL "$URL" plain
put_env CHATBOT_API_KEY "$KEY" encrypted
unset KEY
print "✓ done. Next: zsh deploy/ocean-node/scripts/deploy.zsh $HOST, then redeploy the portal"
