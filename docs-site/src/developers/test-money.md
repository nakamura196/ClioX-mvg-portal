# Test money

**Everything paid on the Sepolia trial uses test tokens. They have no real value and cannot be changed into real money.**
Sepolia is Ethereum's public test network. Its coins are given away free by "faucets" (web pages that send a small amount to your wallet).

To try a paid asset you need two things in your wallet:

1. **Sepolia ETH**, to pay the network fee ("gas") for every transaction, even a free download.
2. **The token the asset is priced in**: JPYC, USDC or WETH (see [How the price currency is chosen](/developers/price-tokens)).

## Where to get each one

| What        | Where                                                                                            | Notes                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Sepolia ETH | [Google Cloud Sepolia faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia) | Needs a Google sign-in.                                                                        |
| JPYC        | [JPYC faucet](https://faucet.jpyc.co.jp/)                                                        | Run by JPYC. 1 JPYC is meant to stand for 1 yen; on Sepolia it is only a test token.           |
| USDC        | [Circle faucet](https://faucet.circle.com/)                                                      | Choose Ethereum Sepolia. 20 USDC per request, once every 2 hours (limit noted on 24 Nov 2026). |
| WETH        | Wrap your Sepolia ETH                                                                            | Send ETH to the WETH contract's `deposit()`; you get the same amount of WETH back.             |

The token addresses (add them to your wallet so the balance shows):

| Token | Address                                      | Decimals |
| ----- | -------------------------------------------- | -------- |
| JPYC  | `0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29` | 18       |
| USDC  | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | 6        |
| WETH  | `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14` | 18       |

Check the address before adding a token: faucets and wallets sometimes list other test contracts with the same name.

## For scripts

- **WETH:** `deploy/trial/paid.mjs buy <did>` wraps ETH into WETH itself before buying (via `paid.zsh`, which reads the keys from 1Password).
- **JPYC:** the JPYC faucet page calls `sendToken(to, amount)` on JPYC's faucet contract. LDAS Pay calls the same function from a script (`ldas-pay/scripts/setup/claim-jpyc-sepolia.zsh <amount>`) to top up its own wallet.

## Why not OCEAN

Ocean's own token on Sepolia (`0x1B083D8584dd3e6Ff37d04a6e7e82b5F622f3985`) can only be minted by its owner, and there is no faucet for it.
A dry run from the trial wallet failed with _Ownable: caller is not the owner_.
So the trial prices in tokens anyone can get ([Known problems](/developers/known-problems#there-is-no-test-ocean-on-sepolia)).
