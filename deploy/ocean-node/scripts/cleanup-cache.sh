#!/bin/sh
# Weekly cleanup on the Ocean Node VM (installed by install-cleanup.zsh; runs from cron).
#
# Why: graph-node keeps every Sepolia block it reads in the table chain1.blocks.
# On 2026-11-27 this table was 40 GB of the 99 GB disk (97 % full); the subgraph's
# own data was a few MB. The cache grows by about 0.9 GB a day (≈120 KB a block,
# ≈7,200 blocks a day). graph-node reads blocks again when it needs them, so
# emptying the cache does not lose the index.
#
# What it does:
#   1. graphman chain truncate sepolia (empties the block cache)
#   2. removes Docker images unused for 7 days and the build cache
# It prints the free space before and after. Nothing else is touched.
set -eu

echo "== $(date -u +%FT%TZ) cleanup start"
df -h / | tail -1

if docker ps --format '{{.Names}}' | grep -qx ocean-graph-node; then
  # graphman needs a config file. The password stays in the container's
  # environment: graph-node expands ${...} itself, so it is never written out.
  docker exec -i ocean-graph-node sh -c 'cat > /tmp/gm.toml' <<'EOF'
[store]
[store.primary]
connection = "postgresql://${postgres_user}:${postgres_pass}@${postgres_host}/${postgres_db}"
pool_size = 2

[chains]
ingestor = "none"
[chains.sepolia]
shard = "primary"
provider = [ { label = "sepolia", url = "https://sepolia.gateway.tenderly.co", features = [] } ]

[deployment]
[[deployment.rule]]
indexers = ["default"]
EOF
  docker exec ocean-graph-node graphman --config /tmp/gm.toml chain truncate --force sepolia
  docker exec ocean-graph-node rm -f /tmp/gm.toml
else
  echo "ocean-graph-node is not running; block cache left as is"
fi

docker image prune -a -f --filter "until=168h" | tail -1
docker builder prune -a -f --filter "until=168h" | tail -1

df -h / | tail -1
echo "== $(date -u +%FT%TZ) cleanup done"
