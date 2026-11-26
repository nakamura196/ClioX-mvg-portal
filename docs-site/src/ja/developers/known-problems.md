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

## 検索語を入れても全件が出る

**原因:** Clio-X のポータル（上の回避の仕組み）。**状態:** `deploy/hosting` の 1715d358 で修正済み。

上の回避の仕組みは、ノードから全件を取り、条件を手元で当て直します。ところが検索語の条件（`query_string`）だけは「条件なし」として素通しにしていました。
そのため「きりつぼ」でも「genji」でも、77 件すべてが出ていました。日本語に限った問題ではありません。
検索語を空白で区切り、どの語も資料名・説明・タグ・作成者・DID などのどれかに含まれれば当たり、としました。
日本語は分かち書きをしないので、部分一致で探します。全角と半角、大文字と小文字、カタカナとひらがなは区別しません。
手元の画面で確かめた件数: 「きりつぼ」2 件、「キリツボ」2 件、「genji」60 件、「declaration」1 件、「zzzz」0 件。
関連度の順位づけはしていません（並び順は選んだ並び替えのまま）。

## MetaMask でダウンロードすると、エラーの中身（file.json）が落ちてくる {#kp-metamask-smart-account}

**原因:** Ocean Node 4.2.0。ポータル側にも一部あり。**状態:** こちらのノードは手直しで修正済み（2026-11-25）。ポータル側は未修正。

2026-09-27 に、アルゴリズムをダウンロードしたところ、本体の代わりに `file.json` が保存されました。中身は `CALL_EXCEPTION`（`getERC721Address()` の呼び出しが失敗）です。
MetaMask の「スマートアカウント」が有効だと、注文の取引は MetaMask の中継の契約（Sepolia では `0xdb9B1e94…`、関数 `redeemDelegations`）を経由して送られます。
ノードは注文を確かめるとき、取引の宛先をデータトークンだとみなします（`dist/components/core/utils/validateOrders.js` の `erc20Address = txReceiptMined.to`）。宛先が中継の契約なので、問い合わせが失敗します。
注文そのものは成功しています（取引 `0xe7d8721a…` にデータトークンの `OrderStarted` が記録されています）。
同じ資料を、中継を使わないウォレットで操作すると、正しくダウンロードできました（Playwright で確認）。
ポータルは、ノードが返したエラーを画面に出さず、そのままファイルとして保存してしまいます。

2026-11-25 に、羅生門（`did:op:4897cc9c…bf61`）を `/ja/asset/…` からダウンロードしたときにも起きました。注文の取引 `0x37a84998…0eb5` は `0xdb9B1e94…` 宛てで、成功しています（データトークン `0x560d…8AdD` が `OrderStarted` を出している）。ノードの記録にも、05:43:49 UTC に同じ `CALL_EXCEPTION` があります。ウォレット `0x6E43…32C3` には EIP-7702 の委任が設定されています（コードが `0x63c0c19a…e32b` を指す）。Cloudflare への移行とは関係ありません。

**サーバで修正しました（2026-11-25 23:14 MST）。** スマートアカウントを切っても直りませんでした。前に中継を通して出した注文が使い回されるうえ、別のアカウントの注文（`0x61796ba5…26f9`）も `0xdb9B1e94…` 宛てでした。
手直しした `validateOrders.js` をイメージに重ねて載せています（`deploy/ocean-node/patches/`、説明は同じ場所の README）。
注文の取引の中でデータトークンが記録を出していれば、資料の記述にあるデータトークンの住所を使い、`OrderStarted` はデータトークン自身の記録からだけ読みます。
実際の注文 2 件でコンテナの中で試しました。元のコードは `CALL_EXCEPTION` で落ち、手直し後は「Transaction is valid.」を返し、別の利用者は今までどおり断られました。
ポータルがエラーの応答をファイルとして保存してしまう点は、まだ直していません。
直し方の案: ノードは宛先ではなく、`OrderStarted` の記録を出した契約の住所を見るべきです。ポータルは、エラーの応答を受けたら保存せずに表示します。

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

**原因:** Ocean のサブグラフ（上流のコミット `2f322ee`）と、読み始め位置（`startBlock`）を後ろにずらしたこと。**状態:** 修正を用意済み（`deploy/hosting` のコミット `667637f4`）。9 月 27 日に接ぎ木で配り直し、07:05（UTC）に台帳に追いついた。

9 月 26 日 23:18（UTC）から、サブグラフは 11,696,316 番のブロックで止まっていました。9 月 27 日の時点で、台帳より約 9 万 5 千ブロック遅れていました。
graph-node のログには、1 時間ごとに次の失敗が出ていました。11,701,495 番のブロックの `handleTokensDispensed` で、_missing value for non-nullable field `contract`_（必須の欄 `contract` が空）。
Dispenser（無償配布）と FixedRateExchange（固定価格の販売）は、すべてのデータトークンで共有する 1 つの契約です。
11,459,550 番から読み始めても、それより前に作られた配布の出来事は届きます。サブグラフは中身の空の記録を作ろうとして、保存に失敗します。
graph-node はこれを「一時的な失敗」とみなし、同じブロックを永久に再試行します。

利用者から見えたこと: 新しい資料がサブグラフに無いので、資料ページが価格を読めません（`Cannot read properties of null (reading 'templateId')`）。**「このアルゴリズムを実行できるデータセット」** とアルゴリズムの選択欄が、読み込み中のまま止まりました。

**直し方:** `skip-unknown-singletons.patch` で、作成の出来事を見ていない Dispenser と固定価格は読み飛ばします。
最初から読み直さないよう、止まる前の最後のブロックから接ぎ木（graft）して配り直します。

```sh
zsh deploy/ocean-node/scripts/deploy.zsh mdx-clio subgraph QmR86ay2HF9AVb7cAJRgeDibESySDJPY9wnQiaJVM75JRg 11696315
```

引き継ぎ元が失敗で止まっている場合、接ぎ木の番号は最後に読んだブロックの **1 つ前** にします。止まったブロックそのものは「健全でない」として拒まれます（_not healthy … graft it starting at block 11696315 backwards_）。

以前の `templateId` が 0 になる問題（`template-id-fallback.patch` で修正済み）と同じ種類です。読み始め位置より前に作られたものを、サブグラフは知りません。

## 有料（固定価格）の資産に、価格も購入ボタンも出ない

**原因:** こちらの運用（Sepolia 用サブグラフの設定ファイル）。**状態:** 修正済み（`deploy/hosting` のコミット `90b3e126`）。9 月 30 日に配り直した（`QmXgVEofKWgHfr57FGAZR2AucCkfkeP8ZmVJQLcqHmAqXj`）。資産の画面に、価格と **Buy for 1 day**、**1 sale** が出るようになった。ただし価格のトークンが「WETH」ではなくアドレス（`0xfFf99…`）のまま表示される。これは未修正。

9 月 30 日に確かめたところ、サブグラフには固定価格の販売所が 1 件も入っていませんでした（`fixedRateExchanges` が `[]`）。同じ日に公開し、実際に購入された有料の資産でも同じでした。
ポータルは価格をサブグラフから読みます。販売所が見つからないと、`getAccessDetailsFromTokenPrice` は `NOT_SUPPORTED`（対応していない）を返します。そのため、有料の資産には価格も購入ボタンも出ません。
台帳の上では購入できます（下の項目）。価格が見えないのはポータルだけです。

原因は、ここでも読み始め位置（`startBlock`）を後ろにずらしたことです。
上流の設定では、FixedRateExchange はひな形としてだけ書かれています。ルーターの `FixedRateContractAdded` という出来事を受けて、読み取りが始まる仕組みです。この出来事は 11,459,550 番のブロックより前にあるため、読み取りが始まりません。
Dispenser は同じ理由で、既に常時読む形にしてありました。FixedRateExchange だけが漏れていました。

**対処:** `deploy/ocean-node/subgraph/subgraph.sepolia.yaml` に、Dispenser と同じ形で FixedRateExchange（`0x80E63f73cAc60c1662f27D2DFd2EA834acddBaa8`）を書き足しました。
最初の有料資産（11,815,074 番のブロックで作成）より前から、接ぎ木で配り直します。graph-node は、元の索引の先頭から 250 ブロック以内への接ぎ木を断ります（_within the reorg threshold of 250 blocks_）。そのため 11,815,073 は断られ、11,814,900 を使いました。

```sh
zsh deploy/ocean-node/scripts/deploy.zsh mdx-clio subgraph QmPjEAoiT91w9XwEdtFQsD6bNR7WwHdrcw2mvXZsJsW16K 11814900
```

接ぎ木の場合、そのブロックより前に作られた販売所は入りません。その出来事でサブグラフが止まらないことは、上の修正で保証されています。それより古い有料資産も必要なら、接ぎ木をせずに `startBlock` から読み直します。

## `ocean-cli` で公開した有料資産は、公開者本人しか買えない

**原因:** Ocean（ocean.js 9.2.1 の `createAsset`。`ocean-cli publish` が使う）。**状態:** 回避済み。`deploy/trial/paid.mjs` は価格を自分で作る。

DDO の価格が 0 より大きいと、`createAsset` は固定価格の販売所を作ります。そのとき、`allowedConsumer`（買ってよい相手）に公開者自身のアドレスを入れます。
すると、販売所はほかの人の購入をすべて断ります。
ポータルは `allowedConsumer` を空にします（誰でも買える）。`paid.mjs` も同じにしました。
同梱のコード（`node_modules/@oceanprotocol/lib/dist/lib.modern.mjs`）を読んで分かったことです。別の人で買えないことは試していません。

## Sepolia には、試しに使える OCEAN が無い

**原因:** Ocean（Sepolia の OCEAN トークン）。**状態:** 価格を Sepolia の WETH で付けることで回避。

Sepolia の OCEAN（`0x1B083D8584dd3e6Ff37d04a6e7e82b5F622f3985`）は、トークンの持ち主しか発行できません。試行用ウォレットから発行を試算すると、_Ownable: caller is not the owner_（持ち主ではない）で断られました。
こちらのウォレットは、どれも OCEAN を持っていません。ポータルの公開画面は OCEAN で価格を付けるので、そのまま公開しても誰も買えません。

`deploy/trial/paid.mjs` は、代わりに Sepolia の WETH（`0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14`）で価格を付けます。試験用の ETH を包めば、誰でも手に入ります。
ルーターは WETH を受け付けますが、承認済みの一覧には入っていません。そのため Ocean への手数料は 0.1% ではなく 0.2% になります。
ポータルの購入処理は、販売所が使うトークンをそのまま使います。WETH の価格でも、ポータル側の変更は要りません。

9 月 30 日の実測（`zsh deploy/trial/paid.zsh publish` のあと `buy <did>`）: 資産 `did:op:f5fea961eef1e8ec393633c09ebea065731d37bc3d73fe63bf746a92e702d85a`、価格 0.001 WETH。
購入の取引 `0x8ac83fef42c88fb97bcb0cb3ee2e5148ed7b3ec557bc43a36948c197cfc2f800` で、購入者から 0.001002 WETH が動きました。
売り手に 0.001 WETH が届き、0.000002 WETH は手数料として販売所に残りました。
データトークン 1 枚が購入者に発行され、注文の時点で焼却されました。そのあとのダウンロードは HTTP 200 でした。

## 「すべてのアルゴリズムを許可」（`*`）が 1 件も当たらない

**原因:** ポータル。**状態:** ポータル側で修正済み（コミット `3b8fdaae`）。

`ocean-cli` は「このデータセットではどのアルゴリズムも動かしてよい」を、`publisherTrustedAlgorithms: [{ "did": "*", … }]` と `publisherTrustedAlgorithmPublishers: ["*"]` で書きます。
ポータルは ID が文字どおり `*` の資料を探していました。そのため、アルゴリズムのページの「このアルゴリズムを実行できるデータセット」は **「該当する資産がありません」** になり、データセットのページでもアルゴリズムを選べませんでした。
いまは両方の検索で `*` を「絞り込まない」と読みます。

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

## Ocean Node 4.x では「可視化」「チャットボット」に結果が出ない

**原因の場所:** Clio-X のポータル（Pontus-X の、結果が 1 ファイルずつ返る形を前提に書かれている）。**状況:** `deploy/hosting` で直しました（`39bd5c29`）。

Ocean Node 4.x はジョブの成果物を `outputs.tar` 1 つ（とログ 3 つ）で返します。2 つのページは `wordcloud.json` や `final_output.json` のような名前でファイルを探すため、何も出ませんでした。
ポータルが tar をブラウザで開くようにしました。詳しくは [「可視化」と「チャットボット」](/ja/developers/usecases)。

## 本家の公開チャットボットのサービスが、ポータルに合わなくなっている

**原因の場所:** Clio-X（`ciferresearch/Cliox-rag-chatbot-backend`、最終コミット 2025-07-17）。**状況:** 試用環境では自前の小さなサービスに置き換えました。

ポータルは答えを少しずつ届く形（server-sent events）で読み、セッションを `DELETE /knowledge/session` で消します。公開版は JSON を 1 つ返すだけで、消す窓口もありません。ライセンスの記載もありません。
試用環境では代わりに `deploy/ocean-node/chatbot/server.py` を動かしています。詳しくは [「可視化」と「チャットボット」](/ja/developers/usecases)。

## 無償ジョブが「可視化」「チャットボット」に出ない

**原因の場所:** Ocean Node 4.2.0 と Clio-X のポータル。**状況:** `deploy/hosting` で直しました（`a64cb256`）。ただし限界があります。

2026-09-27 に確かめた 3 つが重なっていました。
ページはジョブの一覧をチェーン上の注文から組み立てますが、無償ジョブは注文を作りません。
ノードは無償ジョブの `inputDID` と `algoDID` を `null` で返すため、どのアルゴリズムをどのデータセットで流したかが分かりません。
結果の取得は ocean.js の古い方式で署名しており、このノードは受け付けません。
ポータルが自前のノードにジョブを直接たずね、ジョブを流すときにアルゴリズムとデータセットをブラウザに控え、取得はプロフィール画面と同じ方式で署名するようにしました。
**限界:** CLI や別のブラウザで流したジョブは、今も見分けられません。

## Vercel の関数から `CHATBOT_API_KEY` が見えない

**原因の場所:** Vercel 上の Clio-X ポータル。**状況:** 直しました（`2357e5ee`）。

変数はデプロイに設定されていましたが、会話用サービスはポータルからの呼び出しをすべて「鍵なし」と記録していました。
`next.config.js` の `serverRuntimeConfig` 経由で読むようにして直りました（`src/pages/api/contact-resend.ts` が自分の鍵ですでにしている方法です）。
あわせて、会話用サービスが分割送信（chunked）の本文を読めるようにしました。Vercel は 1.5 MB のアップロードをこの形で送ります（`d1fa37fb`）。

## 終わったジョブが「ジョブを精算中」のまま一覧に出ない（最長 1 時間 → 今は 5 分）

**原因の場所:** Ocean Node 4.2.0 の設定。**状況:** 2026-09-30 に対応（間隔を 5 分に短縮）。

2026-09-27、試用サイトの画面から始めた無償ジョブは 13 秒で終わりましたが、その後「ジョブを精算中」（`Job settling`、状態 71）で止まって見えました。
ノードは、終わったジョブを「精算中」にしたあと、料金の精算（`claimPayments`）を**1 時間に 1 回**まとめて行い、そこで「完了」（状態 70）にします。無償ジョブは精算することがありませんが、この回を待つのは同じです。
可視化とチャットボットのページは状態 70 のジョブだけを並べるため（`src/components/TextAnalysis/JobList.tsx`）、その間は一覧に出ません。
間隔は `DOCKER_COMPUTE_ENVIRONMENTS` の各クラスタに `paymentClaimInterval`（秒、既定 3600、最小 60）を書けば縮められます（`deploy/ocean-node/docker-compose.yml`）。Ocean Node は、有償ジョブの精算期限（`claimDurationTimeout`）の中に間隔が 6 回入らないと、計算の仕組みを立ち上げません（`src/components/c2d/compute_engines.ts`）。短くする方向なら安全です。
2026-09-30 に `300`（5 分）にしました（deploy/hosting `4ccc0598`）。入れ直したあと、ノードの記録に `Payments claim timer started (interval: 5 minutes)` と出ています。終わったジョブは 5 分ほどで一覧に出ます。

## 「可視化」「チャットボット」の画面が日本語にならない

**原因の場所:** Clio-X のポータル（このページ群は訳語の辞書を使っていない）。**状況:** 未対応。

ポータルの日本語表示（`/ja/…`、右上の「EN / 日本語」）に切り替えても、この 2 ページの「Compute Jobs」「No visualization data available」「Clear Data」などは英語のまま出ます。
`src/components/TextAnalysis/` と `ChatbotUnified/`・`ChatbotTrial/` の文言が、`src/i18n/locales/{en,ja}.json` を通っていないためです。資料のページ（計算ジョブの状態など）は訳されています。

## カタログに、このポータルからは使えない資料が並ぶ

**原因:** Ocean（ノードがチェーン上のすべての資料を集める）と Clio-X のポータル（それを全部並べていた）。**状態:** `proto/paper-fig` の `e3c63f7f` で修正済み。2026-11-25 から cliox.ldas.jp に反映（`deploy/cf-paper-fig`、`cd07f8bc`）。`deploy/hosting` にはまだ入っていません。

私たちのノードは、自分が配っている資料だけでなく、Sepolia で公開された Ocean の資料をすべて集めます。
そのため検索とタグの一覧に、ほかの人が公開した資料も出ていました。その資料のファイルは、このポータルから届かない提供元（provider）が配っています。
2026-11-25 にノードのメタデータから数えた結果です（各資料のサービスの `serviceEndpoint` で分けました）。

| 提供元                                         | 件数  | 中身                                                                                                                              |
| ---------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------- |
| `https://cliox-node.ldas.jp`（私たちのノード） | 11    | 試行の資料                                                                                                                        |
| `http://127.0.0.1:8001`                        | 32    | 持ち主 `0x1ad7…6958`。`surtin-proj-matlab-test10` のような名前。本家のチームの試験とみられます（名前と作成者欄からの推測）        |
| `https://provider.oceanprotocol.com`           | 5     | Ocean の公開の提供元                                                                                                              |
| `ipfs://…`                                     | 約 60 | 持ち主 `0xA787…A3aA`。私たちの校異源氏物語の帖ごとの資料。提供元を使わずに公開する試み（genji-witness）で、わざとこの形にしたもの |

`127.0.0.1` の提供元は公開した人自身の計算機なので、ほかの場所からはダウンロードもジョブも動きません。
なお、`?demo=1` で使う資料 `ee03ec…`（"release anonymized"）も `0x1ad7` の資料です。

いまのポータルは、資料のサービスがすべて `NEXT_PUBLIC_CATALOGUE_PROVIDERS`（提供元のオリジンをカンマ区切り）のどれかから配られているときだけ、検索とタグの一覧に出します。
末尾が `:` の項目は、その方式の資料をまとめて通します。既定はポータルが読んでいるノード（`NEXT_PUBLIC_METADATACACHE_URI`）と `ipfs:` で、私たちの校異源氏物語は一覧に残ります（`3aacfe5a`）。`*` にすると絞り込みをやめます。
直リンク（`/asset/<did>`）なら、どの資料も開けます。
コード: `app.config.js` の `catalogueProviders`。`src/@utils/aquarius/index.ts` で当てています（テストは `index.test.ts`）。
2026-11-25 に本番（版 `965039d0`）で確かめました。カタログは 67 件、「genji」で 60 件、「surtin」で 0 件です。

## 手元の `next dev` で資料ページが 404 になる（修正済み）

Cloudflare に移ってから（`242e0054`）、ポータルは静的に書き出しています。
アドレスに ID を含むページ（`/asset/<did>`、`/asset/<did>/edit`、`/profile/<account>`、`/experiment/finding-aid/<did>`）は、`_` という 1 枚だけを作ります。
本番では Cloudflare の Worker が、どの ID でもその 1 枚を返します（`worker/index.ts` の `rewriteDynamicPath`）。
手元の `next dev` には Worker が無いため、こうしたページがすべて 404 になっていました。
論文の README が `npm start` のあとに開くよう案内している図 1 の URL も、これに当たっていました。
原因はこちらのホスティングの側にあり、Ocean や Clio-X の不具合ではありません。

`deploy/hosting` の `9a3cf172` で直しました。`next dev` のときだけ、開いたときにページを描きます（`fallback: 'blocking'`）。書き出しは今までどおり `_` だけです。
2026-11-25 に確かめました。図 1 の資料ページ（`?demo=1&env=a`）と目録の形のページが `localhost:8012` で開き、比較表も出ます。

## `/ja/` の頁で、ヘッダー・メニュー・フッターが英語のまま（修正済み）

**原因の場所:** こちらの配り方（静的書き出し）。**状態:** `deploy/hosting` の `f4ad71f9` で修正し、本番に反映済み。

日本語を選んだ状態で `/ja/publish/5/` を開くと、本文は日本語なのに、メニュー（Catalogue、Publish など）、タブの題名、フッターが英語でした。
これらは Next の `router.locale` で言語を見ていました。
Cloudflare の Worker から配る静的書き出しでは `router.locale` が常に空なので、いつも英語になっていました。
本文は `useActiveLocale()`（`src/i18n/useActiveLocale.ts`）を使っていて、i18next と `/ja/` の接頭辞も見るので正しく出ていました。
同じ書き方が 8 ファイルにありました。サイトのメニューと題名（`MarketMetadata`）、トップページの文言、お問い合わせ欄、フッターのプライバシーポリシーへのリンク、試作の 4 ファイルです。
すべて `useActiveLocale()` に揃えました。
2026-11-25 に手元の `wrangler dev` で確認: `/ja/publish/5/` でメニュー・題名・フッターが日本語、`/publish/5/` は英語のまま。

## 公開のプレビューで「[Initialize check file did] Error: … is not valid JSON」が出る（修正済み）

**原因の場所:** Clio-X（本家のコード）。**状態:** `deploy/hosting` の `a539c7fd` で修正し、本番に反映済み。

ウォレットをつないだまま、手順 2 でファイルを入れずに `/publish/5/`（プレビュー）を開くと（アドレスを直接開いた場合など）、赤いエラーの通知が 4 つ出ました。
プレビューの資料はまだチェーンに載っていません。
ファイルの URL が無いと、`AssetActions` は資料の DID についてノードに問い合わせます（`getFileDidInfo`）。
ノードは `Invalid request parameters` という素の文字列を返し、Ocean のライブラリがそれを JSON として読もうとして失敗します。
2026-11-25 に `https://cliox-node.ldas.jp/api/services/fileInfo` で実測: DID が空だと `Invalid request parameters`、URL のファイルで `method` が無いと `Error validating the URL file: URL or method are missing`、`"method":"get"` を付けるとファイルの情報が返る。
フォームの値が変わるたびに確認が走り直すので、通知が何度も出ます。
プレビューでファイルの URL が無いときは、確認をしないようにしました（`src/components/Asset/AssetActions/index.tsx`）。
`method` が無い場合の失敗は、先に `357abc99` で直っています。

## 引き継ぎ: 2026-11-25 に見つかったこと（原因の場所ごと）

2026-11-25、ポータルから新しい資料（羅生門、`did:op:4897cc9c…bf61`）を公開したときに、次の問題に当たりました。
コードを引き継ぐ方のために、原因の場所で分けています。

| 原因の場所                                                                          | 問題                                                                                                           | 項目                             |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Clio-X（本家のコード）。Ocean Node 4.x で表に出る                                   | `method` の無い URL のファイルが断られる                                                                       | [下](#kp-url-method)             |
| Clio-X（本家のコード）。Ocean Node 4.x で表に出る                                   | DDO の暗号化の依頼に署名が無く、断られる                                                                       | [下](#kp-unsigned-encrypt)       |
| こちらのホスティング（Cloudflare の静的書き出し。`242e0054` からのデグレ）          | 公開の最後の手順で 404 になる                                                                                  | [下](#kp-publish-step6)          |
| こちらのホスティング（同上）                                                        | 「Owned by」から空のプロフィールが開く                                                                         | [下](#kp-profile-owner)          |
| こちらのホスティング（同上）                                                        | Vercel との細かな違い 9 件（多くは `/ja` の頁）                                                                | [下](#kp-static-export-audit)    |
| こちらのホスティング（サーバ）                                                      | RPC の回数制限で索引と subgraph が止まる                                                                       | [下](#kp-rpc-rate-limit)         |
| Ocean Node 4.x と MetaMask のスマートアカウント（再発。こちらのノードは手直し済み） | ダウンロードすると本文ではなくエラーのファイルが保存される                                                     | [上](#kp-metamask-smart-account) |
| 問題ではない（本家のふるまい）                                                      | 「External content not allowed」、Etherscan のトークンの頁が空、subgraph が追いつくまでの「No pricing schema」 | [下](#kp-expected-messages)      |

「デグレ」の行は、2026-11-23 までの Vercel の配信では起きていませんでした。
本家の Clio-X にもありません。

## URL のファイルに method が無いと、Ocean Node 4.x に断られる（修正済み） {#kp-url-method}

**原因の場所:** Clio-X（本家のコード）。Ocean Node 4.x で表に出る。**状態:** `deploy/hosting` の `1df55ba3`・`357abc99` で修正し、本番に反映済み。

Ocean Node 4.x は、URL のファイルに `method` を必ず求めます。
本家の公開フォームと資料の頁は、`method` の無い URL のファイルを送ります。
ノードは `Error validating the URL file: URL or method are missing` と返します（2026-11-25 に `https://cliox-node.ldas.jp/api/services/fileInfo` で実測）。
公開の手順 2 と資料の頁で、ファイルの確認が失敗していました。
URL のファイルは、既定で `get` にしました（`src/@utils/ddo.ts`、`FilesInput`、`src/components/Asset/AssetActions/index.tsx`）。
本家のポータルを Ocean Node 4.x とつなぐと、どこでも起きます。

## 公開の手順 2 で失敗する: DDO の暗号化の依頼に署名が無い（修正済み） {#kp-unsigned-encrypt}

**原因の場所:** Clio-X（本家のコード）。Ocean Node 4.x で表に出る。**状態:** `deploy/hosting` の `fd46e0fe`・`72935701` で修正し、本番に反映済み。

Ocean Node 4.x は、公開者のウォレットで署名した暗号化の依頼だけを受け付けます。
本家のポータルは、署名なしで `ProviderInstance.encrypt` を呼びます。
すると ocean.js は、ノードのエラーの文字列を「暗号化した DDO」として返します。
ポータルはその文字列を資料のメタデータとしてチェーンに書き込み、どのノードもその資料を索引できませんでした。
今は、こちらのノードへの依頼に署名を付けます（`src/@utils/oceanNodeAuth.ts` の `encryptViaOceanNode`）。公開の流れと、編集でも使う `setNFTMetadataAndTokenURI` の両方です。
16 進の文字列でない結果は受け付けないので、エラーの文字列がチェーンに載ることはもうありません。
公開では、手順 2 で暗号化した DDO をそのまま使い、2 回暗号化しません。

## 公開の最後の手順で 404 になる（修正済み） {#kp-publish-step6}

**原因の場所:** こちらのホスティング（静的書き出し。`242e0054` からのデグレ）。**状態:** `deploy/hosting` の `d4dfe27d` で修正し、本番に反映済み。

静的書き出しで、`/publish/1` から `/publish/5` までしか作っていませんでした。
送信すると `/publish/6` に移りますが、その頁が無いので Worker が 404 を返し、公開を終えられませんでした。
`src/pages/publish/[step].tsx` の `getStaticPaths` に手順 6 を足しました。

## 「Owned by」から空のプロフィールが開く（修正済み・未反映） {#kp-profile-owner}

**原因の場所:** こちらのホスティング（静的書き出し。`242e0054` からのデグレ）。**状態:** `deploy/hosting` で修正（手元で確認済み。本番には未反映）。

資料の頁の持ち主のリンクは `/profile/<アドレス>/` を開きます。
その頁は、売上 0・公開 0・「Please connect your wallet.」でした。いっぽう、ヘッダーのプロフィール（`/profile/`）には、同じウォレットの資料が並びます。
静的書き出しでは、`/profile/[account]` を `_` として 1 つだけ作り、Worker がどのアドレスにもその頁を返します。
頁はアドレスを `router.query.account` から読んでいましたが、そこは `_` なので、誰のプロフィールか分かりませんでした。
Cloudflare への移行で、まさにこのための `useDynamicParam`（`src/@utils/useDynamicParam.ts`）を作り、資料の頁には使っていましたが、プロフィールの頁には使っていませんでした。
プロフィールの頁でも使うようにしました（`src/pages/profile/index.tsx`）。ウォレットとの照合は、大文字・小文字を区別しません。
2026-11-25 に手元の `wrangler dev` で確認: `/profile/0x6E43…32C3/` に羅生門（Free）が出る。

## 静的書き出しに移したことによる、Vercel との細かな違い（修正済み・未反映） {#kp-static-export-audit}

**どこの問題か:** こちらのホスティング（静的書き出し、`242e0054` のデグレ）。**状態:** `deploy/hosting` で修正済み（手元で確認済み、本番は未反映）。2026-11-25 にコードを読んで見つけました。

静的書き出しには、Next の言語ごとの振り分けがありません。また、アドレスに ID を含む頁は `_` の 1 枚だけを書き出します。そのため、Vercel では自動で行われていたことが、いくつか動かなくなっていました。

1. `/ja/asset/…` に「External content」の確認が出ず、`/ja/search` で検索欄の種類が違っていました。頁のアドレスに `/ja` が付いたまま、`src/components/@shared/Page/index.tsx` が `/asset`・`/search` と比べていたためです。比べる前に `/ja` を外すようにしました。
2. `/ja` で案内ツアーが「迷子」になり、英語の頁に飛んでいました（`src/experiment/tour/steps.ts`、原因は同じ）。
3. `/ja` でリンクを押すと、アドレスから `/ja` が落ちていました。表示は日本語のままですが、再読み込みやリンクのコピーで英語に戻っていました。`src/i18n/useStaticExportLocale.ts`（`_app.tsx` から呼ぶ）が、移動のたびに `/ja` を付け直します。
4. どの頁も `<html>` に `lang` がありませんでした。同じ仕組みで `en` か `ja` を付けます。
5. リンクから資料・プロフィール・目録の頁を開くと、頁全体を読み直していました。`/ja` では読み直した結果が英語になっていました。頁のデータが `_` の分しか書き出されず、Next のデータの取得が 404 になっていたためです。Worker が、どの ID にも `_` のデータを返すようにしました。
6. `/ja/imprint` と `/ja/terms` が英語でした。`src/pages/[slug].tsx` が両方の言語を持ち、ブラウザで選ぶようにしました。
7. `/experiment?view=…` が二条件の頁に移らず、一覧のままでした。書き出した頁が Worker より先に答えていたためです。`wrangler.jsonc` で `/experiment` を先に Worker に回すようにしました。
8. `/ja/publish` と `/ja/signup` が 404 でした。Worker の旧アドレスの転送が `/ja` にも効くようにしました。
9. どの頁も Vercel の利用統計のスクリプトを読みに行き、404 になっていました。静的書き出しでは読み込まないようにしました。

2026-11-25 に手元の `wrangler dev` で確認しました。`/ja/` から検索、資料の頁へと移っても `/ja` が残り、頁全体の読み直しも起きません。再読み込みと「戻る」でも日本語のままです。`/ja/asset/…` に External content の確認が出ます。

## 新しい資料が出てこない: RPC の回数制限（修正済み） {#kp-rpc-rate-limit}

**原因の場所:** こちらのホスティング（ノードのサーバ `mdx-clio`）。**状態:** 2026-11-25 にサーバで修正。リポジトリの `deploy/ocean-node/` にも同じ設定。

サーバでは、Sepolia を読むプログラムが 2 つ動いています。

- **索引**（Ocean Node の中）は、資料の説明を持ちます。検索と資料の頁がここを読みます。止まると、新しい資料が検索に出ず、頁は「Could not retrieve asset」になります。
- **subgraph**（graph-node）は、価格・注文・売上の数を持ちます。止まると、資料の頁に「Data out of sync」と「No pricing schema available」が出ます。

どちらも Tenderly の公開の窓口（`https://sepolia.gateway.tenderly.co`）を使っていました。鍵が無く、IP アドレスごとに回数を制限します。
subgraph が枠を使い切りました（30 分で 429 が 44 回）。
続いて索引も失敗しました（`599 CLIENT ESCALATED SERVER ERROR (429 Too Many Requests; exceeded maximum retry limit)`）。
サーバからは `eth_blockNumber` さえ 429 で、別の機械からの同じ依頼は通りました。

ほかの無料の窓口の実測（2026-11-25）:

- publicnode は、アドレスを指定しない `eth_getLogs` を断る。索引はこれを使う。
- dRPC の無料プランは Sepolia を出さない（`chain is not available on free plan`）。
- Alchemy の無料プランは、`eth_getLogs` を 10 ブロックまでしか返さず、1 秒あたりの回数も制限する。

設定したこと:

- どちらも Alchemy にした（1Password の「sepolia rpc alchemy」。サーバの `.env` の `SEPOLIA_SUBGRAPH_RPC` と `SEPOLIA_INDEXER_RPC`）。
- 索引は 1 回に 10 ブロック読む（`SEPOLIA_INDEXER_CHUNK_SIZE=10`。`RPCS` の `chunkSize` に入る）。
- graph-node は 1 回に 10 ブロック、6 秒ごとに問い合わせ、同時に送る依頼は 2 つまで（`GRAPH_ETHEREUM_MAX_BLOCK_RANGE_SIZE`、`ETHEREUM_POLLING_INTERVAL`、`ETHEREUM_RPC_MAX_PARALLEL_REQUESTS`）。既定の 64 のままだと、2 つ合わせて Alchemy からも 429 が返った。

変更のあと、資料は 1 分ほどで索引に入りました。
2 つで 1 本の無料の Alchemy の鍵を分け合っています。
429 が戻ってきたら、索引に別の鍵を渡してください（無料の Tenderly のアカウントか、2 つ目の Alchemy のアプリ）。

**同じ日の夜（22:50 MST）:** 鍵の分け合いで、また止まりました。
graph-node が `eth_getTransactionReceipt` で Alchemy から 429 を受け、ブロック 12214280 で止まった（約 300 ブロック遅れ）。
Ocean Node はダウンロードへの応答にも同じ RPC（`RPCS`）を使うので、05:51 と 05:53 UTC のダウンロードが `Unable to detect provider network: (TIMEOUT)` で失敗した。
ポータルは、ノードの返した `Download handler: TIMEOUT`（25 バイト）を、エラーとして見せずに `file.html` として保存した。
直したこと: graph-node を Tenderly の窓口に戻し、1 回に 500 ブロック読むようにした（`GRAPH_ETHEREUM_MAX_BLOCK_RANGE_SIZE: '500'`）。索引とダウンロードは Alchemy のまま。
再起動（05:54 UTC）のあと、時間切れは記録されておらず、サーバから Alchemy への `eth_chainId` は約 40 ミリ秒で返った。
ダウンロードで小さな `file.html` や `file.json` が保存されたら、中を開いてください。1 行のエラーなら、資料の故障ではなく、やり直せば済みます。

## 新しい資料の頁に出る、想定どおりの表示 {#kp-expected-messages}

**原因の場所:** 本家のふるまい。**状態:** 問題ではない。

- **「External content not allowed … Do you want to allow it?」** は、読者が Allow を押すまで、どの資料の頁にも出ます（選んだ結果は Cookie に残る）。本家のプライバシーの設定で、エラーではありません。こちらの日本語の頁（`/ja/asset/…`）では出ていませんでしたが、これはこちらの不具合で、修正済みです（[上](#kp-static-export-audit) の 1）。
- **「Accessed with GXAT」** は、Etherscan のデータトークンの頁に飛びます。無料の資料では、誰かが利用するときに初めてトークンが作られるので、新しい資料の頁は持ち主 0・発行量 0 です（2026-11-25、`0x560d…8AdD` で確認）。
- **「No pricing schema available」と「Data out of sync」** は、subgraph が資料の公開されたブロックに追いつくまで出ます（羅生門は 12,214,097 で公開、subgraph は 12,213,272）。追いつけば消えます。

## 「Switch Wallet」を押しても何も起きない（修正済み） {#kp-switch-wallet}

**原因の場所:** Clio-X（本家のコード）。**状態:** `deploy/hosting` の `de9b67b6` で修正し、本番に反映済み（Version `8b0045a7`、2026-11-25）。

別のアカウントから資料を買う試験のため、MetaMask に 2 つ目のアカウントを足しましたが、ポータルには 1 つ目のアカウントが出たままでした。
アカウントのメニューの「Switch Wallet」を押しても、何も起きませんでした。
2 つの原因が重なっていました（2026-11-25 にコードを読み、ブラウザで確認）。

- ボタンは wagmi の `connect()` を、どのウォレットかを指定せずに呼んでいたため、何もしていなかった（`src/components/Header/Wallet/Details.tsx`）。
- MetaMask は、そのサイトに許可したアカウントしか見せない。cliox.ldas.jp で `eth_accounts` を呼ぶと `0x6E43…32C3` だけが返り、MetaMask の中でアカウントを切り替えても、ポータルには届かなかった。

ボタンは `wallet_requestPermissions` を送るようにしました。MetaMask がアカウントを選ぶ画面を開き、ポータルは MetaMask の `accountsChanged` の知らせで、選んだアカウントに切り替わります。
手元のポータルで確認: 2 つ目のアカウントを選ぶと、ヘッダーに `0x05f1…C085` が出ました。

この修正の前の回避策: アカウントのメニューで「Disconnect」を押し、MetaMask で別のアカウントを選んでから、もう一度つなぎ、そのアカウントだけを許可する。

## 小さなこと

- スマートフォンの幅（390px）で、どのページも 8px 横にずれて動いた。ヘッダーのメニュー行が画面の端まで 1rem はみ出す作りで、480px 以下ではメニューの余白のほうが狭いため。原因はポータルのヘッダー（upstream）。`deploy/hosting` の `2b65e793` で修正し、390px で 9 ページを確かめた。
- プロフィールの販売数の欄に `profile.sales` がそのまま出ていました。件数を読み込む前は数が無く、訳語を引けなかったためです。02abf67c で修正済み。
- 資料のカードで Sepolia が「ネットワーク不明」と出ていました。独自に足したチェーンが、ネットワークの一覧に戻されていなかったためです。修正済み。
- subgraph の `_meta.block` は出来事のあるブロックでしか進まず、止まって見えます。graph-node のログを見てください。
- Tenderly の公開 RPC は CLI に 429 を返しました。`https://ethereum-sepolia-rpc.publicnode.com` は使えました。
- ポータルのサーバー側描画は Node 25 で壊れます（`localStorage.getItem is not a function`）。Node 22 を使ってください。
- mdx は外向きの UDP を止めているので、cloudflared の QUIC が失敗します（エラー 1033）。`--protocol http2` を使います。
- 環境への配慮の試作: 仕組みを作った直後、数秒だけ、新しい仕組みの見出しの下に前の仕組みの台帳の行が出ることがあります。数秒で直ります。2026-10-05 の本物の MetaMask での確認で 1 度見ました。プルダウンで仕組みを切り替えたときは起きません。原因はチェーンではなく、Clio-X の画面側（古い台帳の状態が残る）です。
