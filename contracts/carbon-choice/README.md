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
