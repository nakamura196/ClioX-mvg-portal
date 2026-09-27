# 「検証」ページ

ポータル上部のメニューに **検証**（`/verify`、英語では _Verify_）があります。
資料の識別子（`did:op:…`）を 1 つ入れると、その資料に付いている Gaia-X のサービスクレデンシャルを探し、検証サービスに「規則に合っているか」を問い合わせます。
サービスクレデンシャルとは何か、どう作るかは [Gaia-X サービスクレデンシャル](/ja/developers/gaia-x-credential) にあります。

**Sepolia の試用サイトで証明書が付いている資料は 1 件だけです。わざと作った練習用で、不合格になります。**
cliox-node の 77 件には証明書の付いた資料が 1 件もありませんでした（2026-09-27 に数えました）。
そこで、このページの動きを見せるために [練習用の見本](#練習用の見本) を登録しました。
ほかの資料は、どれも「サービスクレデンシャルがありません」で終わります。

## 使い方

1. [cliox.ldas.jp/ja/verify](https://cliox.ldas.jp/ja/verify) を開きます。上のメニューの **検証** からも開けます。
2. 入力欄に資料の DID を貼り、**検証する** を押します。
   入力欄では先頭の `did:op:` を省いてもかまいません。ページが補います。
3. 結果が入力欄の下に出ます。結果へ直接リンクすることもできます: `/ja/verify?did=did:op:<16 進 64 桁>`。
   URL に書くときは `did:op:` が**必要**です。無いと「この URL は有効な DID ではありません」と出ます。

DID は各資料のページに表示されています。資料ページの URL の末尾も DID です。

![試用サイトの検証ページ。アメリカ独立宣言の見本を入れたところ](/media/verify-ja.png)

## 結果の読み方

2026-09-27 に https://cliox.ldas.jp で確かめました（画面を持たないブラウザ、ウォレット未接続）。

| 表示                                                            | 意味                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **サービスクレデンシャルがありません**                          | 資料はあるが、説明にクレデンシャルが入っていない。Sepolia の資料はすべてこれになる。例: 独立宣言の見本 `did:op:04f79245…9787`。                                                                                                                                                                             |
| **資産を取得できません** ＋「キャッシュに見つかりませんでした」 | このポータルが読んでいるノードが、その DID を知らない。Pontus-X の資料（例 `did:op:3e8d6e4a…47f1`）を試用サイトに入れるとこうなる。試用サイトは Sepolia の cliox-node しか読まないため。クレデンシャルの良し悪しとは関係ない。                                                                              |
| **資産を取得できません** ＋「有効な DID ではありません」        | 入れた文字列が DID ではない（打ち間違い、または URL で `did:op:` が抜けている）。                                                                                                                                                                                                                           |
| **サービスクレデンシャル** の枠に JSON と印                     | クレデンシャルが見つかった。印は 2 つ。**サービスクレデンシャル**（チェック＝検証サービスが受け入れた、× ＝受け入れなかった）と、**クレデンシャル ID の一致**（そのクレデンシャルがこの DID の資料について書かれたものか）。 ID は 1 つ目の印が合格のときだけ比べるので、不合格のときは 2 つとも × になる。 |

「検証済み」は、検証サービスがファイルの署名と中身を Gaia-X の規則に照らして受け入れた、という意味です。
データそのものを誰かが確かめたわけではありません。記録としての質を保証するものでもありません。

## 仕組み

`deploy/hosting` のコード（`a3e93a55`）を読んで確かめた内容です。

- `src/pages/verify.tsx` は、資料ページと同じ仕組み（`src/@context/Asset.tsx`）で資料を読み込みます。
- クレデンシャルは資料の説明の `metadata.additionalInformation.gaiaXInformation.serviceSD` から取ります。`url`（GET で取りに行く）か `raw`（JSON をそのまま埋め込み）のどちらかです。
- `src/components/Publish/_utils.ts` の `verifyRawServiceCredential` が、JSON 全体を `${NEXT_PUBLIC_COMPLIANCE_URI}/v1/api/credential-offers` に POST します。既定値は `https://www.delta-dao.com/compliance` で、試用サイトも変えていません。
- HTTP **201** が返れば「検証済み」。それ以外（409、500、通信の失敗）は「未検証」です。
- ID の一致は、資料の DID と、提示された中の `gx:ServiceOffering` の `id` を比べます。ServiceOffering が複数あるときは、他のどれからも `gx:dependsOn` で指されていないもの（根）と比べます。1 つも無いときは「No root service found」という注意が出ます。
- 印の横の「バージョン」は、設定値 `NEXT_PUBLIC_COMPLIANCE_API_VERSION`（既定 `2210`）をそのまま出しています。応答から読んだ値ではありません（本家で確認処理がコメントアウトされています）。

2026-09-27 の実測: Pontus-X の資料に付いていたクレデンシャル（`https://compliance.agrospai.udl.cat/.well-known/INRAE.vp.json`）をこの窓口に送ると、**201** と署名付きの適合証明が返りました。
このファイルには参加者の証明（`gx:LegalParticipant` ほか 2 件）しかなく、`gx:ServiceOffering` がありません。
そのため画面では「検証済み」、ただし ID の一致は「No root service found」の注意付き、と出るはずです（画面では未確認）。
Pontus-X の資料のうち `serviceSD.url` の欄を持つ新しい 300 件では、286 件が空欄でした。

知っておくとよいこと:

- **クレデンシャルは外部に送られます。** このページでも、クレデンシャル付きの資料ページを開いたときでも、見ている人のブラウザからクレデンシャル全体が delta-dao.com に送られます。クレデンシャルは公開が前提のものなので設計どおりですが、機関が自分でポータルを建てるなら、`NEXT_PUBLIC_COMPLIANCE_URI` を自前の検証サービスに向けることも考えられます。
- このページは検索エンジンの対象外です（`src/pages/robots.txt.tsx` に `Disallow: /verify`）。

## 練習用の見本

**Gaia-X credential demo (not compliant) - sample record**、`did:op:f40f45aac2acc57fd668ed5c41a0eb7bd39f4c5fae5614286a8e5ab0453f1486`
（[検証ページで開く](https://cliox.ldas.jp/ja/verify?did=did:op:f40f45aac2acc57fd668ed5c41a0eb7bd39f4c5fae5614286a8e5ab0453f1486)）。
中身は独立宣言の本文をもう一度使っています。2026-09-27 に試用のウォレットで登録しました。

![練習用の証明書を検証したところ。印は 2 つとも ×](/media/verify-demo-ja.png)

証明書の形は、本家で使われているもの（Trust Framework 22.10）に合わせました。
中身は `gx:LegalParticipant`（参加者）、Gaia-X の利用条件、`gx:ServiceOffering`（`id` はこの資料の DID）の 3 通です。
3 通とも、`did:web:cliox.ldas.jp` として公開した鍵で署名しています（JsonWebSignature2020、PS256）。

- https://cliox.ldas.jp/.well-known/did.json （公開鍵）
- https://cliox.ldas.jp/.well-known/gaia-x-demo/certificate-chain.crt （自分で署名した証明書）
- https://cliox.ldas.jp/.well-known/gaia-x-demo/declaration-demo.vp.json （証明書本体。資料の `serviceSD.url`）

検証サービスの答えは次のとおりです。

```
409 X509 certificate chain could not be resolved against registry trust anchors
    for VC https://cliox.ldas.jp/.well-known/gaia-x-demo/declaration-demo.vp.json#participant.
```

「証明書の発行元が、Gaia-X が信頼する発行元までたどれない」という意味です。
署名と `did:web` は読めて受け入れられ、その次の段階で落ちています。
`did.json` を公開する前は、1 つ手前（「did:web の文書を読めない」）で落ちていました。
ポータルの画面には理由が出ず、× だけです。理由を見るには、ファイルを自分で送ります:
`curl -X POST -H 'Content-Type: application/json' --data @declaration-demo.vp.json https://www.delta-dao.com/compliance/v1/api/credential-offers`

**合格に何が要るか**は、上に挙げた合格例から分かります。

1. 信頼される発行元につながる証明書。agrospai.udl.cat の鍵には、リェイダ大学の電子印鑑の証明書（"segell electrònic"、大学の税番号入り）が付いています。発行元はカタルーニャの公的機関向け認証局 AOC（`CN=EC-SectorPublic`）です。
2. Gaia-X の公証サービスが発行した、法人番号の証明書。合格例では `did:web:www.delta-dao.com:notary:v1` が、EU の VAT 番号を VIES（EU の照会システム）で確かめて発行していました。練習用には付けていません。

どちらもソフトウェアではなく、機関そのものについての条件です。
練習用が合格しないのも、Gaia-X に加わるかどうかが機関ごとの判断になるのも、このためです。

スクリプトとファイル: `deploy/hosting` の `deploy/trial/gaia-x-demo/`（作成・確認・一括実行）と `public/.well-known/`、コミット `04a5fc36`。
署名の鍵は運営者の 1Password に置いてあり、リポジトリには入っていません。

## 試用サイトでは

Sepolia 向けに、このページのコードは変更していません。本家と同じに動きます。
Clio-X の参加機関が Gaia-X に加わるかどうかは、[相談したいこと](/ja/project/open-questions) の 9 番です。
