# One-shot image that builds the Ocean subgraph for Sepolia and deploys it to
# the graph-node running next to it. Nothing is installed on the host.
#
#   docker compose --profile deploy-subgraph run --rm subgraph-deployer
#
# Pinned to the upstream commit this setup was tested with.
FROM node:20-bookworm-slim

ARG OCEAN_SUBGRAPH_REF=2f322ee016ae7ba190d47e745234508a04bb6d4c

RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /build
RUN git clone https://github.com/oceanprotocol/ocean-subgraph.git . \
 && git checkout "$OCEAN_SUBGRAPH_REF" \
 && npm ci --ignore-scripts

# 1. Fall back to reading templateId from the chain (see the patch header).
# 2. Skip Dispenser / FixedRateExchange events for entities created before
#    startBlock; otherwise the subgraph stops for good (see the patch header).
# 3. Use a Sepolia manifest whose startBlock is truncated to 11459550 and that
#    declares the Dispenser singleton as a static data source, so pricing is
#    indexed without replaying from the Ocean deployment block (3722802).
# 4. Optional graft: continue from an existing deployment at a given block
#    instead of re-indexing from startBlock (both build args must be set).
ARG GRAFT_BASE=
ARG GRAFT_BLOCK=
COPY template-id-fallback.patch skip-unknown-singletons.patch subgraph.sepolia.yaml ./
RUN git apply template-id-fallback.patch skip-unknown-singletons.patch \
 && cp subgraph.sepolia.yaml subgraph.yaml \
 && if [ -n "$GRAFT_BASE" ] && [ -n "$GRAFT_BLOCK" ]; then \
      sed -i "/^schema:/i features:\\n  - grafting\\ngraft:\\n  base: $GRAFT_BASE\\n  block: $GRAFT_BLOCK" subgraph.yaml; \
    fi \
 && npx graph codegen --output-dir src/@types \
 && npx graph build

ENV GRAPH_NODE_ADMIN=http://graph-node:8020 \
    IPFS_API=http://ipfs:5001 \
    SUBGRAPH_NAME=oceanprotocol/ocean-subgraph

# `graph create` fails harmlessly when the name already exists.
CMD ["sh", "-c", "npx graph create \"$SUBGRAPH_NAME\" --node \"$GRAPH_NODE_ADMIN\" || true; npx graph deploy \"$SUBGRAPH_NAME\" subgraph.yaml --version-label \"v$(node -p 'require(\"./package.json\").version')-$(date +%Y%m%d%H%M)\" --ipfs \"$IPFS_API\" --node \"$GRAPH_NODE_ADMIN\""]
