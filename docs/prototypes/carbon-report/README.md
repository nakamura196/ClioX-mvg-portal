# Prototype (f): exportable carbon and cost report

Branch `proto/carbon-report`. One line: before running an analysis, estimate its
energy, CO2 and cost for one or more places, and keep the estimate as a report
(print/PDF, CSV, JSON) with a SHA-256 so the kept file can be checked later.

- `/carbon-report`, `/ja/carbon-report`. No wallet, no job, no payment.
- Example: the same OCR workload (40 jobs × 30 min) in Stockholm, Tokyo, Calgary
  and Kashiwa (mdx). Stockholm 14.0 gCO2e vs Calgary 2.84 kgCO2e (~203×).
  mdx shows "cannot be established" (power not measured) and is not ranked.
- "Alternatives" (default) compares lowest/highest; turning it off adds lines up.
  Lines that cannot be estimated are left out of totals, never counted as zero.
- Every value keeps its label (measured / provider-reported / portal-estimated /
  cannot be established) and its source; assumptions and limits are printed.
- Uses the existing `computeFootprint` registry (commit fe33bc82). Added English
  versions of the source notes so the English report has no Japanese notes.
- Text in `content/carbonReport(.ja).json`; model and exports in
  `src/@utils/carbonReport.ts` (tests: `carbonReport.test.ts`).

Files: `report-en-compare.png`, `report-en-combined.png`, `print-ja-page1.png`,
`page-en-full.png`, `sample-report-en.pdf`, `sample-ja.csv`.

Open points: the figures assume the same run time on every machine (different
GPUs); OCR throughput itself is not measured. Registry values are from 2026-08.
