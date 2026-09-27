# Clio-X trial: sample record and free compute job

A reproducible example for the Sepolia trial (`cliox-node.ldas.jp`): publish one
public-domain document and one small analysis, then run the analysis on the
document without the document leaving the node.

| File                                               | What it is                                                                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `sample/declaration-of-independence.txt`           | The dataset: US Declaration of Independence, Project Gutenberg #1, body only (public domain)                                          |
| `algorithm/word_frequency.py`                      | The analysis: top 20 words per document, Python standard library only                                                                 |
| `metadata/dataset.json`, `metadata/algorithm.json` | Asset descriptions for the Ocean CLI. File URLs are pinned to a commit, so the published record keeps pointing at exactly these bytes |
| `cli.zsh`                                          | Runs the official `@oceanprotocol/cli` (pinned 2.1.0) with the trial wallet's key from 1Password                                      |

## Steps

```zsh
cd deploy/trial && npm ci && cd -
export RPC=https://ethereum-sepolia-rpc.publicnode.com   # Tenderly's public RPC answered 429 to the CLI
zsh deploy/trial/cli.zsh getComputeEnvironments
zsh deploy/trial/cli.zsh publish metadata/dataset.json          # file path is positional
zsh deploy/trial/cli.zsh publishAlgo metadata/algorithm.json
zsh deploy/trial/cli.zsh startFreeCompute <dataset did> <algorithm did> <env id>
zsh deploy/trial/cli.zsh getJobStatus <dataset did> <job id>
zsh deploy/trial/cli.zsh downloadJobResults <job id> <index of outputs.tar> ./results
```

The wallet must hold some Sepolia ETH (publishing writes to the chain) and be in
the node's `C2D_ALLOWED_ADDRESSES` for the free compute job.

## First run (2026-09-26)

|           |                                                                                                                       |
| --------- | --------------------------------------------------------------------------------------------------------------------- |
| Dataset   | `did:op:04f79245ba012ab323600b60bb537c865560ca18867025a3d31b38f4560b9787`                                             |
| Algorithm | `did:op:fdefde90da7983f083b54c0939b719cb69dac21bff6e5cc4a343d2f6a033daa4`                                             |
| Job       | free, 1 CPU / 1 GiB, exit code 0                                                                                      |
| Result    | 1,338 words; top: people 10, laws 9, states 8, right 7, government 6 — identical to a local run in the same container |

## Known problems

**`--encrypt false` does not work with ocean-cli 2.1.0 and Ocean Node 4.2.0.**
The CLI hashes the description _including_ `indexedMetadata`; the node removes
`indexedMetadata` before checking the hash, so it rejects the asset
("Unencrypted DDO hash does not match metadata hash"). The CLI also needs
`indexedMetadata.nft` for the NFT name, so it cannot simply be left out. The
official example files have the same problem. Our two rejected attempts:
`did:op:1b7475e5…` and `did:op:cbf4ab55…`. Publish encrypted until this is fixed
upstream.

**The node must be able to reach its own public URL.** An encrypted asset is
decrypted by calling the URL recorded on chain, here the node itself through
Cloudflare. Bot protection on the zone blocked the VM (403 challenge) until a
WAF skip rule for the VM's addresses was added
(`../ocean-node/scripts/cloudflare-allow-node.zsh`).
