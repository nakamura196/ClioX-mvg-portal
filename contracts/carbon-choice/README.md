# CarbonChoiceRecord

Non-transferable token (ERC-721 + ERC-5192) for prototype (i), `/carbon-choice`.
See `docs/prototypes/carbon-choice/README.md`.

```
forge install foundry-rs/forge-std --no-git   # once; lib/ is gitignored
forge test
zsh deploy.zsh                                 # Sepolia, trial wallet key from 1Password
```

Deployed: Sepolia `0x5919f54c6b36f3543eEe5f94133Ec8c58637F258` (2026-09-30).
The address is also the default in `src/@utils/carbonChoice.ts`
(override with `NEXT_PUBLIC_CARBON_CHOICE_ADDRESS`).

## GreenFeeDemo

Play-money fee rules for `/carbon-choice` section 3: type 3 feebate (surcharge
into a pool, discount out of it) and type 4 sponsor deposit (share of the fee,
capped per job). The provider always gets its list price. The contract is also
the PLAY token (faucet up to 1,000).

```
zsh deploy-green-fee.zsh        # DRY=1 to simulate; builds the price table from
                                # src/@utils/computeFootprint.ts, opens scheme #1
```

Deployed: Sepolia `0xa497eDb2e5B86a223737C66002cb24896AC9c932` (2026-10-01,
block 11821626). Default in `src/@utils/greenFee.ts`
(override with `NEXT_PUBLIC_GREEN_FEE_ADDRESS`).
