# 「可視化」と「チャットボット」を Sepolia で動かす

ポータルには、計算ジョブの結果を「見られる形」にするページが 2 つあります。

- **可視化**（`/usecases/visualizations`）: 語の雲、日ごとの感情の傾向、日ごとの文書数、全体の要約。
- **チャットボット**（`/usecases/chatbot`）: 文書の抜粋をもとに質問に答える。

本家では、どちらも Pontus-X の資料しか扱えません。
このページは、Sepolia の試用環境で動かすために足したものと、別の場所で同じように建てる手順の記録です。
ポータルの変更はブランチ `feat/usecases-sepolia` にあり、`deploy/hosting` に取り込みました。コミットは下に挙げます。

## 2 つのページの仕組み

どちらのページも、自分では何も計算しません。流れは同じです。

1. **決まったアルゴリズム**を、**決まったデータセット**に対して計算ジョブとして流す。
2. ページは、自分のジョブのうち、アルゴリズムとデータセットの DID がポータルのコードに書かれた一覧に入っているものだけを並べる（一覧はネットワークごと）。
3. 終わったジョブで **追加** を押すと、ページがブラウザでジョブの結果を取りに行き（ウォレットで署名）、**ファイル名で**中身を見分けて読む。

| ページ         | 探すもの                                                                                                     | DID の一覧                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| 可視化         | `wordcloud*`、`sentiment*`、`date_distribution*`、`email_distribution*`、`document_summary*`（JSON か CSV）  | `src/components/TextAnalysis/_constants.ts`                                |
| チャットボット | 名前に `final_output` を含むファイル（JSON。`{id, content, metadata}` の並び）。これを会話用のサービスに送る | `src/components/ChatbotUnified/_constants.ts` → 事業ごとの `_constants.ts` |

チャットボットには、これとは別に**会話用のサービス**が要ります。ポータルのサーバー側の窓口 `/api/chatbot/*` が、`CHATBOT_API_URL` にあるそのサービスへ取り次ぎます。

## Sepolia で動かなかった理由

2026-09-27 に、`deploy/hosting`（`a3e93a55`）のコードと、試用 VM 上の Ocean Node 4.2.0 のコードを読んで確かめました。

1. **DID の一覧に Pontus-X（チェーン番号 32456）しか無かった。** Sepolia（11155111）ではどのジョブも当たらず、ページは空のままでした。
2. **Ocean Node 4.x は結果を `outputs.tar` 1 つで返す。** ノードはジョブの `/data/outputs` を Docker の `getArchive` でそのまま `outputs.tar` に保存します（`dist/components/c2d/compute_engine_docker.js`）。ジョブの結果は `image.log`、`configuration.log`、`algorithm.log`、`outputs.tar` の 4 つです。ページは `wordcloud.json` のような名前を探すので、何も見つけられませんでした。これは Sepolia に限らず、Ocean Node 4.x の上のポータルすべてに当てはまります。
3. **会話用のサービスが無く、本家の公開版はポータルに合わなくなっていた。** [ciferresearch/Cliox-rag-chatbot-backend](https://github.com/ciferresearch/Cliox-rag-chatbot-backend)（最終コミット 2025-07-17）は `/chat` に JSON を 1 つ返します。いっぽうページは、少しずつ届く応答（server-sent events）を読みます（`src/@utils/chatbot/index.ts` の `streamChat`）。`DELETE /knowledge/session` もありません。リポジトリにライセンスの記載がありません。本家がいま動かしているサービスは公開されていません。

## 足したもの

| 内容                                                                                                                                               | 場所                                                                                                                  | コミット               |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `outputs.tar` をブラウザで開き、中のファイルを名前付きで渡す                                                                                       | `src/@utils/computeResultFiles.ts`、2 つの `JobList.tsx`                                                              | `39bd5c29`             |
| 会話用サービスへ共有鍵を付けて送る（`CHATBOT_API_KEY` があるときだけ）                                                                             | `src/@utils/chatbot/upstreamAuth.ts`、`src/pages/api/chatbot/*.ts`                                                    | `f4914b6f`             |
| 可視化用・知識用のアルゴリズムと、ザ・フェデラリストの標本                                                                                         | `deploy/trial/algorithm/`、`deploy/trial/sample/`                                                                     | `dcf93888`             |
| 小さな会話用サービスと Ollama。鍵を置いたときだけ起動                                                                                              | `deploy/ocean-node/chatbot/server.py`、`docker-compose.yml`（profile `chatbot`）                                      | `412841d5`             |
| 3 つの資産を公開し、試しのジョブを 2 つ流すスクリプト                                                                                              | `deploy/trial/usecases.zsh`、`deploy/trial/metadata/*`                                                                | `7808ea0c`             |
| Sepolia の DID。チャットボットに「Trial samples (Sepolia)」を足し、Sepolia では先頭に並べる                                                        | `src/components/TextAnalysis/_constants.ts`、`src/components/ChatbotTrial/`、`ChatbotUnified/`                        | `fb777a6d`             |
| 無償ジョブを自前ノードから一覧に出す。ジョブのデータセットも控える。結果の取得を Ocean Node の署名方式にする。ウォレットをつないだら一覧を取り直す | `src/@utils/compute.ts`、`src/@utils/jobAlgorithmMemory.ts`、`src/@utils/computeResultFiles.ts`、3 つの `JobList.tsx` | `a64cb256`             |
| 会話用の鍵を `serverRuntimeConfig` から読む。会話用サービスが分割送信の本文を読む                                                                  | `next.config.js`、`upstreamAuth.ts`、`server.py`                                                                      | `2357e5ee`、`d1fa37fb` |
| 会話用のホスト名だけ、Vercel が Cloudflare のボット対策を通れるようにする                                                                          | `deploy/ocean-node/scripts/cloudflare-allow-chatbot.zsh`                                                              | `02a74775`             |

### アルゴリズム

どちらも Python 1 ファイルで、標準ライブラリだけを使います。`python:3.12-slim`（ダイジェストで固定）で、ネットワークを切って動きます。
読めるのは、ふつうのテキスト、TEI/XML（タグを除く）、それらをまとめた `.tar.gz` / `.zip` です。

- `text_analysis.py` は、可視化ページが読む 5 つのファイルを書きます。
  時系列に載せるには、文書の冒頭に `Date: 1787-11-22`（またはメール形式の日付）の行を置き、空行で本文と分けます。日付の無い文書も、語の雲と要約には数えます。
  感情は、文ごとに短い単語表で数えます。**図を見せるためのもので、確かめられた感情分析ではありません。**
  日本語では、漢字またはカタカナが 2 字以上続くところを 1 語とします。読みやすさの指数と 1 文あたりの語数は、日本語では意味を持ちません。
- `chatbot_knowledge.py` は、文書を約 250 語（日本語は約 400 字）ずつの抜粋に分け、`final_output.json` に書きます。
  **ほかの標本と違い、本文そのものを（切れ端として）返します。** 引用してよい資料にだけ使ってください。

ノードと同じコンテナで `--network none` にして手元で測った値です。ザ・フェデラリスト（85 篇）で 185,897 語、発行日 76 日分、多い語は _states_ 845、_government_ 824。抜粋は 930 個（JSON で 1.5 MB）。
独立宣言の標本では、以前の `word_frequency.py` のジョブと語数が一致しました（_people_ 10、_laws_ 9、_states_ 8）。

### 標本: ザ・フェデラリスト

85 篇を 1 篇 1 ファイルにし、`Title`、`Author`、`Published`、`Date` の見出しを付けたものです。Project Gutenberg の電子書籍 #1404 から `deploy/trial/sample/build_federalist.py` で作りました（同じ元から同じファイルができます。sha256 `5bf1b484…`）。
パブリックドメインの英語で、しかも**日付がある**（1787 年 10 月 27 日〜1788 年 5 月 28 日）ので、どの図にも中身が出ます。
作るときに、各篇の日付と、一緒に書かれた曜日を突き合わせています。これで Gutenberg の本文の誤りが 1 つ見つかりました（No. 26 の「Saturday, December 22, **1788**」。1788 年 12 月 22 日は月曜日で、実際の掲載は 1787 年 12 月 22 日の土曜日）。

### 会話用のサービス

`deploy/ocean-node/chatbot/server.py` は、ポータルが呼ぶ 6 つの窓口だけを持ちます。

| 窓口                                       | すること                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------ |
| `GET /api/health`                          | `{status, ollama_connected, model}` を返す（鍵が要らないのはここだけ）   |
| `POST /api/v1/session/knowledge/upload`    | セッションに抜粋を覚える（メモリの中だけ）                               |
| `GET /api/v1/session/knowledge/status`     | 覚えている抜粋の数                                                       |
| `DELETE /api/v1/session/knowledge/session` | セッションを忘れる                                                       |
| `POST /api/v1/session/chat`                | 答えを server-sent events（`status`、`chunk`、`complete`）か JSON で返す |

質問に近い抜粋を 4 つ BM25（語の一致による検索の定番の計算式）で選び、Ollama（手元で言語モデルを動かす道具）で動くモデルに、その抜粋だけから答えさせます。答えにはどの抜粋を使ったかを添えます。
モデルは `qwen2.5:1.5b`（約 1 GB）。本家の既定 `llama3.2:1b` より日本語が扱えるため選びました。
使われないセッションは 2 時間で消えます。ディスクには何も書きません。
health 以外の呼び出しには `X-Chatbot-Key` の見出しが要ります。鍵は 1Password、VM の `.env`、ポータルの Vercel の設定にあります。

Mac（CPU、Docker）でザ・フェデラリストの 930 個の抜粋を読ませて測りました。「What does Madison say about factions?」→ No. 10 の定義を答え、出典は No. 10 が 3 つと No. 24、5.8 秒。「Why is a standing army dangerous?」→ 出典は No. 26、29、24、2.9 秒。
英語の抜粋に日本語で聞くと、何も見つかりません。検索が語の一致によるためです。そのときはモデルを呼ばず、見つからないと日本語で返します。
試用 VM で、公開中のポータル経由（`https://cliox.ldas.jp/api/chatbot/*`）で測りました（2026-09-27）。同じ 930 個の抜粋を読ませたあとです。

| 質問                                                 | 答え（抜粋）                                                  | 出典                   | 時間                              |
| ---------------------------------------------------- | ------------------------------------------------------------- | ---------------------- | --------------------------------- |
| What does Madison say about factions?                | 「共通の利害で結びつき、他の市民の権利に反する…市民の集まり」 | No. 10 が 3 つ、No. 24 | 25.6 秒（モデルの読み込みを含む） |
| How long do senators serve, according to the papers? | 「資料には書かれていない」                                    | No. 80、81、18、85     | 14.9 秒                           |
| 派閥について何と書いてありますか                     | 決まった返事（一致する語なし）                                | なし                   | 0.01 秒                           |

2 つ目は、語の一致で探すことの限界を示しています。上院の任期を述べた篇（No. 62〜63）は「senate」「six years」と書いており、「senators serve」とは書いていないため、拾えませんでした。モデルは指示どおり、作り話をせず「書かれていない」と答えました。

### 回答を Claude に替えたときの比較

サービスは、答えを書くモデルを Claude（Anthropic API、`claude-opus-5-5`、考える量は `low`）に替えられます。VM の `.env` に `CHATBOT_BACKEND=anthropic` と `ANTHROPIC_API_KEY` を書いて `deploy.zsh` を流します。鍵は 1Password の「Clio-X chatbot Anthropic API key」です。
抜粋を選ぶ検索は同じなので、**モデルに渡る抜粋は両方で同じ**です。違うのは、それをどう読んでどう書くかだけです。

同じ 930 個の抜粋と同じ 8 問で、手元の Mac で比べました（2026-09-30）。

| 質問                                                             | qwen2.5:1.5b                                                        | Claude                                                                              |
| ---------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| What does Madison say about factions?                            | 派閥の定義を 1 文で引用                                             | 定義、2 つの対処法（原因を除く／影響を抑える）、多数派の派閥が危ない理由まで        |
| How long do senators serve, according to the papers?             | 「書かれていない」                                                  | 「書かれていない」。No. 18 の元老院は古代の同盟の話で、合衆国の上院ではないとも説明 |
| Why is a standing army dangerous?                                | 「自由にとって危険」と 1 文                                         | No. 26 の名誉革命の例など、抜粋にある理由を挙げ、抜粋では理由が十分でないことも明記 |
| Why does Hamilton call the judiciary the least dangerous branch? | 剣も財布も持たない、と正しく 1 文                                   | 同じ論点を 4 つに分けて説明                                                         |
| How do No. 10 and No. 51 differ in how they control factions?    | **誤り**。No. 10 が退けた「道徳・宗教による抑制」を対処法として説明 | 正しく対比。渡された No. 51 の抜粋が派閥に直接触れていないことも明記                |
| What did Lincoln say at Gettysburg?                              | 「書かれていない」                                                  | 「書かれていない」。資料は 1787 年のもので、演説は 1863 年だと説明                  |
| 派閥について何と書いてありますか                                 | 決まった返事（一致する語なし）                                      | 同じ（検索の段階で止まり、モデルは呼ばれない）                                      |
| What does Federalist No. 51 say about ambition?                  | 「野心には野心で対抗させよ」と 1 文                                 | その文と、前後の論理（「人が天使なら政府は要らない」など）                          |

分かったこと:

- **Claude は答えが詳しく、誤りがありませんでした。** qwen は短く、比べる問い（No. 10 と No. 51）で本文と逆のことを書きました。
- **どちらも作り話はしませんでした。** 抜粋に無いことは「書かれていない」と答えました。
- **検索の限界は変わりません。** 上院の任期と日本語の質問は、どちらのモデルでも答えられません。直すなら検索のほうです。
- **時間。** Claude は 1 問 2.7〜15.8 秒（中央値 6.9 秒）。VM の CPU を使わないので、VM の上でもほぼ同じはずです。qwen は Mac では 1 秒以下ですが、VM では 15〜26 秒かかりました（上の表）。
- **費用。** Claude は 1 問あたり入力 約 1,600 トークン、出力 約 330 トークンで、**約 1.3 セント（約 2 円）**でした（入力 $4／出力 $20、100 万トークンあたり）。qwen は無料です。

公開サイトの誰でも質問できるので、Claude に替えると費用は質問の数に比例して増えます。同時に答えるのは 2 問まで（`MAX_PARALLEL`）ですが、1 日の上限はありません。下の「サインインと質問数の上限」で件数を絞れます。Anthropic の Console でも、この鍵の使用額に上限を設定しておいてください。

### サインインと質問数の上限（任意）

Claude は 1 問ごとに費用がかかるので、使える人と件数を絞れるようにしました。**どれも設定したときだけ働きます。** 設定しなければ、本家と同じく誰でも質問できます。

- **ポータル（Vercel）: `CHATBOT_REQUIRE_SIGNIN=true`。** ヘッダーでウォレットを接続した人が最初の質問を送ると、ウォレットが短い文への署名を求めます（Sign-In with Ethereum の形式。取引は送られず、手数料もかかりません）。サインイン用のボタンは置いていません。接続と署名が 2 つの手順に見えて分かりにくかったためです。ポータルのサーバ側で署名した人のアドレスを確かめ、7 日間有効な cookie を渡します。チャットの窓口は、そのアドレスをチャットのサービスに送ります。コードは `src/@utils/chatbot/signin.ts` と `src/pages/api/chatbot/signin.ts` です（`deploy/hosting` の 7c62fa08。チャットのサービス側は 77d27bfa）。
- **チャットのサービス（VM の `.env`）:**
  - `CHATBOT_DAILY_LIMIT_PER_USER`: 1 つのアドレスが 1 日に聞ける数
  - `CHATBOT_DAILY_LIMIT_TOTAL`: サイト全体で 1 日に答える数。**費用の本当の上限はこちらです。** ウォレットは誰でも無料でいくつでも作れるので、アドレスごとの上限だけでは費用を抑えられません
  - `CHATBOT_ALLOWED_USERS`: 質問できるアドレスの一覧。`C2D_ALLOWED_ADDRESSES` と同じ一覧にすれば、試用のウォレットだけに絞れます

数えるのは、モデルが答えを書いた質問だけです。資料に一致する語がなく、決まった返事で終わった質問は数えません。日付は UTC で区切ります。件数は VM のボリュームに残すので、再起動しても元に戻りません。上限に達すると、質問の言語（日本語か英語）で知らせます。

手元で確かめたこと（2026-09-30。1 アドレス 2 件の上限を付けて、使い捨てのウォレットで署名）:

| 試したこと                   | 結果                                     |
| ---------------------------- | ---------------------------------------- |
| サインインせずに質問         | 断られる（401 `signin_required`）        |
| 別のウォレットで署名         | 断られる（署名がアドレスと合わない）     |
| 文のアドレスを書き換えて署名 | 断られる（このサイトが出した文ではない） |
| cookie を書き換える          | 断られる                                 |
| サインインして 2 問          | Claude が答える                          |
| 3 問目                       | 「今日の質問は上限（2 件）に達しました」 |
| 上限だけ付けて再起動         | 数えた件数が残っている                   |
| 何も設定しない               | これまでどおり、誰でも質問できる         |

**順番に注意してください。** VM 側で上限か一覧を設定したのに、ポータル側で `CHATBOT_REQUIRE_SIGNIN` を付けていないと、全員が「サインインしてください」と言われて質問できなくなります。ポータル側を先に設定してください。

## 別の場所で建てる手順

[Self-hosting on Sepolia](/developers/self-hosting)（英語）のノードと Cloudflare Tunnel があり、ポータルは Vercel にある前提です。

1. **アルゴリズムとデータセットを公開する。** `zsh deploy/trial/usecases.zsh` が、試用ウォレットでザ・フェデラリストと 2 つのアルゴリズムを公開し、索引に載るのを待って、それぞれのアルゴリズムで無償のジョブを 1 つずつ流します。自分のファイルを使うなら、先に `metadata/*.json` を直します（ファイルの URL は固定したコミットを指すこと）。
2. **DID をポータルに書く。** 表示された DID を、`src/components/TextAnalysis/_constants.ts`（アルゴリズムとデータセット）と `src/components/ChatbotTrial/_constants.ts` の `11155111` の下に足します。データセット側がそのアルゴリズムを信頼している必要があります。標本は「すべて可」（`"*"`）にしてあります。
3. **会話用サービスのホスト名を作る。** `deploy/ocean-node/cloudflared/config.yml` に足し（ここでは `cliox-chat.ldas.jp`）、DNS を作ります: `cloudflared tunnel route dns cliox-node cliox-chat.ldas.jp`
4. **鍵を作り、VM と Vercel に渡す:**
   `zsh deploy/ocean-node/scripts/setup-chatbot.zsh mdx-clio https://cliox-chat.ldas.jp <Vercel のプロジェクト ID> <Vercel のチーム ID>`
   鍵は 1Password が作ります。画面にもディスクにも出ません。
5. **起動する:** `zsh deploy/ocean-node/scripts/deploy.zsh mdx-clio`。`.env` に `CHATBOT_API_KEY` があるので、`chatbot` と `ollama` が加わり、モデルを 1 度だけ取ってきます（約 1 GB）。
6. **ポータルを配り直す。** 関数が `CHATBOT_API_URL` と `CHATBOT_API_KEY` を読めるようにするためです。

7. **Vercel から Cloudflare を通れるか確かめる。** 試用環境では、`https://cliox.ldas.jp/api/chatbot/health` が最初 `Health check failed: Forbidden` を返しました。ゾーンのボット対策が Vercel のサーバーを止めていました（ノードの VM が止められたのと同じです。[分かっている問題](/ja/developers/known-problems)）。`zsh deploy/ocean-node/scripts/cloudflare-allow-chatbot.zsh` で、会話用のホスト名だけを対象に外しました（規則 `313d8c02…`、2026-09-27）。鍵の無い呼び出しは、サービス側で引き続き断ります。

## 使い方（試用サイトで）

**チャットボットをすぐ試すだけなら、ジョブは要りません。** チャットボットのページで _Trial samples (Sepolia)_ を選び、「見本を読み込む」を押します。下の 2. の Knowledge passages と同じ抜粋 930 個（`public/samples/chatbot/federalist-knowledge.json`、`chatbot_knowledge.py` の出力そのもの）が読み込まれます。
置いた理由: このページの Compute Jobs の一覧には、そのブラウザでポータルから始めたジョブしか出ません。初めて来た人には一覧が空で、質問できませんでした（2026-09-30 に指摘を受けて確認）。

自分でジョブを流して試すとき:

1. 無償のジョブを流せるウォレットを Sepolia でつなぎます（[CLI のページ](/ja/developers/trial-run)を参照）。
2. ザ・フェデラリストの資料を開き、アルゴリズム **Text analysis** を選んで無償のジョブを始めます。チャットボット用には **Knowledge passages** で同じことをします。
3. ジョブが終わったら、**可視化**（事業名 _Email Text_）か **チャットボット**（事業名 _Trial samples (Sepolia)_）を開き、そのジョブを追加します。

2026-09-27 に試用ウォレット（`0xedAa…262E`）で公開したもの:

| 資産                                         | DID                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------- |
| ザ・フェデラリスト 85 篇（データセット）     | `did:op:88084b2a810deca76dde649e3598410445b199379c3709a6d9d9d948f8484a9c` |
| 可視化用の分析（Text analysis）              | `did:op:83879b6695a4aae100753eff91487feafe82d8cf7cbd679afaad9654c1c0f09b` |
| チャットボット用の抜粋（Knowledge passages） | `did:op:4178768987eb40f3639ca75bb17fa7efd41476cbd957379dde54c6bc6d1b326f` |

それぞれのアルゴリズムで無償のジョブを 1 つずつ流し、どちらも終了コード 0 でした。ノードの `outputs.tar` の中身は、手元で動かしたときと同じ 5 ファイル（と同じ 1.49 MB の `final_output.json`）でした。

画面で確かめたこと: 可視化ページに、終わったジョブが **Add** 付きで出ます（手元の `next dev` から公開中のノードへ、試用ウォレットのアドレスで。2026-09-27）。
公開中のポータル（`cliox.ldas.jp`）でも、ブラウザの MetaMask から無償ジョブを始められました（試用ウォレットとは別の、許可済みのアドレス。2026-09-27 20:38 UTC）。ジョブは 13 秒で終わり、そのあと、当時は 1 時間ごとだった精算を待って「ジョブを精算中」になりました（[分かっている問題](/ja/developers/known-problems)）。
2026-09-30、このジョブを公開中の可視化ページで **Add** から取り込みました。Ocean Node から結果を取るための MetaMask の署名（`personal_sign`）が 1 回あり、`outputs.tar` をブラウザで展開して、4 つの図がすべて出ました。Email Analysis Distribution、Email Count Over Time（1787 年 11 月〜1788 年 5 月。最後の日付に 8 篇）、Sentiment Analysis by Category、Word Cloud（上位語は _government_、_states_、_people_、_power_）です。

## 限界

- ページに出るのは**自分の**ジョブ（つないだウォレットのもの）だけです。さらに試用環境では、**同じブラウザでポータルから流したジョブ**だけが出ます。Ocean Node 4.2.0 は無償ジョブの `inputDID` と `algoDID` を `null` で返すため、ポータルがジョブを流すときに両方をブラウザに控えています（`src/@utils/jobAlgorithmMemory.ts`）。CLI や別のブラウザで流したジョブ、この変更より前のジョブは出ません。
- 可視化ページの事業名は本家のまま _Email Text_、図の題も「Email Count Over Time」のままです。ザ・フェデラリストはそこに出ます。
- _Cameroon Gazette_ の可視化と、Cameroon / InterPARES / UdL のチャットボットは、引き続き Pontus-X だけです。
- ジョブが終わってから一覧に出るまで、最長 5 分かかります。ノードが 5 分に 1 回の精算（2026-09-30 までは 1 時間に 1 回）を終えるまで「ジョブを精算中」のままで、ページは「完了」のジョブしか並べないためです。
- この 2 ページは、ポータルを日本語に切り替えても英語のままです。
- 会話用サービスはノードと同じ VM で動きます（Ollama に 3 CPU、2.5 GiB）。答えは 1 度に 1 つずつで、2 つ走っている間に来た 3 つ目は「busy」になります。
