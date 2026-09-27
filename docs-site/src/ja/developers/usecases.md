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

画面で確かめたこと: 可視化ページに、終わったジョブが **Add** 付きで出ます（手元の `next dev` から公開中のノードへ、試用ウォレットのアドレスで。2026-09-27）。その先の、署名付きの `outputs.tar` の取得と図の表示は、ウォレットの鍵を使ってブラウザで確かめる必要があり、まだです。

## 限界

- ページに出るのは**自分の**ジョブ（つないだウォレットのもの）だけです。さらに試用環境では、**同じブラウザでポータルから流したジョブ**だけが出ます。Ocean Node 4.2.0 は無償ジョブの `inputDID` と `algoDID` を `null` で返すため、ポータルがジョブを流すときに両方をブラウザに控えています（`src/@utils/jobAlgorithmMemory.ts`）。CLI や別のブラウザで流したジョブ、この変更より前のジョブは出ません。
- 可視化ページの事業名は本家のまま _Email Text_、図の題も「Email Count Over Time」のままです。ザ・フェデラリストはそこに出ます。
- _Cameroon Gazette_ の可視化と、Cameroon / InterPARES / UdL のチャットボットは、引き続き Pontus-X だけです。
- 会話用サービスはノードと同じ VM で動きます（Ollama に 3 CPU、2.5 GiB）。答えは 1 度に 1 つずつで、2 つ走っている間に来た 3 つ目は「busy」になります。
