# Prototype (a): archival-terms glossary

Branch `proto/glossary`. One line: technical words on Clio-X screens get a dotted
underline or a "?" that explains them in archival terms (ja/en), with a full
page at `/glossary` that links to the InterPARES Trust AI definitions where they exist.

- `/glossary`, `/ja/glossary` — 13 terms in 4 groups. Each: plain meaning,
  archival analogy, where the analogy stops, whether it is safe to click.
- Asset page: Owner, DID, Asset State, Docker Image, and the datatoken line.
- Header: "?" next to Connect Wallet (only when not connected).
- Text lives in `content/archivistGlossary.json` / `.ja.json`.

Screenshots: `glossary-ja-top.png`, `wallet-hint-ja.png`, `asset-owner-ja.png`,
`asset-datatoken-ja.png`, `glossary-en-datatoken.png`.
