# API（OpenAPI）

Clio-X が Ocean Node と subgraph に送る呼び出しを、OpenAPI 3.1 で書きました。

- **[対話型のリファレンスを開く](/api/)**（Scalar、英語）
- [`cliox-sepolia.openapi.yaml` をダウンロード](/api/cliox-sepolia.openapi.yaml)

## 範囲

ポータルと `@oceanprotocol/cli` 2.1.0 が実際に送る呼び出しだけを書いています。
どれも、試用の仮想マシンで動いている Ocean Node 4.2.0 のルーティングのコードと、実際のリクエストで確かめました。
subgraph は、ポータルが使う名前付きのクエリを例にした `POST` 1 本として書いています。
例は 2026-09-26 の初回の実行から取りました。

## 使う前に知っておくとよいこと

- **誰でも、あるウォレットの計算ジョブの一覧を見られます。** `GET /api/services/compute` に署名は要りません。
- **ファイルの詳細は公開されています。** 登録済みの DID に `POST /api/services/fileInfo` を送ると、封印されたファイルの大きさ・種類・ファイル名・SHA-256 が誰にでも返ります。計算専用のデータセットでも同じです。URL そのものは返りません。
- **資料が目録に出ない理由を調べるには** `GET /api/aquarius/state/ddo`（ポータルは使っていない）。DID の前方一致で、索引づくりのエラーが見られます。
- `POST /api/aquarius/assets/names` はポータルが呼びますが、4.2.0 には無く 404 になります。そのため一部の一覧で名前が空になります。
- 無償のジョブは、終わってもステータス **71**（Job settling）のままです。結果はもうダウンロードできます。
- subgraph の `opc` は `null`、veOCEAN は空です。索引の開始ブロックが、それらのコントラクトの配備より後だからです。
