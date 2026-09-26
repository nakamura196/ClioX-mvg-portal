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
zsh deploy/trial/cli.zsh getComputeEnvironments
zsh deploy/trial/cli.zsh publish --file metadata/dataset.json --encrypt false
zsh deploy/trial/cli.zsh publishAlgo --file metadata/algorithm.json --encrypt false
zsh deploy/trial/cli.zsh startFreeCompute --datasets <dataset did> --algo <algorithm did> --env <env id>
zsh deploy/trial/cli.zsh getJobStatus <dataset did> <job id>
zsh deploy/trial/cli.zsh downloadJobResults <job id> 1 ./results
```

The wallet must hold some Sepolia ETH (publishing writes to the chain) and be in
the node's `C2D_ALLOWED_ADDRESSES` for the free compute job.

`--encrypt false` publishes the description unencrypted. The file location is
still sealed by the node. An unencrypted description stays readable in every
catalogue even if the publishing node closes; see
[../../docs/for-archivists/when-a-node-closes.md](../../docs/for-archivists/when-a-node-closes.md).
