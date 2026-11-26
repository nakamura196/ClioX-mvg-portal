# 価格の通貨の決まり方

有料で資料を登録するとき、画面で価格と通貨（「基準トークン」）を選びます。
**Sepolia の試用では、JPYC・USDC・WETH の 3 つから選べ、最初は JPYC が選ばれています。**
3 つとも試験用のトークンで、本物のお金ではありません。手に入れ方は [試験用のお金](/ja/developers/test-money) にあります。

::: warning まだ本番には入っていません
このページはブランチ `feat/price-tokens`（コミット `6f3b9528`、2026-11-25）の内容です。
手元のポータルで確かめましたが、`deploy/hosting` にはまだ取り込んでいません。https://cliox.ldas.jp は、まだ前の動きのままです。
:::

## ネットワークごとの一覧は `chains.config.js` にある

通貨は、`chains.config.js` の各チェーンにある 2 つの項目だけで決まります。

- `baseTokens`: 選べるトークン。メニューに出る順に並べる（`address`・`symbol`・`name`・`decimals`）
- `defaultBaseTokenSymbol`: 最初に選ばれているトークン

| ネットワーク              | 選べる通貨       | 最初の選択 |
| ------------------------- | ---------------- | ---------- |
| Sepolia（11155111）       | JPYC・USDC・WETH | JPYC       |
| Pontus-X devnet（32456）  | EUROe            | EUROe      |
| Pontus-X testnet（32457） | EUROe            | EUROe      |

Sepolia のトークン:

| トークン | アドレス                                     | 小数の桁 |
| -------- | -------------------------------------------- | -------- |
| JPYC     | `0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29` | 18       |
| USDC     | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | 6        |
| WETH     | `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14` | 18       |

JPYC と USDC は、LDAS Pay が使っているのと同じ Sepolia のコントラクトです。
WETH を残したのは、試用の有料の見本がこれで値付けされているからです（`deploy/trial/paid.mjs`）。
OCEAN は出していません。Sepolia では持ち主しか発行できないためです（[分かっている問題](/ja/developers/known-problems) を参照）。

**通貨を変えたいときは、この一覧だけを直します。** ほかのファイルは直さなくて済みます。

## ポータルは一覧をこう使う

- `getOpcsApprovedTokens`（`src/@utils/subgraph.ts`）は、まず `getConfiguredBaseTokens`（`src/@utils/tokenSymbol.ts`）に聞きます。
  チェーンに `baseTokens` があれば、それがメニューになります。無ければ、元の Ocean と同じく、サブグラフ（チェーンの記録を検索用にまとめた索引）の「承認済みトークン」を使います。
- 最初に選ぶトークンは `pickDefaultBaseToken` が決めます。チェーンの `defaultBaseTokenSymbol`、無ければ `app.config.js` の `defaultTokenSymbol`（今は `JPYC`、前は `EURAU`）、それも無ければ一覧の先頭です。
- ウォレットをつないでいないときは、ポータルの既定のチェーン（`appConfig.chainIds[0]`、Sepolia）を使います。
  元のコードは 3 か所で Pontus-X testnet（32457）を決め打ちしていました。そこを既定のチェーンに替えました。
- 一覧やカードの通貨の記号も、同じ一覧から引きます。こちらの Ocean Node の資料の記述（DDO）には、トークンのアドレスしか入っていないためです。

## 元のコードを置き換えた理由

元の Clio-X には、仮の「EUROe の組み込み」がありました。`src/@utils/subgraph.ts` の `tokenAddressesEUROe` が、Pontus-X のチェーンでだけ、サブグラフの一覧に EUROe を足していました。
Sepolia ではサブグラフの一覧が空なので、登録画面に選べる通貨が 1 つもありませんでした。
この空の一覧のせいで、**無料**の登録も失敗していました。「無料」のタブに切り替えると通貨が空のまま保存され、登録の途中で `pricing.baseToken.address` が読めずに止まっていました。

同じコミットで、次のように直しました。

- 一覧はいつも `chains.config.js` から埋まるので、Sepolia で通貨が空になりません
- タブを切り替えても、空の値で上書きせず、今の通貨を残します
- 無料の資料の手数料（0 円）は、通貨が無いときチェーンの OCEAN のアドレスを使います

直した後、「無料」に切り替えても登録画面のデバッグ表示に JPYC が入っていることを、手元で確かめました（2026-11-25）。

## どの ERC-20 でも使える。「承認」は手数料だけを変える

Ocean の固定価格の取引所は、どの ERC-20（イーサリアムの標準的なトークンの形式）でも基準トークンにできます。
Ocean のコミュニティの契約には「承認済み」のトークンの一覧があり、それに載っていると手数料が安くなります。
一覧に載っていない WETH では、手数料が 0.1% ではなく 0.2% になることを実測しました（[分かっている問題](/ja/developers/known-problems)）。
JPYC と USDC も一覧に載っていないので、同じく 0.2% になると見込んでいます。これは推測です。JPYC や USDC で値付けした資料は、まだ買って試していません。

登録画面の手数料の表示は「Pontus-X Community Fee」から **Community Fee** に替えました。Sepolia では、手数料は Pontus-X ではなく Ocean Protocol の受け取り口に入るためです。

## まだ確かめていないこと

- ウォレットで署名して、実際に登録すること（JPYC の有料・無料とも。確かめたのは画面だけです）
- JPYC や USDC で値付けした資料を買うこと、そのときの実際の手数料
