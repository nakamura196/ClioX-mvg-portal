# 分かっている問題

Ocean Node 4.2.0 で Clio-X を Sepolia に建てたとき、時間を取られた点です。
それぞれ、原因が Ocean・Clio-X・私たちの運用のどれにあるかを書いています。

## 資料は、暗号化したノードに結び付く

**原因:** Ocean の設計。**状態:** 仕様。対策は下記。

暗号化された DDO（資料の記述）は、暗号化したノードの URL と一緒に台帳に残ります。
どのノードが索引を作るときも、_その URL_ に復号を頼みます。自分の鍵は試しません。
以前の 29 件は、いまは動いていない 2 つのノードで暗号化していました。ノート PC のノード（12 件）と、クラウドのノード `http://16.192.66.21:8001`（16 件。1 件は URL の記録なし）です。
新しいノードはクラウドのノードと同じ鍵を使っていますが、1 件も索引に入りません。

- IP アドレスではなく、自分で管理する名前（`cliox-node.ldas.jp`）で登録し、ノードの鍵を保管する。名前なら新しい機械に向け直せます。
- アーキビストにとっての意味は [登録に使ったサービスが無くなったとき](/ja/archivists/when-a-node-closes) に書きました。
- 記述を暗号化せずに登録すれば、目録の記述は残ります。次の項目を参照。

## `--encrypt false` が拒否される

**原因:** `@oceanprotocol/lib` 9.2.1（`ocean-cli` 2.1.0 が使用）。**状態:** 報告の下書きあり、未提出。

`ocean-cli publish … --encrypt false` は、Ocean Node 4.2.0 で _“Unencrypted DDO hash does not match metadata hash”_ になります。
ライブラリは `indexedMetadata` を**含めた** DDO でハッシュを取り、ノードは `indexedMetadata` を消してから照合します。
拒否された 2 件の取引の `metaDataHash` は、`indexedMetadata` を含む DDO の 16 進表現の sha256 と一致しました。
CLI は NFT の名前のために `indexedMetadata.nft` を必要とするので、外すこともできません。公式の例のファイルも同じ問題を持っています。

**回避策:** 暗号化して登録する。

## ノードが自分の公開 URL に届かない

**原因:** 私たちの Cloudflare の設定。**状態:** WAF のスキップ規則で解決。

復号を頼む先がノード自身の公開ホスト名なので、ノードは Cloudflare を通って自分を呼びます。
ゾーンのボット対策が仮想マシンに `403 cf-mitigated: challenge` を返し、暗号化した資料が索引に入りませんでした。
失敗した出来事は再試行されません。直したあと、資料を登録し直す必要がありました。
ノードを呼ぶほかのサーバ（サーバーレス関数、別の Ocean Node）も、同じく止められている可能性があります。

## Ocean Node に対して検索が 0 件になる

**原因:** Clio-X のポータル。**状態:** `deploy/hosting` で修正済み。

ポータルは Aquarius 向けの Elasticsearch の問い合わせを作ります。Ocean Node は Typesense を使っていて、同じ問い合わせに空の一覧を返します。
回避の仕組みはありましたが、接続先が `localhost` のときしか働かず、`services.type` のような配列の中も見ていませんでした。
`NEXT_PUBLIC_METADATACACHE_OCEAN_NODE` を足しました（既定: ホスト名に「aquarius」を含まなければ有効）。
修正後、compute 4 / download 9 / datasets 4 / algorithms 5。ノードから直接数えた件数と一致しました。
Pontus-X が Aquarius を Ocean Node に置き換えた時点で、本家の Clio-X にも同じことが起きるはずです。

## 索引づくりが 90 秒ごとに最初のブロックからやり直す

**原因:** Ocean Node。**状態:** compose ファイルで回避。

Ocean Node と Typesense を同時に起動すると、索引の保存先を作り損ね、読んだ位置を保存できなくなることがあります
（_“Error updating last indexed block: Not Found”_）。
ノードを再起動すれば直ります。compose ファイルでは、Typesense の `/health` を最大 120 秒待ってからノードを起動するようにしました。

## 計算ジョブには、資料の先頭のファイルしか渡らない

**原因:** Ocean Node 4.2.0。**状態:** 1 つの圧縮ファイルにまとめて回避。

校異源氏物語の TEI を、最初は 54 帖のファイルの URL を並べた 1 件の資料として登録しました。
無償のジョブは終わりましたが、結果は第 1 帖の分だけでした。
そのジョブの `configuration.log` には `Downloading asset 0` とあり、取得したのは `01.xml` だけでした。

**回避策:** 複数のファイルは 1 つの `.tar.gz` にまとめて登録し、分析の側で開きます。
実例は [CLI で登録と無償の計算](./trial-run#校異源氏物語の-tei-を-compute-用に登録する) にあります。

## サブグラフが、知らない Dispenser で止まる

**原因:** Ocean のサブグラフ（上流のコミット `2f322ee`）と、読み始め位置（`startBlock`）を後ろにずらしたこと。**状態:** 修正を用意済み（`deploy/hosting` のコミット `667637f4`）。接ぎ木での配り直しが未実施。

9 月 26 日 23:18（UTC）から、サブグラフは 11,696,316 番のブロックで止まっていました。9 月 27 日の時点で、台帳より約 9 万 5 千ブロック遅れていました。
graph-node のログには、1 時間ごとに次の失敗が出ていました。11,701,495 番のブロックの `handleTokensDispensed` で、_missing value for non-nullable field `contract`_（必須の欄 `contract` が空）。
Dispenser（無償配布）と FixedRateExchange（固定価格の販売）は、すべてのデータトークンで共有する 1 つの契約です。
11,459,550 番から読み始めても、それより前に作られた配布の出来事は届きます。サブグラフは中身の空の記録を作ろうとして、保存に失敗します。
graph-node はこれを「一時的な失敗」とみなし、同じブロックを永久に再試行します。

利用者から見えたこと: 新しい資料がサブグラフに無いので、資料ページが価格を読めません（`Cannot read properties of null (reading 'templateId')`）。**「このアルゴリズムを実行できるデータセット」** とアルゴリズムの選択欄が、読み込み中のまま止まりました。

**直し方:** `skip-unknown-singletons.patch` で、作成の出来事を見ていない Dispenser と固定価格は読み飛ばします。
最初から読み直さないよう、止まる前の最後のブロックから接ぎ木（graft）して配り直します。

```sh
zsh deploy/ocean-node/scripts/deploy.zsh mdx-clio subgraph QmR86ay2HF9AVb7cAJRgeDibESySDJPY9wnQiaJVM75JRg 11696316
```

以前の `templateId` が 0 になる問題（`template-id-fallback.patch` で修正済み）と同じ種類です。読み始め位置より前に作られたものを、サブグラフは知りません。

## Ocean Node 4.x が窓口の一覧を返さない

**原因:** Ocean Node 4.2.0 と、ポータルの `@oceanprotocol/lib` 3.1.3 の食い違い。**状態:** ポータル側で修正済み（コミット `616ce890`）。

ocean.js 3.1.3 は、ノードの入口（`GET /`）が返す `serviceEndpoints`（窓口の名前 → `[メソッド, パス]`）を見て、ノードに頼む処理の URL を決めます。
Ocean Node 3.2.0 はこれを返していましたが、4.2.0 は返しません（窓口そのものは同じパスに残っています）。
一覧が無いと、ocean.js は黙って `null` を返します。資料ページには **「利用できるコンピュート環境がありません」** と **「ファイル情報がありません」** が出て、計算も始められませんでした。
いまはポータルが、ノードが `software: "Ocean-Node"` を名乗り一覧を返さないときに、3.2.0 の一覧を補います（`src/@utils/oceanNodeEndpoints.ts`）。
なお ocean.js は `fileinfo` という名前で探し、ノード側の名前は `fileInfo` です。両方を入れています。

## CLI で登録した資料のサムネイルが切れる

**原因:** `@oceanprotocol/lib` 9.2.1（`ocean-cli` 2.1.0 が使用）とポータル。**状態:** ポータル側で修正済み（`deploy/hosting` のコミット `f0307b02`）。

ocean.js の `createAsset()` は、データ NFT を作るときに `tokenURI` へ `"aaa"` という仮の値を固定で入れます。
ポータルは `data:` で始まらない tokenURI を、すべて画像のアドレスとして扱っていました。
そのため `<img src="aaa">` となって画像が出ず、代わりの説明文（NFT の名前）が資料ページ上部の 60px の枠からはみ出していました。
いまは `data:image/`・`http(s)://`・`/` で始まる値だけを画像として使い、読み込みに失敗したときは Clio-X のロゴを出します。
台帳上の値は `"aaa"` のままです。書き換えるには NFT の持ち主による取引が要ります。

## 小さなこと

- 資料のカードで Sepolia が「ネットワーク不明」と出ていました。独自に足したチェーンが、ネットワークの一覧に戻されていなかったためです。修正済み。
- subgraph の `_meta.block` は出来事のあるブロックでしか進まず、止まって見えます。graph-node のログを見てください。
- Tenderly の公開 RPC は CLI に 429 を返しました。`https://ethereum-sepolia-rpc.publicnode.com` は使えました。
- ポータルのサーバー側描画は Node 25 で壊れます（`localStorage.getItem is not a function`）。Node 22 を使ってください。
- mdx は外向きの UDP を止めているので、cloudflared の QUIC が失敗します（エラー 1033）。`--protocol http2` を使います。
