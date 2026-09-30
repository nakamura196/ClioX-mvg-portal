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

Checked on 2026-09-30: token #1 was recorded with the trial wallet from `sample-record-token-1.json` (tx `0xdb24dc9c…`). The page listed it; the file matched; the same file with one digit changed did not. A `transferFrom` call reverted with `Soulbound()`. Recording from a browser wallet was not tried (needs a person to sign).

Files: `page-en-options.jpg`, `page-en-record.jpg`, `sample-record-token-1.json`.

Open points:

- The contract checks nothing about the figures; anyone can record any numbers about themselves. That is the intended meaning ("an attributable claim"), but it must be said wherever the token is shown.
- The quality label is copied from the registry. Stockholm shows "measured" because its power profile was measured on an earlier run, not on this job.
- The record is a planning choice, not linked to a job that actually ran. Linking it to the compute job ID is the obvious next step.
