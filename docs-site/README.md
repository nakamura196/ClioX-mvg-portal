# Clio-X Trial Notes (documentation site)

Japanese/English site for the Sepolia trial of Clio-X, published at
<https://cliox-docs.ldas.jp>. Three entrances: archivists, developers, and the
Clio-X project (Vicki Lemieux's group).

Built with VitePress 1.6.4. Lives on the branch `docs/site` of the fork; the
Vercel project `cliox-docs` builds only that branch (`ignoreCommand` in
`vercel.json`).

## Run locally

```zsh
cd docs-site
npm ci
npm run dev        # http://localhost:5173
npm run build      # → .vitepress/dist
```

Use Node 22.

## Where the text comes from

Each text is edited in one place.

| On the site                                     | Edit here                                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| Developers → Self-hosting                       | `docs/self-hosting.md`                                                               |
| Developers → CLI (English)                      | `deploy/trial/README.md`                                                             |
| Developers → API                                | `docs/api/cliox-sepolia.openapi.yaml`                                                |
| Archivists → When the publishing service closes | `docs/for-archivists/when-a-node-closes(.ja).md`                                     |
| Project → Prototypes → each detail page         | `docs/prototypes/<topic>/README.md` and its images                                   |
| Archivists → Glossary                           | `docs-site/data/archivistGlossary(.ja).json` (copied from `proto/glossary` 40217c35) |
| Archivists → Q&A                                | `docs-site/data/archivistQa(.ja).json` (copied from `proto/archivist-qa` 42078730)   |
| Project → Prototypes cards                      | `docs-site/data/prototypes.json`                                                     |
| everything else                                 | `docs-site/src/**`                                                                   |

`scripts/sync-sources.mjs` runs before `dev` and `build`. It copies the files
in the first five rows into `src/` (listed in `.gitignore`) and rewrites their
relative links: to the page on this site when there is one, otherwise to the
file on GitHub.

`docs/prototypes/<topic>/` was brought in from each `proto/<topic>` branch with
`git checkout proto/<topic> -- docs/prototypes/<topic>`. The video
`src/public/media/clio-x-first-look.mp4` is the build output of
`proto/demo-video` (`scripts/demo-video/build.zsh`).

## API reference page

`src/public/api/index.html` loads Scalar `@scalar/api-reference` 1.69.1 from
jsDelivr with an SRI hash. To update, change the version and the `integrity`
value together. The AI, MCP and developer-tool buttons and Scalar's telemetry
are switched off in `data-configuration`.

## Known `npm audit` findings

`npm audit` reports vite/esbuild issues (one high). They affect only the local
dev server, not the built static site, and VitePress 1.6.4 (the latest stable)
has no fixed release. Run `npm run dev` only on your own machine.
