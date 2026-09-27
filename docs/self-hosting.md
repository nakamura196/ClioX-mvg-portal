# Self-hosting Clio-X on Sepolia

This guide runs your own copy of Clio-X against the Sepolia test network,
independent of the Pontus-X network and its membership. It has three parts:

| Part           | What it does                                                      | Where it runs                          |
| -------------- | ----------------------------------------------------------------- | -------------------------------------- |
| **Portal**     | The Clio-X web app (this repository)                              | Any serverless host (Vercel free tier) |
| **Ocean Node** | Catalogue (metadata cache), provider, Compute-to-Data             | A small Linux VM with Docker           |
| **Subgraph**   | Indexes Ocean contract events the portal queries (prices, orders) | Same VM                                |

Everything on the VM runs in Docker. The files are in
[`deploy/ocean-node/`](../deploy/ocean-node/).

> Status (2026-09-26): all steps are done on an mdx VM (University of
> Tokyo, Ubuntu 24.04, 6 vCPU / 8.8 GiB / 99 GB) and Vercel.

## What is official, and what this setup adds

Read this first if you want to know which parts you can rely on upstream for.

**Official, used as-is** (Ocean Protocol, unmodified)

| Component                                                      | Notes                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `oceanprotocol/ocean-node:4.2.0`                               | All settings in `docker-compose.yml` are documented node options: `RPCS`, `INDEXER_NETWORKS`, `DB_TYPE`, `DOCKER_COMPUTE_ENVIRONMENTS` with its `free`, `fees` and `access` fields, `POLICY_SERVER_URL`                                                  |
| Ocean contracts on Sepolia                                     | Official deployment. The node uses the address list bundled in its image (`@oceanprotocol/contracts` 2.9.0): ERC721Factory `0xEF62…BeB1`, Router `0x2112…Fde5`, Dispenser `0x2720…893C`, FixedPrice `0x80E6…BaA8`, AccessListFactory `0x43eC…27E7`       |
| `graphprotocol/graph-node`, IPFS (kubo), PostgreSQL, Typesense | Standard images                                                                                                                                                                                                                                          |
| Access control for compute                                     | All three mechanisms are built into Ocean Node: an address list, on-chain access lists (member tokens minted from AccessListFactory), and a policy server that checks verifiable credentials (this is how Pontus-X gates access with Gaia-X credentials) |

**From Clio-X upstream** (`ciferresearch/ClioX-mvg-portal`): the portal, and
its configuration for the Pontus-X networks.

**Added by this setup** (this fork; not in Ocean or Clio-X upstream)

| What                                                                                                   | Why                                                                                                                         | Where                                                              |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| A Sepolia network entry in the portal                                                                  | Lets people try Clio-X without Pontus-X membership. Pontus-X remains the production network; this path is for trials only   | `chains.config.js`                                                 |
| Running our own Ocean Node and subgraph                                                                | Sepolia has no public Ocean Node or subgraph we can use for Clio-X                                                          | `deploy/ocean-node/`                                               |
| Subgraph starting at block 11,459,550, with a static Dispenser data source and a `templateId` fallback | Syncing from the Ocean deployment block takes days on free RPCs. The two fixes are needed for the shortcut to work (step 4) | `deploy/ocean-node/subgraph/` (patch to upstream `ocean-subgraph`) |
| Compute policy: free jobs only, one address list, no network, 2 CPU / 2 GiB                            | Our choice of the official options, because the node controls the VM's Docker. It is not an Ocean default                   | `DOCKER_COMPUTE_ENVIRONMENTS`                                      |
| Processing location and carbon/cost estimate                                                           | Clio-X's sustainability work; the location is read from the environment's description text                                  | `src/@utils/computeFootprint.ts`                                   |
| mdx VM, Cloudflare Tunnel, deploy and secret scripts                                                   | How we host it; replace with your own infrastructure                                                                        | `deploy/ocean-node/scripts/`                                       |

## Who may run compute

The node refuses compute jobs from wallets that are not allowed. Browsing the
catalogue and publishing are not affected; they happen on the chain.
Ocean Node offers three official ways to decide who is allowed; this setup
currently uses the first.

1. **Address list** (`access.addresses`). Edit `C2D_ALLOWED_ADDRESSES` and
   re-run `push-node-secrets.zsh` + `deploy.zsh`. Fine for a handful of people.
2. **On-chain access list** (`access.accessLists`). A contract created from the
   official AccessListFactory; each member gets a non-transferable token. The
   list is managed on chain, so adding a member needs no change on the server,
   and several nodes can share one list (for example, one list for all
   participating institutions).
3. **Policy server** (`POLICY_SERVER_URL`). Checks verifiable credentials
   before accepting a job. This is the Pontus-X model.

Charging for compute (`fees`) is also official, but on Sepolia the tokens are
free, so it does not limit anyone.

## 1. The VM

Minimum that works: **6 GiB RAM, 2 vCPU, 40 GB disk**. We use 8.8 GiB so a
compute job can have 2 GiB. Install Docker Engine with the compose plugin and
add your SSH user to the `docker` group. No inbound port has to be opened:
the public endpoints come from a Cloudflare Tunnel (step 5).

Pinned images (`docker-compose.yml`): `ocean-node:4.2.0`, `typesense:26.0`,
`graph-node:v0.45.0`, `kubo:v0.43.1`, `postgres:14`, `cloudflared:2026.9.3`.
About 5 GB of images in total.

## 2. Secrets

`/opt/cliox-node/.env` on the VM holds all secrets (mode 600). It is never
committed and never copied back. See [`.env.example`](../deploy/ocean-node/.env.example).

- `TYPESENSE_API_KEY`, `GRAPH_POSTGRES_PASSWORD` are generated on the VM by
  the deploy script.
- `PRIVATE_KEY` is the node's identity and provider key (`0x` + 64 hex). It
  needs no funds. **If you move an existing node, reuse its key**: the file
  URLs of assets published through that node are encrypted to it, and nobody
  can run compute on them with a new key.
- `C2D_ALLOWED_ADDRESSES` is the list of wallets that may run compute jobs.

```zsh
zsh deploy/ocean-node/scripts/push-node-secrets.zsh <ssh-host> "<1Password item>" <field> '["0xYourWallet"]'
```

The script reads the key from 1Password and sends it over SSH stdin, so it
never appears on screen, in shell history, or on your disk.

## 3. Start the node and the subgraph

```zsh
zsh deploy/ocean-node/scripts/deploy.zsh <ssh-host>
zsh deploy/ocean-node/scripts/deploy.zsh <ssh-host> subgraph   # first time, and after changing the subgraph
zsh deploy/ocean-node/scripts/deploy.zsh <ssh-host> status
```

The subgraph is built inside a container on the VM
(`deploy/ocean-node/subgraph/Dockerfile`); you don't need Node.js or
`graph-cli` locally.

## 4. Things that cost us time

**Compute runs through the host's Docker socket.** The node starts job
containers via `/var/run/docker.sock`, which is root-equivalent on that VM.
Put the node on its own VM, not next to other services. On top of that the
compose file allows free jobs only (no fee section, so nobody can pay their way
in), only for `C2D_ALLOWED_ADDRESSES`, with no network inside jobs.

**The RPC for the node's indexer must accept wide `eth_getLogs` ranges.**
Measured in 2026-08: publicnode rejects address-less `eth_getLogs`, the Alchemy
free tier allows 10 blocks, 1rpc.io 50 blocks. Tenderly's public gateway
returns 10,000 blocks in about 300 ms. When a range is rejected, the indexer
still moves its head forward, so the asset is silently never indexed.

**The RPC for graph-node must serve archive state.** The subgraph mappings call
contracts at past blocks; publicnode fails with "historical state is not
available".

**`DB_TYPE=typesense` must be set explicitly.** The default is Elasticsearch,
and without its credentials the indexer is disabled.

**Truncating the subgraph's `startBlock` needs two fixes.** Syncing Sepolia
from the Ocean deployment block (3,722,802) takes days on free RPCs. Starting at
11,459,550 (just before our first publish) syncs in minutes, but:

1. `Dispenser` is only a _template_, created by an event at deployment time.
   Without it, asset pages show "No pricing schema available for this asset."
   On Sepolia it is a fixed contract, so `subgraph.sepolia.yaml` declares it as
   a static data source.
2. The NFT/datatoken `templateId` is stored only when the template-registration
   events are seen; otherwise it is 0 and the portal cannot start an order or a
   compute job. `template-id-fallback.patch` reads it from the chain instead.

`opcs` stays empty with the truncated start; the portal only logs this.

**Hostnames with two levels (`a.b.example.org`) get no certificate** on
Cloudflare's free Universal SSL. Use one level below the zone.

**The node must be able to reach its own public URL.** To index an encrypted
asset, the node calls the decryptor URL recorded on chain, which is its own
public URL. That request leaves the VM and comes back through Cloudflare. Bot
protection (Super Bot Fight Mode) treated the VM's data-centre addresses as
bots and answered with a challenge (403, `cf-mitigated: challenge`), so newly
published encrypted assets were never indexed. The node log only says
"Provider validation failed: Forbidden". Test from the VM with
`curl -s -o /dev/null -w "%{http_code}" https://<node hostname>/` (expect 200).
Super Bot Fight Mode cannot be turned off per hostname, but a WAF custom rule
with the action "Skip" for the VM's addresses can skip it:
`scripts/cloudflare-allow-node.zsh`. Other servers calling the node API (other
nodes, serverless functions) are likely challenged in the same way.

**`--encrypt false` in ocean-cli 2.1.0 is rejected by Ocean Node 4.2.0** (hash
mismatch caused by `indexedMetadata`). See `deploy/trial/README.md`.

**The node must start after Typesense is ready.** The node creates its
collections (`indexer`, `op_ddo_*`) only when a lookup answers "not found". If
Typesense is still starting, the lookup fails in another way and nothing is
created. The indexer then cannot save its position and starts again from
`startBlock` every ~90 seconds; search answers 500 and the portal shows
"0 results". The log says `Error updating last indexed block ... Not Found`.
The compose file now waits for Typesense's `/health` before starting the node.
If you see this on an older setup, restart only the node:
`docker compose restart ocean-node`.

**Assets published through another node cannot be moved to yours.** When the
indexer meets an encrypted asset, it asks the node recorded on chain at publish
time (a URL) to decrypt it. It never tries its own key, even if the key is the
same. If that node is gone, the asset is never indexed, and its
`serviceEndpoint` still points at the old node, so orders and compute jobs
would fail anyway. Publish the assets again through the new node. Each dead
URL also costs the indexer about 20 seconds of time-outs per event while it
catches up.
Publish under a hostname you control (not an IP address), so a replacement
node with the same key can take over. For archivists, the same point is
explained in [for-archivists/when-a-node-closes.md](for-archivists/when-a-node-closes.md).

## 5. Public endpoints (Cloudflare Tunnel)

The VM opens no inbound port besides SSH. `cloudflared` dials out to
Cloudflare, and Cloudflare forwards HTTPS requests back through that
connection. The routing is in `deploy/ocean-node/cloudflared/config.yml`:
node → `http://ocean-node:8001`, subgraph → `http://graph-node:8000`
(the graph-node admin port is not exposed). Change the hostnames to your zone.

With `cloudflared` logged in to the zone and `op` signed in:

```zsh
zsh deploy/ocean-node/scripts/setup-tunnel.zsh <ssh-host> cliox-node
zsh deploy/ocean-node/scripts/deploy.zsh <ssh-host>
```

The first script creates the tunnel and the DNS records, saves the connector
token in 1Password, and writes it to the VM's `.env` as
`CLOUDFLARE_TUNNEL_TOKEN`. `deploy.zsh` starts `cloudflared` once that is set.

mdx blocks outbound UDP, so the default QUIC transport never connects and the
hostnames answer with Cloudflare error 1033. The compose file therefore runs
`cloudflared` with `--protocol http2` (TCP 443).

## 6. Portal

The Sepolia entry in `chains.config.js` points to the two hostnames
(`providerUri`, `providers`, `metadataCacheUri`, `subgraphUri`). Its provider
address must be the node's (`GET /` on the node returns `providerAddress`).

On Vercel (Hobby plan):

1. Import the repository (your fork). Framework: Next.js, detected.
2. Node.js version **22.x**. The app declares `"engines": {"node": "22"}`;
   newer versions break server-side rendering.
3. Environment variable `NEXT_PUBLIC_METADATACACHE_URI` = the node URL. The
   catalogue search reads it before `chains.config.js`, and its default is
   the Pontus-X catalogue.
   The portal treats any URL without "aquarius" in it as an Ocean Node and
   applies the search filters itself, because Ocean Node answers an empty list
   to Elasticsearch `term`/`terms` filters. Set
   `NEXT_PUBLIC_METADATACACHE_OCEAN_NODE=true` or `false` to override.
4. Leave Vercel Authentication (Deployment Protection) on while the site is
   not meant to be public. Only members of the Vercel account can open it.
   On the Hobby plan it does **not** cover the production domain
   (`<project>.vercel.app`), which stays open to everyone. Remove that domain
   under Settings → Domains until you want the site public.

## 7. Processing location for the carbon estimate

The portal derives the processing location from the compute environment's
description text; Ocean Node publishes environment ids as hashes, so the id
cannot be used. `src/@utils/computeFootprint.ts` already maps any description
containing `mdx` to "mdx, Kashiwa II campus, Japan". No carbon figure is shown
for it yet: that needs the VM's measured power draw, and we only enter
measured or clearly labelled values.
