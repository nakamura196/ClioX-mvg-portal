# 開発者の方へ

2026 年 9 月に、試験用ネットワーク Sepolia の上に Clio-X 一式を自分で建てました。その記録です。
Pontus-X の加盟が無くても動き、すべて無料枠で運用しています。

<Architecture lang="ja" />

| 部分       | ソフトウェア                                              | 置き場所                                                   |
| ---------- | --------------------------------------------------------- | ---------------------------------------------------------- |
| ポータル   | Clio-X（`ciferresearch/ClioX-mvg-portal` のフォーク）     | Vercel（Hobby）                                            |
| Ocean Node | `oceanprotocol/ocean-node:4.2.0` + Typesense              | mdx の仮想マシン（6 vCPU / 8.8 GiB / 99 GB、Ubuntu 24.04） |
| subgraph   | `graphprotocol/graph-node` v0.45.0 + IPFS + PostgreSQL 14 | 同じ仮想マシン                                             |
| 公開の入口 | Cloudflare Tunnel（`--protocol http2`）                   | 受け付けるのは SSH だけ                                    |

## 構築手順の要点

詳しい手順は **[Sepolia で Clio-X を自分で建てる](./self-hosting)** にあります。要点は次のとおりです。

- **公式のまま使うもの。** Ocean Node 4.2.0 の設定はすべて公式の項目です。Sepolia の Ocean のコントラクトは公式の配備で、アドレスの一覧もイメージに同梱のもの（`@oceanprotocol/contracts` 2.9.0）を使います。
- **この構成で足したもの。** ポータルへの Sepolia の追加、自前の Ocean Node と subgraph、ブロック 11,459,550 から始める subgraph（公式の配備ブロックからでは無料の RPC で数日かかるため、パッチ 2 つで短縮）、計算は無償のみ・許可リスト・ネットワーク無し・2 CPU / 2 GiB。
- **計算を動かせる人の決め方。** Ocean Node には公式の方法が 3 つあります。アドレスの一覧（いまはこれ）、台帳上のアクセスリスト（複数のノードで共有できる）、資格情報を確かめるポリシーサーバ（Pontus-X の方式）。
- **秘密情報。** ノードの鍵は 1Password に置き、`op` から ssh の標準入力で仮想マシンの `.env` に書き込みます。

## ページ

- **[API（OpenAPI）](./api)** — Clio-X がノードと subgraph に送る呼び出しの一覧。
- **[Sepolia で Clio-X を自分で建てる](./self-hosting)** — 仮想マシン、秘密情報、ノードと subgraph、Cloudflare Tunnel、ポータルの手順。
- **[CLI で登録と無償の計算](./trial-run)** — 公式 CLI で見本を登録し、無償の計算ジョブを動かす手順。
- **[分かっている問題](./known-problems)** — 原因と回避策。

## 初回の実測（2026-09-26）

|                 |                                                                               |
| --------------- | ----------------------------------------------------------------------------- |
| データセット    | `did:op:04f79245ba012ab323600b60bb537c865560ca18867025a3d31b38f4560b9787`     |
| アルゴリズム    | `did:op:fdefde90da7983f083b54c0939b719cb69dac21bff6e5cc4a343d2f6a033daa4`     |
| ジョブ          | 無償の環境、1 CPU / 1 GiB、終了コード 0                                       |
| 結果            | 1,338 語。people 10、laws 9、states 8。同じイメージで手元で動かした結果と一致 |
| subgraph の同期 | 公開 RPC で毎分約 750 ブロック                                                |

## ソース

ファイルはフォークのブランチ [`deploy/hosting`](https://github.com/nakamura196/ClioX-mvg-portal/tree/deploy/hosting) にあります。
このサイトは、同じ文章からブランチ `docs/site` で作っています。
