# Prototype: does showing per-transaction energy and water change the choice?

Branch `proto/sustainability-exp` (from `deploy/hosting` 80ae898b). A research prototype on showing energy and water per transaction. Three parts: the accounting method, a two-condition experiment page, and a transaction receipt.

## URLs

- `/experiment`, `/ja/experiment`: the experiment. Condition is random on first load, kept in `sessionStorage`, overridable with `?condition=control|treatment`. Optional `?pid=<code>`. The screens never name the condition.
  - control: cost per transaction, location, jurisdiction, Indigenous-data suitability, certifications.
  - treatment: the same, plus electricity, water and carbon per transaction with quality labels.
  - 6 trials, 4 providers each (order shuffled per trial and recorded). At the end the participant downloads results as JSON and CSV. No server, no network calls.
- `/experiment?view=design`: every trial with computed figures and the lowest flags; "Download design.json" for the MATLAB simulation. Not linked from the participant screens (it would show control participants the treatment figures).
- `/experiment?view=receipt`: one sample transaction receipt (schema `clio-x-transaction-receipt/0.2`) with two hashes, an unsigned JSON download, a source-data download, a "Sign as provider" button and a "Verify a signed receipt" section. The page says the signature shows who issued the receipt and that it was not altered, not that the provider's sensors are accurate. See "Receipt hashes and signature" below.

## Method (`src/@utils/transactionFootprint.ts`, 19 tests)

E = sum P_k dt_k s_k (IT energy); facility energy = E x PUE when the power figure is IT-only; water either sum Q_k dt_k r_k (flow, r defaults to s, labelled "water allocated by compute share (an accounting estimate, not measured consumption)") or IT energy x WUE; carbon = facility energy x grid factor (location-based). The reference example (90 s, 25%, 4 kW, 12 L/h) gives 0.025 kWh and 0.075 L exactly (test). Missing input gives "cannot be established" with a reason, never 0. Allocation basis: `dedicated`, `reserved-share`, `measured-per-job`. Method id `clio-x-transaction-allocation/0.1`. Allocated values are never labelled "measured". `buildTransactionReceipt` adds intervals, share, basis, method version, per-value quality, evidence references. The existing `computeFootprint` code and tests are unchanged.

## Trial design (`content/experiment/trials.json`, edit without code)

"Correct" = lowest facility energy per transaction (ties all correct). Water-lowest and carbon-lowest are computed the same way and recorded; whether energy-lowest and water-lowest agree is recorded per trial (null when an option has no water figure). Tests (`src/@utils/experiment.test.ts`) enforce: the energy-lowest option is the cheapest in at most 1 trial, it sits in at least 3 different locations, and the set contains agree, disagree and unknown-water trials.

| trial                                   | cheapest | energy-lowest           | water-lowest                             | carbon-lowest |
| --------------------------------------- | -------- | ----------------------- | ---------------------------------------- | ------------- |
| t1 OCR, shared GPU                      | Calgary  | Tokyo                   | Stockholm (disagree)                     | Stockholm     |
| t2 train, dedicated                     | Tokyo    | Oregon                  | Oregon                                   | Stockholm     |
| t3 transcribe                           | Calgary  | Calgary                 | Calgary                                  | Stockholm     |
| t4 embeddings                           | Oregon   | Montreal                | Stockholm (Montreal has no water figure) | Stockholm     |
| t5 workflow, 2 intervals, water as flow | Calgary  | Tokyo                   | Tokyo                                    | Montreal      |
| t6 fine-tune, dedicated                 | Calgary  | Oregon (most expensive) | Oregon                                   | Stockholm     |

All values are illustrative (shown on screen as "Demo data only"). Grid factors come from the existing registry; PUE, WUE, power and cost are invented.

## Files

`src/@utils/transactionFootprint.ts`, `src/@utils/experiment.ts` (+ tests), `src/components/Experiment/`, `src/pages/experiment.tsx`, `content/experiment.json` (+ `.ja.json`), `content/experiment/trials.json`. Samples here: `sample-design.json`, `sample-receipt.json`, `sample-results.csv`, and screenshots `en-*.png`, `ja-treatment-trial1.png`.

## Checked (2026-10-09, dev server, Playwright)

All six trials clicked through in treatment; downloaded JSON and CSV have 6 rows with the fields above. (Superseded by the canonical-JSON hashes below.) Trial 4 shows "cannot be established" with the reason for the missing water figure.

## Open points

- Water definition: withdrawal, consumption or recirculating flow, on-site or from electricity generation. The receipt records it; the demo values say "consumption, on-site". Recirculating flow gets a warning note.
- Water can be given as a flow (L/h) or as an annual-average WUE (L/kWh). Both are supported; a WUE-based figure is an average, not this job's use.
- Carbon: facility energy x location-based grid factor.
- All provider figures are illustrative. Real values need agreement on sources.
- Participant view (`/experiment` without `?view=`) is shown without the portal's header, banners, footer and first-run tour, so participants see only the task. The researcher views (`?view=design`, `?view=receipt`) keep the normal layout. There is no language switch in the participant view; use `/ja/experiment` for Japanese.
- Condition names appear in the downloaded results (needed for analysis), not on screen.
- Response time is measured from display to confirm; first-selection time is also recorded.
- Receipt signing and the source-data hash are implemented (below). Still open: schema registration on Sepolia.

## Receipt hashes and signature (2026-10-09)

Code: `src/@utils/canonicalJson.ts`, `src/@utils/receiptAttestation.ts` (+ tests), `src/components/Experiment/Sign.tsx`, `Verify.tsx`. No new dependency.

- Canonicalization: RFC 8785 (JCS). Keys sorted by UTF-16 code unit, no whitespace, numbers as ECMAScript prints them, NaN/Infinity rejected, undefined keys dropped.
- `source.sha256` = SHA-256 of the canonical JSON of the source data (`sample-source.json`: transaction id, provider, location, times, and the full calculation input: intervals, power, shares, PUE, water flow or WUE, grid factor). Anyone with that file recomputes it. The worked example (90 s, 25%, 4 kW, 12 L/h) is pinned in a test to `4eeceaab...d598b`, and the value was also checked with an independent Python implementation.
- Receipt hash = SHA-256 of the canonical JSON of the receipt, so re-formatting the file does not change it. The receipt itself no longer has a signature field. The signature is in a separate file, the signed receipt (`clio-x-signed-receipt/0.1` = receipt + EAS off-chain attestation package, the same shape eas-sdk produces).
- Signature: EAS off-chain attestation (EIP-712, no gas, nothing sent). Sepolia EAS `0xC2679fBD37d54388Ce493F1DB75320D236e1815e`, chainId 11155111, contract `VERSION()` = "0.26" (read from Sepolia on 2026-10-09). Domain name "EAS Attestation", off-chain version 2 (with salt). Implemented with ethers v5 only; verification needs no wallet.
- Schema: `bytes32 receiptSha256,bytes32 sourceSha256,string method`, revocable, no resolver. UID `0xcc83b871...2e21d` (keccak256 of schema, zero resolver, revocable). Two hashes and a method name, not the receipt body: the numbers stay in the receipt (not published), and the signature still binds the source data and the accounting method version.
- attester = the provider's connected wallet. recipient = the requester's wallet (typed in, checksum checked).
- Cross-check: a fixed attestation made with `@ethereum-attestation-service/eas-sdk` 2.10.0 on ethers v6 (public Hardhat test mnemonic, fixed time and salt) is stored in `src/@utils/__fixtures__/`. The ethers-v5 code produces the identical signature, UID, data encoding and easscan compact package (test "cross-check").
- Verify section: recomputes the receipt hash, compares with the signed value, recovers the signer, shows attester, recipient, time, and checks method, schema, UID, network. An optional source-data file is hashed and compared.
- easscan: the sdk's link format is `https://sepolia.easscan.org/offchain/url/#attestation=<deflate+base64 of the compact package>`. The page builds it in the browser (CompressionStream). The compact package matches the sdk's. I did not open the link on easscan in a browser.
- easscan check (2026-10-09, headless Chromium): the link built from `sample-signed-receipt.json` was opened on sepolia.easscan.org. easscan decoded the package and stopped at "Schema (0xcc83b871…2e21d) not found", which is expected until the schema is registered. Re-check after registration.
- `sample-signed-receipt.json` is signed with the public test key (marked in the file). Not a real provider.

Not done: the schema is not registered on Sepolia (a user step: SchemaRegistry `0x0a7E2Ff54e76B8E6659aedc9103FB21c038050D0`; until then easscan may not show the schema name). Signing from a real wallet in the browser was not tested (no wallet in the test browser); the signing function itself is tested with a wallet object. MetaMask needs to be on Sepolia (the page asks to switch). Whether to use revocable, and whether to also anchor the attestation on-chain, are open.
