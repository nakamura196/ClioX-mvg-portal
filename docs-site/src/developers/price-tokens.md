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
JPYC and USDC are not on the list either, so we expect the same 0.2%. This is a guess; we have not bought a JPYC- or USDC-priced asset yet.

The fee's label on the form changed from "Pontus-X Community Fee" to **Community Fee**, because on Sepolia the fee goes to Ocean Protocol's collector, not to Pontus-X.

## Not checked yet

- Publishing with a wallet signature, priced in JPYC and free (only the form was checked).
- Buying a JPYC- or USDC-priced asset, and the actual community fee.
