# CLI で登録と無償の計算

試用ノード（`cliox-node.ldas.jp`）で再現できる例です。
パブリックドメインの文書 1 件と小さな分析 1 件を登録し、文書をノードの外に出さずに分析を動かします。
英語の原文は [CLI: publish and free compute](/developers/trial-run) です。

| ファイル                                           | 中身                                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `sample/declaration-of-independence.txt`           | データセット。アメリカ独立宣言（Project Gutenberg #1、本文のみ、パブリックドメイン）              |
| `algorithm/word_frequency.py`                      | 分析。文書ごとの上位 20 語。Python の標準ライブラリのみ                                           |
| `metadata/dataset.json`, `metadata/algorithm.json` | CLI 用の資料の記述。ファイルの URL はコミットに固定してあり、登録した記述は常に同じバイト列を指す |
| `cli.zsh`                                          | 公式の `@oceanprotocol/cli`（2.1.0 に固定）を、1Password にある試用ウォレットの鍵で動かす         |

## 手順

```zsh
cd deploy/trial && npm ci && cd -
export RPC=https://ethereum-sepolia-rpc.publicnode.com
zsh deploy/trial/cli.zsh getComputeEnvironments
zsh deploy/trial/cli.zsh publish metadata/dataset.json
zsh deploy/trial/cli.zsh publishAlgo metadata/algorithm.json
zsh deploy/trial/cli.zsh startFreeCompute <dataset did> <algorithm did> <env id>
zsh deploy/trial/cli.zsh getJobStatus <dataset did> <job id>
zsh deploy/trial/cli.zsh downloadJobResults <job id> <outputs.tar の番号> ./results
```

- RPC は publicnode を使います。Tenderly の公開 RPC は CLI に 429 を返しました。
- ファイルのパスは位置引数で渡します（`--file` ではありません）。
- ウォレットには Sepolia の ETH が少し要ります（登録は台帳への書き込みのため）。
  無償の計算ジョブには、ノードの `C2D_ALLOWED_ADDRESSES` に入っている必要があります。
- `getJobStatus` の出力は JSON ではなく JavaScript のオブジェクトの表示です。`outputs.tar` は 3 番でした。

## 初回の結果（2026-09-26）

ジョブは終了コード 0。1,338 語、上位は people 10、laws 9、states 8、right 7、government 6。
同じコンテナで手元で動かした結果と一致しました。

## 分かっている問題

`--encrypt false` は使えません。登録は暗号化したままで行ってください。
理由と、ノードが自分の公開 URL に届かない問題は [分かっている問題](./known-problems) にあります。
