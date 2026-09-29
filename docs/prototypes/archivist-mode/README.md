# Prototype (d): archivist view

Branch `proto/archivist-mode`. One line: a switch in the header ("Archivist
view") that shows the same site in archival terms — custodian, persistent
identifier, description history, "analyse in place", "request the analysis",
"sign in" — and hides wallet addresses, token names and network names.

- Words: the `common` i18n strings are swapped for the overrides in
  `content/archivistMode.json` / `.ja.json` (about 60 strings per language).
  Only screen words are overridden; data values from the chain (titles,
  author, DID value) are shown as they are.
- Details: elements marked `data-jargon` are hidden by one CSS rule keyed on
  `<html data-view="archivist">`. Marked: network name, owner / revenue
  addresses, "published by 0x…", datatoken link and symbol, veOCEAN, network
  and automation menus, Gaia-X service credential button.
- Compute rooms priced at 0 show "Free" instead of "0 EURAU / minute".
- A banner says what is hidden and offers "Show the full technical view".
  Costs are not hidden: the network-fee note stays, reworded.
- The choice is kept in this browser only. `?view=archivist` / `?view=full`
  set it from a link (for demos). Code: `src/@context/ArchivistMode.tsx`,
  `src/components/ArchivistMode/`.

Known limits: strings hard-coded in English in components (teaser
"sales"/"views", the Gaia-X modal) are not covered. The home page copy says
"Web3" in five places; that is Clio-X's own message, left unchanged — a
question for Vicki. On phones the switch has no text label (the header
already overflows there).

Screenshots: `record-ja.png` and `compute-ja.png` (before / after),
`record-en.png`, `phone-ja.png`.
