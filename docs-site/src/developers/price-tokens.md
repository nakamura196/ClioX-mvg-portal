# How the price currency is chosen

When you publish a priced asset, the form asks for a price and a currency (the "base token").
**On the Sepolia trial the menu offers JPYC, USDC and WETH, and JPYC is preselected.**
All three are test tokens with no real value; how to get them is on [Test money](/developers/test-money).

Live on https://cliox.ldas.jp since 25 Nov 2026 (commit `6f3b9528`, merged into `deploy/hosting` as `11f60898`).

## One list per network, in `chains.config.js`

The currencies come from two fields on each chain in `chains.config.js`:

- `baseTokens`: the tokens offered, in menu order (`address`, `symbol`, `name`, `decimals`)
- `defaultBaseTokenSymbol`: the one preselected

| Network                  | Offered          | Preselected |
| ------------------------ | ---------------- | ----------- |
| Sepolia (11155111)       | JPYC, USDC, WETH | JPYC        |
| Pontus-X devnet (32456)  | EUROe            | EUROe       |
| Pontus-X testnet (32457) | EUROe            | EUROe       |

The Sepolia tokens:

| Token | Address                                      | Decimals |
| ----- | -------------------------------------------- | -------- |
| JPYC  | `0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29` | 18       |
| USDC  | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | 6        |
| WETH  | `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14` | 18       |

JPYC and USDC are the same Sepolia contracts that LDAS Pay uses.
WETH stays because the trial's paid sample is priced in it (`deploy/trial/paid.mjs`).
OCEAN is not offered: on Sepolia only its owner can mint it (see [Known problems](/developers/known-problems#there-is-no-test-ocean-on-sepolia)).

**To change the currencies, edit this list only.** No other file needs to change.

## What the portal does with the list

- `getOpcsApprovedTokens` (`src/@utils/subgraph.ts`) asks `getConfiguredBaseTokens` (`src/@utils/tokenSymbol.ts`) first.
  If the chain lists `baseTokens`, those are the menu. If it lists none, the portal falls back to the subgraph's "approved tokens", as upstream Ocean does.
- `pickDefaultBaseToken` picks the preselected token: the chain's `defaultBaseTokenSymbol`, else `defaultTokenSymbol` in `app.config.js` (now `JPYC`, was `EURAU`), else the first in the list.
- With no wallet connected, the portal uses its default chain (`appConfig.chainIds[0]`, Sepolia).
  Upstream hard-coded Pontus-X testnet 32457 in three places; those now use the default chain.
- List views and asset cards look the symbol up in the same list, because our Ocean Node's DDO only gives the token's address.

## Why this replaced the upstream code

Upstream Clio-X had a temporary "mocked EUROe integration": `tokenAddressesEUROe` in `src/@utils/subgraph.ts` added EUROe to the subgraph's list on Pontus-X chains.
On Sepolia the subgraph's list was empty, so the publish form had no currency at all.
That emptiness also broke **free** publishing: switching to the Free tab stored an undefined token, and publishing then failed on `pricing.baseToken.address`.

The fix, in the same commit:

- the list is now always filled from `chains.config.js`, so the token is never missing on Sepolia;
- switching tabs keeps the current token instead of storing undefined;
- the (zero) order fee of a free asset falls back to the chain's OCEAN address if no token is set.

After the fix the publish form's debug view still showed JPYC after switching to Free (checked locally on 25 Nov 2026).

## Any ERC-20 works; "approved" only changes the fee

Ocean's fixed-rate exchange accepts any ERC-20 as the base token.
Ocean's community contract keeps a list of "approved" tokens, and the community fee is lower for those.
For WETH, which is not on that list, we measured 0.2% instead of 0.1% ([Known problems](/developers/known-problems#there-is-no-test-ocean-on-sepolia)).
JPYC is not on the list either, and a JPYC-priced asset also paid 0.2% (measured on 25 Nov 2026, see [Where the money goes](#where-the-money-goes)). USDC is not on the list, so we expect the same 0.2%; this is a guess, as we have not bought a USDC-priced asset.

The fee's label on the form changed from "Pontus-X Community Fee" to **Community Fee**, because on Sepolia the fee goes to Ocean Protocol's collector, not to Pontus-X.

## Where the money goes {#where-the-money-goes}

We published a test asset priced at 10 JPYC on https://cliox.ldas.jp
(`did:op:41f53cfdbe808655e358ce113d4897b7b7adfc7b257a3f966618217d3fe14499`,
publisher `0x6E43…32C3`) and bought it twice on 25 Nov 2026.
The figures below come from the JPYC `Transfer` events and the exchange's state on Sepolia, read at block 12214705.

The buyer pays **10.02 JPYC**: the price of 10 plus Ocean's community fee of 0.02 (0.2%).
The publish fee and the market fee were both 0.
`calcBaseInGivenOutDT` on the FixedRateExchange (`0x80E63f73cAc60c1662f27D2DFd2EA834acddBaa8`) gave the same 10.02 before the purchase.

Each purchase is one transaction with three JPYC transfers:

1. buyer → the asset's datatoken (`0x702Af0654507f59Cd30e066b089c72E202b70fda`): 10.02
2. datatoken → FixedRateExchange: 10.02
3. FixedRateExchange → publisher: **10**

So the publisher is paid at once, in the same transaction; nothing waits in the exchange for a withdrawal.
The 0.02 stays in the exchange as `oceanFeeAvailable` until someone collects it for Ocean's collector (`0x69B6E54Ad2b3c2801d11d8Ad56ea1d892555b776`); it had not been collected yet.

| Purchase                                                           | Transaction                                                                                                             | Block    |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | -------- |
| A second account, `0x05f1…C085` (through a MetaMask smart account) | [`0x61796ba5…26f9`](https://sepolia.etherscan.io/tx/0x61796ba5deedaae4f51e7bc87b20caa00f3ade4734597a990a44edbf408426f9) | 12214659 |
| The publisher buying its own asset                                 | [`0xe0dbaa5d…f1e9`](https://sepolia.etherscan.io/tx/0xe0dbaa5dce586e9f16a34c022f276fb4522ec73893d521af5ada5491e33ef1e9) | 12214693 |

| Account                      | Before (block 12214639) | After (block 12214705) | Change                               |
| ---------------------------- | ----------------------- | ---------------------- | ------------------------------------ |
| Buyer `0x05f1…C085`          | 2,396                   | 2,385.98               | −10.02                               |
| Publisher `0x6E43…32C3`      | 999,500                 | 999,509.98             | +10 (sale) −10.02 +10 (own purchase) |
| FixedRateExchange, fees held | 0                       | 0.04                   | +0.02 × 2                            |

In MetaMask the publisher sees this only as a higher JPYC balance (after JPYC is added as a custom token). The 10 JPYC is not listed in the publisher's Activity, because the transaction was sent by the buyer to the exchange, not to the publisher (this is how MetaMask behaves in general; we did not check it on screen). Etherscan's token transfers for the address do list it: [`0x6E43…32C3`](https://sepolia.etherscan.io/address/0x6E43f56B211d537C6B19Dc89414FE9506f5532C3#tokentxns).

Buying your own asset costs only the 0.02 fee and gas: you pay 10.02 and get 10 back in the same transaction.

For a few minutes after the purchases the asset page still said "No sales yet", while the ledger already showed both. We assume the subgraph had not indexed them yet (not checked).

## Not checked yet

- Publishing a free asset with a wallet signature (a JPYC-priced one was published on 25 Nov 2026; for the free one only the form was checked).
- Whether the second account could download the file after buying.
- Buying a USDC-priced asset.
