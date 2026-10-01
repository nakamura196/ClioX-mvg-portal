# Prototype (i): choose where to run, and keep a record

Branch `proto/carbon-choice`. In one line: compare the estimated emissions of every place an analysis could run, choose one, and record that choice as a token that cannot be transferred or sold.

Asked for at the meeting of 30 September 2026 ("return emissions to users as tokens"). This is steps (a) and (b) of open question 13; it deliberately stops short of a sellable credit.

- `/carbon-choice`, `/ja/carbon-choice`. No payment, no compute job.
- (a) The same work (default: 40 jobs × 30 min) is estimated at every registered location and ranked. Example: Stockholm 14.0 gCO2e … Calgary 2.84 kgCO2e. mdx is listed as "cannot be compared" (power not measured), never counted as zero.
- The page states the difference from the highest option, and says in the same place that it is a difference between estimates, not a reduction against a baseline.
- (b) The record (JSON: every option, figures, quality labels, sources, method, assumptions) is downloaded by the user. Its SHA-256 is written on Sepolia by the user's own wallet as a token of `CarbonChoiceRecord` (ERC-721 + ERC-5192 "locked"). Transfers and approvals revert with `Soulbound()`.
- Section 4 lists the tokens of the connected wallet, or of `?holder=0x…` (shareable link). "Check a record file" hashes a local file and says which token it matches.
- Contract: [`0x5919f54c6b36f3543eEe5f94133Ec8c58637F258`](https://sepolia.etherscan.io/address/0x5919f54c6b36f3543eEe5f94133Ec8c58637F258) (Sepolia, deployed 2026-09-30 by the trial wallet, tx `0x547d3a09…`). Source, 6 tests and deploy script in `contracts/carbon-choice/`.
- Code: `src/@utils/carbonChoice.ts` (7 tests), `src/components/CarbonChoice/`, text in `content/carbonChoice(.ja).json`.

Checked on 2026-09-30: token #1 was recorded with the trial wallet from `sample-record-token-1.json` (tx `0xdb24dc9c…`). The page listed it; the file matched; the same file with one digit changed did not. A `transferFrom` call reverted with `Soulbound()`. On 2026-10-01 the browser-wallet path was run end to end: the trial wallet was injected in place of MetaMask and signed from the page's "Record this choice" button. It became token #2 (Montreal, tx `0x2535a149…`, block 11821470). It was listed; the exported file matched; the file with the job count changed did not. Reading the chain directly, the stored fingerprint equals the file's SHA-256 and `locked(2)` is true. Signing with a real MetaMask by a person is still untested.

Files: `page-en-options.jpg`, `page-en-record.jpg`, `sample-record-token-1.json`.

Open points:

- The contract checks nothing about the figures; anyone can record any numbers about themselves. That is the intended meaning ("an attributable claim"), but it must be said wherever the token is shown.
- The quality label is copied from the registry. Stockholm shows "measured" because its power profile was measured on an earlier run, not on this job.
- The record is a planning choice, not linked to a job that actually ran. Linking it to the compute job ID is the obvious next step.

## Added 2026-10-01: how the fee is set (types 3 and 4)

Plan: "[Giving something back for greener choices](https://cliox-docs.ldas.jp/project/green-choice)". Section "3. How the fee is set (prototype)" runs two ways of making low-emission locations cheaper, with play money (PLAY) on Sepolia.

- **Type 3 (surcharge and discount, a feebate)**: high-emission locations pay a surcharge into the scheme's pool; low-emission locations get a discount paid from it. No outside money. When the pool is short, the discount is cut to what it holds, and the page says so.
- **Type 4 (sponsor deposit)**: anyone can deposit into a scheme. Choosing a low-emission location pays part of the fee from the deposit (share and per-job cap). The scheme owner can withdraw unspent deposit; the type 3 pool cannot be withdrawn.
- In every payment the provider receives its full list price. Only the payer's share changes.
- Bands come from estimated emissions per hour. Defaults: "low" up to 5 g (Stockholm 0.7 g, Montreal 2.5 g), "high" from 20 g (Tokyo 30.9 g). Oregon (12.0 g) is "middle" and pays the list price. Calgary has no price, so it cannot be paid.
- Default scheme #1 (run by the trial wallet): surcharge 20 %, discount 20 %, subsidy 50 %, cap 5 PLAY. At deployment it deposited 200 PLAY and paid one Tokyo job, so the pool starts at 4.67 PLAY (ledger #1).
- Changing the settings updates every option's amounts at once (an estimate). When they differ from the scheme on Sepolia the page says so, and "Create my own scheme with these settings" makes a scheme the visitor runs.
- Ledger: per scheme, every payment (list, surcharge, discount, subsidy, paid, transaction link) and every deposit. A payment also stores the fingerprint of the record in step 4.
- The price and emission table is generated from the portal's registry (`src/@utils/computeFootprint.ts`) by `script/green-fee-locations.ts`, so page and contract use the same numbers. Provider addresses are made-up addresses derived from the key; nobody holds their keys.
- Contract: `GreenFeeDemo` [`0xa497eDb2e5B86a223737C66002cb24896AC9c932`](https://sepolia.etherscan.io/address/0xa497eDb2e5B86a223737C66002cb24896AC9c932) (Sepolia, 2026-10-01, block 11821626, tx `0xc916b30f…`). It is also the PLAY token (ERC-20, 6 decimals, faucet up to 1,000). Source and 11 tests in `contracts/carbon-choice/`; deploy with `zsh deploy-green-fee.zsh`.
- Code: `src/@utils/greenFee.ts` (same arithmetic as the contract's `quote`; 3 tests against values read from the chain), `src/components/CarbonChoice/GreenFee.tsx`.

Checked 2026-10-01 (trial wallet injected into the page in place of MetaMask, driven through the page's buttons):

1. Faucet: 1,000 PLAY received.
2. Paid for Stockholm under scheme #1: list 11.16, discount 2.23, subsidy 4.46, paid 4.46 (ledger #2, tx `0x7f49d658…`).
3. Set the subsidy to 80 % and the cap to 6: the page said the settings differ from Sepolia. Created own scheme #2 and deposited 50 PLAY.
4. Paid for Stockholm under #2: pool empty so no discount, subsidy 6.00, paid 5.16 (ledger #3, tx `0xeb3a56a9…`). Deposit left 44.00.
5. Scheme #1's pool then held 2.44, so Montreal's discount became 2.44 instead of the rule's 3.57, and the page says so.

Open points:

- Who actually funds this (which type, which money, share and cap) is for Vicki and the group to decide.
- Bands rest on estimates, not measurement. A discount or subsidy is not proof of reduced emissions.
- Payments are not linked to a real compute job yet (same next step as the record).
