# Prototype (e): provenance as a finding aid

Branch `proto/provenance`. One line: each dataset gets a second page,
`/asset/<did>/finding-aid`, that lays its record out in the ISAD(G) areas
(3.1–3.7) and marks every value as "recorded on the chain", "stated by the
publisher" or "not recorded".

- Entry: a link "View as a finding aid (ISAD(G))" under the metadata history
  on every dataset page.
- Archival history (3.2.3) is built from chain events (creation of the register
  entry, custody transfers, description changes, status changes), each linked to
  the transaction in the block explorer. Granted requests are listed as a
  record of use.
- When the publisher's stated "last updated" date is more than an hour older
  than the last change on the chain, a notice says so. The demo dataset
  (InterPARES Indexed Archival Dataset) shows this: stated 2025-10-17, chain
  2025-10-20 (four edits). This is the point to show Vicki — reliability vs.
  what the record can prove.
- A tally at the top ("22 entries: 8 chain, 10 publisher, 4 not recorded")
  and "not recorded" rows make the gaps between Ocean's schema and ISAD(G)
  visible (no language, no extent, no related units).
- All dates are absolute UTC (no "11 months ago"). Print button; print hides
  the site header and footer.
- Text: `content/findingAid.json` / `.ja.json`. Data values (title, author,
  licence, tags, description) are shown as they are, not translated.
  Code: `src/components/FindingAid/`, `src/pages/asset/[did]/finding-aid.tsx`.

Known limits: the Japanese ISAD(G) element names are Claude's rendering and
should be checked against the published Japanese translation. Extent (3.1.5)
cannot be filled: file lists are encrypted. The site's "external content not
allowed" notice also appears in print. Record of use comes from the subgraph
(2 for the demo dataset), which differs from the index server's own count (4);
only the subgraph figure is shown, because each row links to a transaction.

Checked: ja/en desktop, ja phone (390 px), print media, and three other
records (an algorithm, a paid download dataset, a dataset with no author).
Site has no dark theme.

Screenshots: `finding-aid-top-ja.png`, `custodial-history-ja.png`,
`access-en.png`, `phone-ja.png`, `entry-link-ja.png`.
