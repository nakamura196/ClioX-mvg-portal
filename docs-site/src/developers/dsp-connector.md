# Clio-X and a Dataspace Protocol connector

**For users, ds.ldas.jp and cliox.ldas.jp are two entry points side by side. They choose one by purpose: compute on the data without getting a copy (cliox.ldas.jp), or a contract to view or download it (ds.ldas.jp).**
Whether Ocean or the Dataspace Protocol (DSP) runs underneath is behind the scenes.
This page explains how the two portals reach the same DSP providers, and why ds.ldas.jp is built alongside Clio-X.

![Three columns: users on the left, the two portals ds.ldas.jp and cliox.ldas.jp in the middle, DSP providers on the right. ds.ldas.jp talks DSP to the providers on every request; cliox.ldas.jp does not, and the Ocean node fetches files from the Clio-X data provider's data plane per job.](/dsp/dsp-connector-en.svg)

## Who does what

- **DSP providers** implement DSP.
  They publish a catalog with ODRL policies (machine-readable usage terms), negotiate a contract, and start a transfer that hands out a data address and a credential.
  A provider has two parts:
  a **control plane** (catalog, policy, contract) and a **data plane** (the place the data is fetched from).
  - news-a and yanesen are provider nodes built with `ldas-dsp`. Each has both planes in one.
  - The **Clio-X data provider** is one provider with its two planes apart.
    Its data plane is `cliox-files.ldas.jp` (live, guarded by Cloudflare Access).
    Its control plane `cliox-dsp.ldas.jp` is planned in `ldas-dsp` and not deployed yet.
    The data plane does not negotiate; it only serves files to holders of a valid credential.
- **The two portals** show catalogs and let people act. Neither is a connector.
  - **ds.ldas.jp** gathers the DSP providers' catalogs, makes contracts and takes payments (see below).
  - **cliox.ldas.jp** (the Clio-X portal, on Ocean) is where a publisher registers a dataset and a consumer buys it and starts a compute job.
- **The Ocean node** holds no dataset and does not speak DSP.
  It fetches a file by URL and headers, runs the algorithm, and returns results.
- **The Clio-X operator** makes the one contract for the node (below).

## Two ways a portal reaches a provider

The diagram draws them with different arrows.

- **ds.ldas.jp: DSP on every request** (indigo).
  Each contract a user makes on ds.ldas.jp is a DSP negotiation with the provider's control plane.
- **cliox.ldas.jp: no DSP per job** (orange).
  The Ocean node sits between the portal and the provider's data plane, and fetches the file for each job.
  DSP is used once: the Clio-X operator, acting for the node as the consumer side, makes a long-lived contract with the provider's control plane ("compute only, no redistribution").
  The resulting credential is put into the DDO (the asset's description, stored encrypted) when the dataset is registered.

Each compute job then runs like this:

1. The consumer buys the asset on cliox.ldas.jp and starts a job.
2. The node fetches the file from the data plane, using the URL and headers in the DDO (a Cloudflare Access service token).
3. The node runs the algorithm in an isolated container without network access.
4. The node returns only the results. The consumer never gets the file.

## Two direct lines between a person and a provider

Two arrows go straight from the left column to the providers. They are different things.

1. **The DSP data plane (consumer).**
   After a contract on ds.ldas.jp, the consumer gets a short-lived pass and fetches the data directly from the provider's data plane (news-a: 20 minutes).
   The data does not pass through the portal.
2. **Cloudflare Access email login (the provider's staff).**
   Only the provider's own staff log in to `cliox-files.ldas.jp` to check the files. Today that is only the operator.
   This is administration, not a path for consumers.
   The node's service token is also Cloudflare Access; it is drawn as the per-job file arrow.

## What ds.ldas.jp is

ds.ldas.jp is a portal and catalog for DSP providers in the humanities and archives.

- It lists the datasets of the providers it knows (news-a, yanesen, and shared nodes for institutions that cannot run their own).
- A user contracts on a dataset under its ODRL policy. The contract is a DSP negotiation with the provider.
- Payment is in yen through pay.ldas.jp, which is built to take bank transfer, card and JPYC through one interface. The user needs no wallet and pays no gas.
- After the contract, the user views or downloads the data directly from the provider's data plane.

The DSP code is the open package `ldas-dsp` (`src/dsp-core/`).
Each provider runs its own node, as in Catena-X; today all nodes are run by one person.

## Identity: LDAS ID (verifiable credentials from id.ldas.jp)

id.ldas.jp issues a verifiable credential (VC) after checking a person's email domain, GakuNin or ORCID.
A portal asks for it by OpenID for Verifiable Presentations (OID4VP 1.0).
The credential is an SD-JWT VC (`dc+sd-jwt`): the person shows only the items the portal asks for, and a key-binding JWT (`kb+jwt`) proves the holder is showing it.
The portal checks the issuer's signature and the status list (whether it was revoked).

What each portal uses it for, as checked on 26 November 2026:

|                         | ds.ldas.jp                                                                                                                                          | cliox.ldas.jp                                                                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-in                 | LDAS ID, for every user                                                                                                                             | Not needed to browse. Buying needs a wallet.                                                                                                        |
| What the VC is used for | Who the user is, and conditions such as an academic domain (`*.ac.jp`)                                                                              | A provider applying for the "verified" mark (`/experiment/apply-provider/`), and the chatbot when its sign-in is required (now not required)        |
| Request seen            | OID4VP with DCQL asking for `dc+sd-jwt` (code: `dataspace-mock` `src/components/LdasLoginModal.tsx`; verification: `ldas-dsp` `src/dsp-core/vc.ts`) | `GET /api/auth/ldas/start` redirects to `id.ldas.jp/authorize` with `response_type=vp_token` and a DCQL query for `dc+sd-jwt` (request made 26 Nov) |

So both portals take the same credential, but only ds.ldas.jp uses it as the login.
On cliox.ldas.jp the wallet is what lets a user buy.
The portal also answers on `/api/policy-server` (a verifier an Ocean node can call). We have not checked that our node is set to call it; the plan is to use the Pontus-X standard (Ocean policy-server with walt.id) instead.

## Three layers: mechanism, place, entry

The same three layers appear in each dataspace.

| Layer                          | Pontus-X                                              | Catena-X (automotive)                                                                                                                       | ours                                                                   |
| ------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Mechanism (software and rules) | Ocean Protocol, on a blockchain (Oasis)               | DSP, with the official implementation Tractus-X EDC; no blockchain                                                                          | DSP, implemented in `ldas-dsp`; no blockchain                          |
| Place (network and operators)  | Pontus-X, run by deltaDAO and others                  | Catena-X: the association sets the rules, operating companies (Cofinity-X and others) run shared parts, each company runs its own connector | ds.ldas.jp, with one node per provider (news-a, yanesen, shared nodes) |
| Entry (portals)                | Clio-X and others, for archives and cultural heritage | Applications per use case                                                                                                                   | ds.ldas.jp's own pages                                                 |

Pontus-X and Eclipse are not on the same layer: Ocean Protocol is the counterpart of Eclipse's DSP and EDC.
ds.ldas.jp is like Catena-X in mechanism and in one node per provider. The difference is who runs the nodes.
The Catena-X column is from the association's standards (CX-0018, operating model) and Cofinity-X's pages, checked by search on 25 November 2026; details are not checked.

## Why ds.ldas.jp alongside Clio-X

::: warning Candidate reasons, to be confirmed
The reasons below are candidates. They have not been agreed yet.
:::

1. **Interoperability with EU dataspaces.** ds.ldas.jp implements DSP, the protocol of Gaia-X, Catena-X and Eclipse EDC. Clio-X runs on Ocean, which does not speak DSP.
2. **No wallet, no gas.** Users pay in yen through pay.ldas.jp. On cliox.ldas.jp, buying needs a wallet.
3. **Viewing and download, not only compute.** Some data can be lent under a contract; Clio-X is for compute without a copy.
4. **It complements Clio-X.** A DSP provider's data plane can be the storage Clio-X computes on, as with the Clio-X data provider above.

## What is Ocean's, and what is ours

Ocean itself only fetches by URL and headers.
Putting a DSP contract in front of the data is our design, not an Ocean feature.
ds.ldas.jp and the `ldas-dsp` providers implement DSP.
We have not run the DSP conformance test (TCK), so we do not call them conformant.

## Status

- Deployed: ds.ldas.jp with the news-a and yanesen providers; the Clio-X data plane `cliox-files.ldas.jp` behind Cloudflare Access; the node fetching from it with the service token (a real compute job has downloaded and processed a file this way); LDAS ID sign-in on ds.ldas.jp and the verified-provider application on cliox.ldas.jp.
- Planned: the control plane of the Clio-X data provider (`cliox-dsp.ldas.jp`, built in `ldas-dsp`), and the one-time contract for the node.
