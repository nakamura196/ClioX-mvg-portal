# Prototypes

Code in this folder is not part of the Clio-X portal. Each folder is one
prototype built on the portal for research or for the trial on Sepolia.
The index page is `/experiment`; it says for each prototype what is real and
what is illustrative. Rules: `CLAUDE.md`, "Where our code goes".

| Folder               | Pages                                              | What it is                                                                                |
| -------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `two-condition/`     | `/experiment/two-condition`                        | Decision exercise with and without footprint labels; receipt, signing and verifying (EAS) |
| `footprint/`         | `/experiment/paper-fig`, `?demo=1` on asset pages  | Energy, water and carbon of a compute job; illustrative environments; comparison table    |
| `carbon-choice/`     | `/experiment/carbon-choice`                        | Choose where to run and record the choice on Sepolia; green-fee variants                  |
| `carbon-report/`     | `/experiment/carbon-report`                        | Estimate energy, carbon and cost before running an analysis                               |
| `sample-collection/` | `/experiment/sample-collection`                    | Try fixity or OCR on eight public-domain images, replayed from a stored run               |
| `archivist/`         | `/experiment/archivist-qa`, `/experiment/glossary` | Archivist view, term tooltips, glossary and Q&A                                           |
| `finding-aid/`       | `/experiment/finding-aid/<DID>`                    | One asset shown as an archival finding aid (ISAD(G) areas)                                |
| `tour/`              | (overlay)                                          | Guided first-run tour                                                                     |
| `chatbot-trial/`     | (in the chatbot)                                   | Sample knowledge and trial DIDs for the chatbot on Sepolia                                |
| `shell/`             | `/experiment`                                      | The index page, the prototype banner, and helpers shared by prototypes                    |

Each folder keeps its components at the top, pure logic and tests in `lib/`,
and its page in `Page.tsx` (re-exported from `src/pages/experiment/`).
