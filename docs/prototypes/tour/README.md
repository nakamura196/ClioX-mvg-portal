# Prototype (b): first-run guided tour

Branch `proto/tour`. One line: a 12-step, about 5-minute tour that walks a
first-time visitor through one whole task — finding one archival dataset
(the Federalist Papers) and seeing how an analysis reaches it without the records leaving —
with the page dimmed and clicks paused, so nothing can happen by accident.

- Opens by itself on the first visit; "Guide" (?) in the header reopens it,
  resuming where the viewer stopped. Progress is kept only in the browser.
- Steps: welcome → Catalogue → search box → dataset page (title and
  description, custodian, identifiers) → compute panel (records stay put,
  compute rooms, approved algorithms, the one step that needs a wallet) →
  Connect Wallet → finish (link to the InterPARES Trust AI terminology).
- Each step explains the screen in archival terms; three steps carry a green
  "is it safe?" note. ja/en. Phones get a bottom sheet.
- Text: `content/firstRunTour.json` / `.ja.json`. Code:
  `src/components/FirstRunTour/`. Highlight targets are `data-tour`
  attributes added to 7 existing components (no hashed class names).
- Sample dataset: `did:op:88084b2a…4a9c`, the Federalist Papers on the trial
  node (Sepolia). It must exist on the node the portal reads. The first
  version pointed at the InterPARES terminology `did:op:65e78d53…f43d`, which
  exists only on Pontus-X devnet, so on https://cliox.ldas.jp the dataset page
  was empty and every step from "dataset page" on showed the "not showing yet"
  card. If the sample is removed, the same card appears with Skip.

Known limits: the search step only points at the box — catalogue search
returns nothing until the in-house metadata server is rebuilt (the public
Pontus-X cache answers 405 to the query this fork sends). Uses CSS `:has()`
for three compute-form targets (all current browsers).

Screenshots: `welcome-ja.png`, `record-en.png`, `access-ja.png`,
`wallet-step-ja.png`, `phone-environment-ja.png`.
