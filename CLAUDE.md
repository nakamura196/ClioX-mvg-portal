# Guidelines for this fork (nakamura196/ClioX-mvg-portal)

This fork runs Clio-X on Sepolia: portal on branch `deploy/hosting`
(https://cliox.ldas.jp), documentation site on branch `docs/site`
(https://cliox-docs.ldas.jp, sources in `docs-site/`).

## Questions become documentation

When someone asks "what is this?", "why does it do that?" or "should we turn it
off?" about Clio-X, the portal, Ocean or the trial, other people will ask the
same thing. So the answer does not stay in the conversation.

- Answer the question, then write what was found into the documentation site
  **in the same piece of work**, in English and Japanese
  (`docs-site/src/...` and `docs-site/src/ja/...`).
- Where it goes:
  - a defect, a workaround, or something that cost time →
    `developers/known-problems.md` (say where the cause is: Ocean, Clio-X, or our hosting)
  - how a feature or screen works, or why the trial differs from upstream →
    its own page under `developers/`, linked from the sidebar in
    `docs-site/.vitepress/config.mts`
  - a plain-language question an archivist would ask →
    `archivists/` (FAQ data in `docs-site/data/archivistQa*.json`, terms in
    `archivistGlossary*.json`)
  - a decision for the project (Vicki and the group) → `project/open-questions.md`
- Write from what was measured (code read, request made, screen checked) and
  say so. Mark guesses as guesses.
- Archivist pages use no jargon; developer pages give code paths, commits and
  measured values.
- Some pages are copied in at build time and are gitignored (see
  `.gitignore`: `developers/self-hosting.md`, `developers/trial-run.md`,
  `archivists/when-a-node-closes.md`, …). Edit their sources on
  `deploy/hosting` instead (`docs/`, `deploy/trial/README.md`).
- Run `npm run build` in `docs-site/` before committing.

## Branches

- Portal fixes go on `deploy/hosting`; documentation on `docs/site`.
  Mention the portal commit hash in the documentation.
- Never push to or open PRs against upstream `ciferresearch`.
