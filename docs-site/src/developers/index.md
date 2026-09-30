# For developers

This section describes a self-hosted Clio-X on the Sepolia test network, built in September 2026.
It runs without Pontus-X membership and on free tiers only.

<Architecture lang="en" />

| Part             | Software                                                  | Where                                          |
| ---------------- | --------------------------------------------------------- | ---------------------------------------------- |
| Portal           | Clio-X (`ciferresearch/ClioX-mvg-portal`, this fork)      | Vercel, Hobby tier                             |
| Ocean Node       | `oceanprotocol/ocean-node:4.2.0` + Typesense              | mdx VM, 6 vCPU / 8.8 GiB / 99 GB, Ubuntu 24.04 |
| Subgraph         | `graphprotocol/graph-node` v0.45.0 + IPFS + PostgreSQL 14 | same VM                                        |
| Public endpoints | Cloudflare Tunnel (`--protocol http2`)                    | only SSH is open inbound                       |

## Pages

- **[Self-hosting on Sepolia](./self-hosting)** — the full guide: what is official and what we added, who may run compute, VM, secrets, subgraph shortcut, tunnel, portal, carbon location.
- **[API (OpenAPI)](./api)** — the HTTP and GraphQL calls Clio-X makes against the node and the subgraph, checked against Ocean Node 4.2.0.
- **[CLI: publish and free compute](./trial-run)** — reproducible sample: publish a public-domain text and a word-count algorithm with `@oceanprotocol/cli` 2.1.0 and run a free Compute-to-Data job.
- **[Known problems](./known-problems)** — what cost us time, with causes and workarounds.

## Measured on the first run (2026-09-26)

|               |                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------- |
| Dataset       | `did:op:04f79245ba012ab323600b60bb537c865560ca18867025a3d31b38f4560b9787`                         |
| Algorithm     | `did:op:fdefde90da7983f083b54c0939b719cb69dac21bff6e5cc4a343d2f6a033daa4`                         |
| Job           | free environment, 1 CPU / 1 GiB, exit code 0                                                      |
| Result        | 1,338 words; people 10, laws 9, states 8 — identical to a local run in the same image             |
| Subgraph sync | ~750 blocks/min on a public RPC; starts at block 11,459,550 instead of the Ocean deployment block |

## Source

All files are on the branch [`deploy/hosting`](https://github.com/nakamura196/ClioX-mvg-portal/tree/deploy/hosting) of the fork
([`deploy/ocean-node/`](https://github.com/nakamura196/ClioX-mvg-portal/tree/deploy/hosting/deploy/ocean-node), [`deploy/trial/`](https://github.com/nakamura196/ClioX-mvg-portal/tree/deploy/hosting/deploy/trial), [`docs/`](https://github.com/nakamura196/ClioX-mvg-portal/tree/deploy/hosting/docs)).
This site is built from the same texts on the branch `docs/site`.
