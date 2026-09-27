# Prototype (h): sample collection to try a compute job

Branch `proto/sample-collection`. One line: eight public-domain page images
from the National Diet Library, on which a visitor with no wallet can run an
analysis from start to finish — choose pages, choose an analysis, run it, and
see that only result files come back while the images stay with the custodian.

- URL: `/sample-collection` (ja: `/ja/sample-collection`). Not linked from the
  menu.
- Collection: 歳旦発句牒 (芭蕉 編, 1682), NDL info:ndljp/pid/2534020, marked PDM.
  All 8 canvases of the IIIF manifest, 1600 px wide copies, in
  `public/sample-collection/saitan/`. Bibliographic values are copied verbatim
  from the manifest into `collection.json` (not translated). Page notes
  ("front cover", "text") are ours and are badged as such.
- Two analyses, each badged with how it runs:
  - **Fixity check — runs here, now.** SHA-256 and pixel size per file,
    computed in the browser; CSV download. Each checksum is compared with the
    checksums recorded by the OCR run ("same file as the OCR run read?").
    Verified equal to `shasum -a 256` of the files.
  - **Text recognition (NDL 古典籍 OCR-Lite) — replays a recorded run.** Run once
    on 2026-09-26 on the author's Mac, in the same container and under the
    same rules as an Ocean Node compute job (no network, 2 CPUs, 2 GB, uid
    1000, write access to `/data/outputs` only). Record in
    `public/sample-collection/saitan-ocr-run/` (`run.json` = container digest,
    command, input checksums; `logs.txt` verbatim; `outputs/` = txt / TEI /
    NDL XML / JSON per page). The log is shown unchanged; the chosen pages'
    lines are highlighted.
- Results view: files in `/data/outputs` vs "what did not come back" (the
  images). OCR viewer: pointing at a line highlights its box on the page.
- Honest parts kept on purpose: page 8 (back cover, no text) failed inside the
  OCR program (ZeroDivisionError on zero lines) — shown as "page 8 failed, and
  the job still finished". A "read this as a draft" note gives two real
  errors from this run (歳旦 → 歳且; the ruler read as "1.3.3").
- Section 5 lists what changes on the real network (catalogue, wallet, node,
  minutes) and what stays the same, and says the test-network trial is not
  open yet.

Known limits: the OCR cannot run in the browser (models ~79 MiB, ~70 s per 8
pages on 2 CPUs), so it is a replay, and the page says so. The phone header
overflows by 8 px on every page of the site (existing menu, not this page).

Next step if chosen: publish the same 8 images and the OCR algorithm as a
compute asset on Sepolia via the mdx-clio node, so the "real network" section
can link to it (needs Vicki's OK for a public trial).

Screenshots: `page-ja.png`, `fixity-en.png`, `ocr-result-ja.png`,
`ocr-failed-page-en.png`, `phone-ocr-ja.png`.
