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

## 校異源氏物語の TEI を Compute 用に登録する

2 つ目の例は、実際の人文学のデータです。
校異源氏物語の TEI/XML 全 54 帖（デジタル源氏物語、CC0）を 1 件の Compute 用の資料として登録します。
あわせて、帖ごとに題・頁数・行数・文字数・頻出文字 10 位を数える分析を登録します。
返るのはこの集計（JSON と CSV）だけで、TEI 本体はノードの外に出ません。

| ファイル                                                       | 中身                                                                                                                                                                                                         |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `sample/kouigenji-tei-f695a1af.tar.gz`                         | データセット。[kouigenjimonogatari.github.io](https://github.com/kouigenjimonogatari/kouigenjimonogatari.github.io) のコミット `f695a1af` の `xml/master`（54 ファイル、1.0 MB、sha256 `b2df393a0b264aef…`） |
| `algorithm/genji_profile.py`                                   | 分析。TEI をそのままでも、`.tar.gz` / `.zip` の中からでも読む。Python の標準ライブラリのみ                                                                                                                   |
| `metadata/genji-dataset.json`, `metadata/genji-algorithm.json` | CLI 用の資料の記述。ファイルの URL はこのリポジトリのコミットに固定                                                                                                                                          |
| `genji.zsh`                                                    | 2 件の登録 → 索引ができるのを待つ → 無償ジョブ → 終わるのを待つ、までを 1 回の 1Password の承認で行う                                                                                                        |
| `deprecate.mjs`                                                | 古い版を「非推奨」（Ocean の状態 2）にする。記録そのものは台帳に残る                                                                                                                                         |

圧縮ファイルは次のコマンドで作りました。

```zsh
git -C <kouigenji のチェックアウト> archive --format=tar --prefix=kouigenji-tei/ f695a1af xml/master | gzip -9n > deploy/trial/sample/kouigenji-tei-f695a1af.tar.gz
```

実行します。

```zsh
zsh deploy/trial/genji.zsh
zsh deploy/trial/genji.zsh --deprecate <古いデータセットの did> <古いアルゴリズムの did>
```

2 行目は、前の版を置き換えるときだけ使います。

期待される結果は、54 帖・1,812 頁・25,065 行・839,650 字です。
同じコンテナを手元でネットワークを切って動かして確かめました。
行数は、先に登録した閲覧用の源氏物語の資料に記録された `itemTreeSize` と一致します。

ご自分の TEI の資料群を同じように登録するときは、次の順に進めます。

- ファイルを 1 つの圧縮ファイルにまとめ、コミットに固定した URL に置く
- `genji-dataset.json` を写し、`metadata` とファイルの URL を書き換える
- `compute.allowNetworkAccess` は `false` のままにする（分析からデータを外に送らせないため）

### 1 回目（2026-09-26）は第 1 帖しか分析されなかった

最初は 54 帖のファイルを 54 個の URL として 1 件の資料に並べました（`did:op:666877510595…`、分析は `did:op:7358e0ea6873…`）。
ジョブは終わりましたが、結果は 1 帖分でした。
Ocean Node 4.2.0 は、資料の先頭のファイル（`01.xml`）しかジョブに渡さなかったのです。
そこで 54 帖を 1 つの圧縮ファイルにまとめ直しました。1 回目の 2 件は `--deprecate` で非推奨にします。

## 分かっている問題

`--encrypt false` は使えません。登録は暗号化したままで行ってください。
また、計算ジョブには資料の先頭のファイルしか渡りません。複数のファイルは 1 つにまとめてください。
理由と、ノードが自分の公開 URL に届かない問題は [分かっている問題](./known-problems) にあります。
