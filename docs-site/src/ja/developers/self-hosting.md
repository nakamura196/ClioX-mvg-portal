# Sepolia で Clio-X を自分で建てる

Clio-X の自分用の複製を、Sepolia のテストネットワークにつないで動かす手順です。
Pontus-X のネットワークとその会員資格には依存しません。
英語の原文は [Self-hosting Clio-X on Sepolia](/developers/self-hosting) です。内容が食い違うときは英語版を正とします。

構成は 3 つです。

| 部分           | 役割                                                                    | 動かす場所                                  |
| -------------- | ----------------------------------------------------------------------- | ------------------------------------------- |
| **ポータル**   | Clio-X のウェブアプリ（このリポジトリ）                                 | サーバレスのホスティング（Vercel の無料枠） |
| **Ocean Node** | カタログ（メタデータのキャッシュ）、プロバイダ、Compute-to-Data         | Docker が動く小さな Linux の仮想マシン      |
| **subgraph**   | ポータルが問い合わせる Ocean のコントラクトの出来事（価格、注文）の索引 | 同じ仮想マシン                              |

仮想マシン上のものはすべて Docker で動きます。ファイルは [`deploy/ocean-node/`](https://github.com/nakamura196/ClioX-mvg-portal/tree/docs/site/deploy/ocean-node) にあります。

Clio-X がノードと subgraph に送る HTTP と GraphQL の呼び出しは、[API（OpenAPI）](./api) にまとめています（OpenAPI 3.1、初回の試行で取った例つき）。

> 状況（2026-09-26）: すべての手順を、mdx の仮想マシン（東京大学、Ubuntu 24.04、6 vCPU / 8.8 GiB / 99 GB）と Vercel で済ませています。

## 公式のものと、この構成で足したもの

上流（本家）に頼れるのはどの部分か知りたい方は、ここから読んでください。

**公式のものをそのまま使う**（Ocean Protocol、改変なし）

| 部品                                                            | 補足                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `oceanprotocol/ocean-node:4.2.0`                                | `docker-compose.yml` の設定はすべて文書化されたノードの項目です: `RPCS`、`INDEXER_NETWORKS`、`DB_TYPE`、`DOCKER_COMPUTE_ENVIRONMENTS`（`free`、`fees`、`access` の各項目を含む）、`POLICY_SERVER_URL`                                                 |
| Sepolia 上の Ocean のコントラクト                               | 公式の配備です。ノードはイメージに同梱のアドレス一覧（`@oceanprotocol/contracts` 2.9.0）を使います: ERC721Factory `0xEF62…BeB1`、Router `0x2112…Fde5`、Dispenser `0x2720…893C`、FixedPrice `0x80E6…BaA8`、AccessListFactory `0x43eC…27E7`             |
| `graphprotocol/graph-node`、IPFS（kubo）、PostgreSQL、Typesense | 標準のイメージ                                                                                                                                                                                                                                        |
| 計算の利用制限                                                  | 3 つの方式とも Ocean Node に組み込まれています: アドレスの一覧、台帳上のアクセスリスト（AccessListFactory から発行する会員トークン）、検証可能な資格情報を確かめるポリシーサーバ（Pontus-X が Gaia-X の資格情報で利用を制限しているのはこの方式です） |

**Clio-X の上流から**（`ciferresearch/ClioX-mvg-portal`）: ポータルと、その Pontus-X ネットワーク用の設定。

**この構成で足したもの**（このフォークのみ。Ocean にも Clio-X の上流にもありません）

| 何を                                                                                           | なぜ                                                                                                                          | どこに                                                              |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| ポータルに Sepolia のネットワークを追加                                                        | Pontus-X の会員でなくても Clio-X を試せるようにするため。本番のネットワークは引き続き Pontus-X で、こちらは試用のための道です | `chains.config.js`                                                  |
| 自前の Ocean Node と subgraph                                                                  | Sepolia には Clio-X から使える公開の Ocean Node も subgraph も無いため                                                        | `deploy/ocean-node/`                                                |
| ブロック 11,459,550 から始める subgraph（Dispenser を固定のデータ源にし、`templateId` を補う） | Ocean の配備ブロックからの同期は、無料の RPC だと数日かかります。近道を成り立たせるのにこの 2 つの修正が要ります（4 節）      | `deploy/ocean-node/subgraph/`（上流の `ocean-subgraph` へのパッチ） |
| 計算の方針: 無償のジョブのみ、アドレスの一覧 1 つ、ネットワーク無し、2 CPU / 2 GiB             | ノードが仮想マシンの Docker を操作するので、公式の選択肢の中からこう選びました。Ocean の既定値ではありません                  | `DOCKER_COMPUTE_ENVIRONMENTS`                                       |
| 処理場所と、炭素量・費用の見積もり                                                             | Clio-X の持続可能性の取り組み。場所は計算環境の説明文から読み取ります                                                         | `src/@utils/computeFootprint.ts`                                    |
| mdx の仮想マシン、Cloudflare Tunnel、配備と秘密情報のスクリプト                                | 私たちのホスティングの方法です。ご自身の環境に置き換えてください                                                              | `deploy/ocean-node/scripts/`                                        |

## 計算を動かせる人

許可されていないウォレットからの計算ジョブは、ノードが断ります。
カタログを見ることと登録することには影響しません。どちらもチェーン上で行われるためです。
Ocean Node には許可する人を決める公式の方法が 3 つあり、この構成ではいま 1 つ目を使っています。

1. **アドレスの一覧**（`access.addresses`）。`C2D_ALLOWED_ADDRESSES` を直し、`push-node-secrets.zsh` と `deploy.zsh` を実行し直します。数人ならこれで足ります。
2. **台帳上のアクセスリスト**（`access.accessLists`）。公式の AccessListFactory から作るコントラクトで、会員ごとに譲渡できないトークンを 1 つ発行します。一覧はチェーン上で管理するので、会員を足してもサーバ側の変更は要りません。複数のノードで 1 つの一覧を共有することもできます（例: 参加機関すべてで 1 つの一覧）。
3. **ポリシーサーバ**（`POLICY_SERVER_URL`）。ジョブを受け付ける前に検証可能な資格情報を確かめます。Pontus-X の方式です。

計算に料金を取る仕組み（`fees`）も公式にありますが、Sepolia ではトークンが無料なので、誰も制限できません。

## 1. 仮想マシン

動く最低限は **RAM 6 GiB、2 vCPU、ディスク 40 GB** です。
計算ジョブに 2 GiB を割り当てられるよう、私たちは 8.8 GiB を使っています。
Docker Engine を compose プラグインつきで入れ、SSH で使うユーザーを `docker` グループに加えます。
受け付けるポートを開ける必要はありません。公開の入口は Cloudflare Tunnel が作ります（5 節）。

固定しているイメージ（`docker-compose.yml`）: `ocean-node:4.2.0`、`typesense:26.0`、`graph-node:v0.45.0`、`kubo:v0.43.1`、`postgres:14`、`cloudflared:2026.9.3`。
イメージは合わせて約 5 GB です。

## 2. 秘密情報

仮想マシンの `/opt/cliox-node/.env` にすべての秘密情報を置きます（権限 600）。
コミットせず、手元にコピーすることもしません。[`.env.example`](https://github.com/nakamura196/ClioX-mvg-portal/blob/docs/site/deploy/ocean-node/.env.example) を参照してください。

- `TYPESENSE_API_KEY` と `GRAPH_POSTGRES_PASSWORD` は、配備スクリプトが仮想マシン上で生成します。
- `PRIVATE_KEY` はノードの身元とプロバイダの鍵です（`0x` + 16 進 64 桁）。残高は要りません。**既存のノードを移すときは、その鍵を使い回してください。** そのノードを通して登録した資料のファイル URL は、その鍵に向けて暗号化されています。新しい鍵では、誰もそれらで計算を動かせません。
- `C2D_ALLOWED_ADDRESSES` は、計算ジョブを動かしてよいウォレットの一覧です。

```zsh
zsh deploy/ocean-node/scripts/push-node-secrets.zsh <ssh-host> "<1Password の項目>" <フィールド> '["0xYourWallet"]'
```

このスクリプトは鍵を 1Password から読み、SSH の標準入力で送ります。
画面にも、シェルの履歴にも、手元のディスクにも残りません。

## 3. ノードと subgraph を起動する

```zsh
zsh deploy/ocean-node/scripts/deploy.zsh <ssh-host>
zsh deploy/ocean-node/scripts/deploy.zsh <ssh-host> subgraph
zsh deploy/ocean-node/scripts/deploy.zsh <ssh-host> status
```

2 行目の `subgraph` は、初回と、subgraph を変えたあとに実行します。
subgraph は仮想マシン上のコンテナの中でビルドします（`deploy/ocean-node/subgraph/Dockerfile`）。手元に Node.js や `graph-cli` は要りません。

## 4. 時間を取られたところ

**計算はホストの Docker ソケットを通して動きます。**
ノードは `/var/run/docker.sock` からジョブのコンテナを起動します。これはその仮想マシンの root と同じ権限です。
ノードは専用の仮想マシンに置き、ほかのサービスと同居させないでください。
そのうえで compose ファイルでは、無償のジョブだけ（料金の設定が無いので、払って入ることもできない）、`C2D_ALLOWED_ADDRESSES` の人だけ、ジョブの中はネットワーク無し、としています。

**ノードのインデクサが使う RPC は、広い範囲の `eth_getLogs` を受け付ける必要があります。**
2026 年 8 月の実測: publicnode はアドレス指定の無い `eth_getLogs` を断ります。Alchemy の無料枠は 10 ブロック、1rpc.io は 50 ブロックまでです。Tenderly の公開ゲートウェイは 10,000 ブロックを約 300 ms で返します。
範囲を断られても、インデクサは読んだ位置を先へ進めてしまいます。そのため、その資料は黙ったまま索引に入りません。

**graph-node が使う RPC は、過去の状態（アーカイブ）を返せる必要があります。**
subgraph の処理は過去のブロックでコントラクトを呼びます。publicnode では "historical state is not available" で失敗します。

**`DB_TYPE=typesense` は明示して設定します。**
既定は Elasticsearch で、その資格情報が無いとインデクサが止まります。

**subgraph の `startBlock` を後ろにずらすには、修正が 2 つ要ります。**
Sepolia を Ocean の配備ブロック（3,722,802）から同期すると、無料の RPC では数日かかります。
11,459,550（私たちの最初の登録の直前）から始めると数分で終わりますが、次の問題が出ます。

1. `Dispenser` は _テンプレート_ で、配備時の出来事によって作られます。これが無いと、資料のページに "No pricing schema available for this asset." と出ます。Sepolia では決まったコントラクトなので、`subgraph.sepolia.yaml` で固定のデータ源として宣言しています。
2. NFT とデータトークンの `templateId` は、テンプレート登録の出来事を見たときにだけ保存されます。見ていないと 0 になり、ポータルは注文も計算ジョブも始められません。`template-id-fallback.patch` で、代わりにチェーンから読み取るようにしています。

開始を後ろにずらすと `opcs` は空のままです。ポータルはこれをログに出すだけです。

**2 階層のホスト名（`a.b.example.org`）には証明書が出ません。**
Cloudflare の無料の Universal SSL では、ゾーンの 1 つ下の階層を使ってください。

**ノードは自分の公開 URL に届く必要があります。**
暗号化された資料を索引に入れるとき、ノードはチェーンに記録された復号の URL を呼びます。それはノード自身の公開 URL です。
この呼び出しは仮想マシンを出て、Cloudflare を通って戻ってきます。
ボット対策（Super Bot Fight Mode）は、仮想マシンのデータセンターのアドレスをボットと見なし、チャレンジで応答しました（403、`cf-mitigated: challenge`）。そのため、新しく登録した暗号化された資料が索引に入りませんでした。
ノードのログには "Provider validation failed: Forbidden" としか出ません。
仮想マシンから `curl -s -o /dev/null -w "%{http_code}" https://<ノードのホスト名>/` で確かめてください（200 が正常）。
Super Bot Fight Mode はホスト名ごとには切れません。ただ、仮想マシンのアドレスに対して動作「Skip」の WAF カスタムルールを作れば迂回できます: `scripts/cloudflare-allow-node.zsh`。
ノードの API を呼ぶほかのサーバ（ほかのノード、サーバレス関数）も、同じようにチャレンジされるおそれがあります。

**ocean-cli 2.1.0 の `--encrypt false` は、Ocean Node 4.2.0 に断られます**（`indexedMetadata` が原因のハッシュ不一致）。[CLI で登録と無償の計算](./trial-run) を参照してください。

**ノードは Typesense の準備が済んでから起動する必要があります。**
ノードは、検索が「見つからない」と答えたときにだけ、自分のコレクション（`indexer`、`op_ddo_*`）を作ります。
Typesense がまだ起動中だと、検索は別の形で失敗し、何も作られません。
するとインデクサは読んだ位置を保存できず、約 90 秒ごとに `startBlock` からやり直します。検索は 500 を返し、ポータルは「0 件」と表示します。
ログには `Error updating last indexed block ... Not Found` と出ます。
いまの compose ファイルは、Typesense の `/health` を待ってからノードを起動します。
古い構成でこれが起きたら、ノードだけを再起動してください: `docker compose restart ocean-node`。

**ほかのノードを通して登録した資料は、自分のノードに移せません。**
インデクサは暗号化された資料に出会うと、登録時にチェーンに記録されたノード（URL）に復号を頼みます。
鍵が同じでも、自分の鍵で試すことはしません。
そのノードが無くなっていれば、資料は索引に入りません。資料の `serviceEndpoint` も古いノードを指したままなので、どのみち注文も計算ジョブも失敗します。
新しいノードを通して登録し直してください。
また、応答しない URL が 1 つあるごとに、インデクサは追いつくまでの間、出来事 1 件につき約 20 秒を時間切れで失います。
登録は、IP アドレスではなく自分が管理するホスト名で行ってください。同じ鍵を持つ後継のノードが引き継げるようになります。
アーキビスト向けには、同じ点を [登録に使ったサービスが無くなったとき](/ja/archivists/when-a-node-closes) で説明しています。

## 5. 公開の入口（Cloudflare Tunnel）

仮想マシンは SSH 以外に受け付けるポートを開けません。
`cloudflared` が Cloudflare へ外向きにつなぎ、Cloudflare は HTTPS の要求をその接続を通して送り返します。
振り分けは `deploy/ocean-node/cloudflared/config.yml` にあります: ノード → `http://ocean-node:8001`、subgraph → `http://graph-node:8000`（graph-node の管理用ポートは公開しません）。
ホスト名はご自身のゾーンのものに変えてください。

`cloudflared` がそのゾーンにログインし、`op` にサインインした状態で:

```zsh
zsh deploy/ocean-node/scripts/setup-tunnel.zsh <ssh-host> cliox-node
zsh deploy/ocean-node/scripts/deploy.zsh <ssh-host>
```

1 つ目のスクリプトは、トンネルと DNS レコードを作り、接続用のトークンを 1Password に保存し、仮想マシンの `.env` に `CLOUDFLARE_TUNNEL_TOKEN` として書き込みます。
それが設定されていれば、`deploy.zsh` が `cloudflared` を起動します。

mdx は外向きの UDP を止めています。そのため既定の QUIC ではつながらず、ホスト名は Cloudflare のエラー 1033 を返します。
compose ファイルでは `cloudflared` を `--protocol http2`（TCP 443）で動かしています。

## 6. ポータル

`chains.config.js` の Sepolia の項目は、2 つのホスト名を指しています（`providerUri`、`providers`、`metadataCacheUri`、`subgraphUri`）。
プロバイダのアドレスはノードのものにします（ノードに `GET /` すると `providerAddress` が返ります）。

Vercel（Hobby プラン）では:

1. リポジトリ（ご自身のフォーク）を取り込みます。フレームワークは Next.js と自動で判定されます。
2. Node.js のバージョンは **22.x** にします。アプリは `"engines": {"node": "22"}` を宣言しています。より新しい版ではサーバ側の描画が壊れます。
3. 環境変数 `NEXT_PUBLIC_METADATACACHE_URI` にノードの URL を入れます。カタログの検索は `chains.config.js` より先にこれを読み、既定値は Pontus-X のカタログです。
   ポータルは、URL に "aquarius" を含まないものを Ocean Node と見なし、検索の絞り込みを自分で行います。Ocean Node は Elasticsearch の `term` / `terms` の絞り込みに空の一覧を返すためです。上書きするには `NEXT_PUBLIC_METADATACACHE_OCEAN_NODE=true` か `false` を設定します。
4. サイトを公開しないうちは、Vercel Authentication（Deployment Protection）を有効のままにします。開けるのは Vercel アカウントの会員だけです。
   ただし Hobby プランでは、本番のドメイン（`<project>.vercel.app`）は保護の対象に **なりません**。誰でも開けます。公開したくなるまで、Settings → Domains でそのドメインを外してください。
5. 非公開のまま試用に決まった名前を付けるには、独自ドメインを本番ではなく **ブランチ** に割り当てます: `POST /v10/projects/<id>/domains` に `{"name": "cliox.ldas.jp", "gitBranch": "deploy/hosting"}` を送ります（CLI の `vercel api` で送れます）。
   ブランチのドメインはプレビュー扱いなので、Vercel Authentication がかかったままです（確認済み: ログインしていない要求は Vercel のログインに転送されます）。
   Cloudflare では、Vercel が勧める CNAME を、プロキシ **無し**（DNS のみ）で追加します。Cloudflare のボット対策を通り道に入れないためです。

## 7. 炭素量の見積もりに使う処理場所

ポータルは、計算環境の説明文から処理場所を割り出します。Ocean Node は環境の ID をハッシュで公開するので、ID は使えません。
`src/@utils/computeFootprint.ts` は、説明文に `mdx` を含むものを「mdx, Kashiwa II campus, Japan」に対応づけています。
ただし、まだ炭素量の数値は出していません。それには仮想マシンの電力の実測値が要ります。私たちは、実測の値か、区分をはっきり示した値しか入れないことにしています。
