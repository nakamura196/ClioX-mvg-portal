# Prototype: does showing per-transaction energy and water change the choice?

Branch `proto/sustainability-exp` (from `deploy/hosting` 80ae898b). For the joint paper (Lemieux / Laatikainen / Nakamura, Computational Archival Science, deadline 2026-11-01). Three parts: the accounting method, a two-condition experiment page, and a transaction receipt.

## URLs

- `/experiment`, `/ja/experiment`: the experiment. Condition is random on first load, kept in `sessionStorage`, overridable with `?condition=control|treatment`. Optional `?pid=<code>`. The screens never name the condition.
  - control: cost per transaction, location, jurisdiction, Indigenous-data suitability, certifications.
  - treatment: the same, plus electricity, water and carbon per transaction with quality labels.
  - 6 trials, 4 providers each (order shuffled per trial and recorded). At the end the participant downloads results as JSON and CSV. No server, no network calls.
- `/experiment?view=design`: every trial with computed figures and the lowest flags; "Download design.json" for the MATLAB simulation. Not linked from the participant screens (it would show control participants the treatment figures).
- `/experiment?view=receipt`: one sample transaction receipt with its SHA-256 and a JSON download. The page says the hash shows the file was not altered, not that the provider's sensors are accurate. Signature: not yet implemented.

## Method (`src/@utils/transactionFootprint.ts`, 19 tests)

E = sum P_k dt_k s_k (IT energy); facility energy = E x PUE when the power figure is IT-only; water either sum Q_k dt_k r_k (flow, r defaults to s, labelled "water allocated by compute share (an accounting estimate, not measured consumption)") or IT energy x WUE; carbon = facility energy x grid factor (location-based). Vicki's worked example (90 s, 25%, 4 kW, 12 L/h) gives 0.025 kWh and 0.075 L exactly (test). Missing input gives "cannot be established" with a reason, never 0. Allocation basis: `dedicated`, `reserved-share`, `measured-per-job`. Method id `clio-x-transaction-allocation/0.1`. Allocated values are never labelled "measured". `buildTransactionReceipt` adds intervals, share, basis, method version, per-value quality, evidence references. The existing `computeFootprint` code and tests are unchanged.

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

All six trials clicked through in treatment; downloaded JSON and CSV have 6 rows with the fields above. The SHA-256 shown on the receipt page equals `sha256` of the downloaded file (`b072c348…ad13e7`). Trial 4 shows "cannot be established" with the reason for the missing water figure.

## Open points

- Water definition: withdrawal, consumption or recirculating flow, on-site or from electricity generation. The receipt records it; the demo values say "consumption, on-site". Recirculating flow gets a warning note.
- The draft's formula uses a flow (L/h), its figure uses an annual-average WUE (0.36 L/kWh). Both are supported; a WUE-based figure is an average, not this job's use.
- Carbon is not defined in the draft; here: facility energy x location-based grid factor.
- All provider figures are illustrative. Real values need agreement on sources.
- Participant view (`/experiment` without `?view=`) is shown without the portal's header, banners, footer and first-run tour, so participants see only the task. The researcher views (`?view=design`, `?view=receipt`) keep the normal layout. There is no language switch in the participant view; use `/ja/experiment` for Japanese.
- Condition names appear in the downloaded results (needed for analysis), not on screen.
- Response time is measured from display to confirm; first-selection time is also recorded.
- Receipt signing and a real evidence hash are not implemented.
