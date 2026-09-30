# API (OpenAPI)

The calls Clio-X makes against Ocean Node and the subgraph, as OpenAPI 3.1.

- **[Open the interactive reference](/api/)** (Scalar)
- [Download `cliox-sepolia.openapi.yaml`](/api/cliox-sepolia.openapi.yaml)

## Scope

Only the calls that the portal and `@oceanprotocol/cli` 2.1.0 actually make are described.
Each one was checked against the Ocean Node 4.2.0 route code running on the trial VM and against live requests.
The subgraph is described as one `POST` path with the portal's named queries.
Examples come from the first trial run on 2026-09-26.

Servers:

|          |                                                                              |
| -------- | ---------------------------------------------------------------------------- |
| Node     | `https://cliox-node.ldas.jp`                                                 |
| Subgraph | `https://cliox-subgraph.ldas.jp/subgraphs/name/oceanprotocol/ocean-subgraph` |

## Things worth knowing before you use it

- **Anyone can list a wallet's compute jobs.** `GET /api/services/compute` needs no signature.
- **File details are public.** `POST /api/services/fileInfo` on a published DID returns size, type, file name and SHA-256 of the sealed file to anyone, even for compute-only datasets. The URL itself is never returned.
- **Why did my asset not index?** `GET /api/aquarius/state/ddo` (not used by the portal) matches the DID by prefix and shows the indexer's error for it.
- `POST /api/aquarius/assets/names` is called by the portal but does not exist in 4.2.0 (404), so some asset names stay empty.
- A finished free job stays at status **71** (“Job settling”); the results are already downloadable.
- On the subgraph, `opc` is `null` and veOCEAN data is empty because the index starts after those contracts were deployed.
