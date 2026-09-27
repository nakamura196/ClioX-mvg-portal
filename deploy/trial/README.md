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

A second example uses real humanities data: the Kōi Genji monogatari TEI/XML, all
54 chapters (Digital Genji, CC0), see [below](#second-example-koi-genji-monogatari-tei).

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

## Second example: Kōi Genji monogatari TEI

The 54 chapter files of the Kōi Genji monogatari TEI/XML as one Compute asset,
and an analysis that returns, per chapter, the title, pages, lines, characters
and the 10 most frequent characters (JSON and CSV). The TEI never leaves the node.

| File                                                           | What it is                                                                                                                                                                                            |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sample/kouigenji-tei-f695a1af.tar.gz`                         | The dataset: `xml/master` of [kouigenjimonogatari.github.io](https://github.com/kouigenjimonogatari/kouigenjimonogatari.github.io) at commit `f695a1af`, 54 files, 1.0 MB, sha256 `b2df393a0b264aef…` |
| `algorithm/genji_profile.py`                                   | The analysis. Reads TEI files directly or from a `.tar.gz` / `.zip`. Python standard library only                                                                                                     |
| `metadata/genji-dataset.json`, `metadata/genji-algorithm.json` | Asset descriptions; file URLs pinned to a commit of this repository                                                                                                                                   |
| `genji.zsh`                                                    | Publishes both, waits for indexing, runs one free job and waits for it. One 1Password approval covers all steps                                                                                       |
| `deprecate.mjs`                                                | Marks older versions of an asset as deprecated (Ocean metadata state 2). The record stays on chain                                                                                                    |

The archive was made with

```zsh
git -C <kouigenji checkout> archive --format=tar --prefix=kouigenji-tei/ f695a1af xml/master | gzip -9n > deploy/trial/sample/kouigenji-tei-f695a1af.tar.gz
```

Run:

```zsh
zsh deploy/trial/genji.zsh
zsh deploy/trial/genji.zsh --deprecate <old dataset did> <old algorithm did>   # when replacing an earlier version
```

To publish your own TEI collection the same way: pack the files into one archive,
put it at a URL pinned to a commit, copy `genji-dataset.json`, and change
`metadata` and the file URL. Keep `compute.allowNetworkAccess: false`.

Expected result (checked locally in the same container with `--network none`):
54 chapters, 1,812 pages, 25,065 lines, 839,650 characters. The line count equals
the `itemTreeSize` recorded for the earlier access-only Genji asset.

### First attempt (2026-09-26): only chapter 1 was analysed

The first version listed the 54 files as 54 URLs in one asset
(`did:op:666877510595…`, algorithm `did:op:7358e0ea6873…`). The job finished, but
the result covered one chapter. The node's `configuration.log` shows why:

```
Downloading asset 0 to /data/inputs/
Downloading asset to ./c2d_storage/…/data/inputs/01.xml
```

Ocean Node 4.2.0 gave the job only the first file of the asset. Publishing the 54
files as one archive avoids this. The two first-attempt assets are to be marked
deprecated with `--deprecate`.

## Known problems

**`--encrypt false` does not work with ocean-cli 2.1.0 and Ocean Node 4.2.0.**
The CLI hashes the description _including_ `indexedMetadata`; the node removes
`indexedMetadata` before checking the hash, so it rejects the asset
("Unencrypted DDO hash does not match metadata hash"). The CLI also needs
`indexedMetadata.nft` for the NFT name, so it cannot simply be left out. The
official example files have the same problem. Our two rejected attempts:
`did:op:1b7475e5…` and `did:op:cbf4ab55…`. Publish encrypted until this is fixed
upstream.

**A job receives only the first file of an asset.** Observed with Ocean Node
4.2.0: an asset with 54 file URLs gave the job only `01.xml`. Publish a
multi-file collection as one archive (see the Genji example above).

**The node must be able to reach its own public URL.** An encrypted asset is
decrypted by calling the URL recorded on chain, here the node itself through
Cloudflare. Bot protection on the zone blocked the VM (403 challenge) until a
WAF skip rule for the VM's addresses was added
(`../ocean-node/scripts/cloudflare-allow-node.zsh`).
