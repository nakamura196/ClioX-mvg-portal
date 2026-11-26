# Clio-X and a Dataspace Protocol connector

**Clio-X (Ocean compute-to-data) does not speak the Dataspace Protocol (DSP). A DSP contract is made once, and the credential from it is put into the dataset's description.**
After that, each compute job uses only Ocean: the node fetches the file, runs the algorithm, and returns results.
This page draws the relation generically, for a provider whose data must not be public.

![Two phases: a one-time DSP contract between the DSP providers and the Clio-X operator, then each compute job where the Ocean node fetches the file from storage and returns only results](/dsp/dsp-connector-en.svg)

## Who does what

- **DSP providers** speak DSP.
  They publish a catalog with ODRL policies (machine-readable usage terms), negotiate a contract, and start a transfer that hands out a data address and a credential.
  Examples: news-a and yanesen (provider nodes built with `ldas-dsp`), and Eclipse EDC.
  A provider for the Clio-X data is planned in `ldas-dsp`.
- **Data storage** does not speak DSP.
  It only stores and serves files.
  Our example is `cliox-files.ldas.jp`, guarded by Cloudflare Access: people log in by email, and the Ocean node uses a long-lived service token (two headers).
  Cloudflare Access guards the files, not a connector.
- **Portals** show catalogs and let people act, but they are not connectors.
  ds.ldas.jp gathers the providers' catalogs and lets users contract.
  The Clio-X portal (cliox.ldas.jp) is where a publisher registers a dataset and a consumer buys it.
- **The Ocean node** holds no dataset and does not speak DSP.
  It fetches a file by URL and headers, nothing more.

## Once: the contract

The DSP contract is made once, between the provider and the **Clio-X operator**, who acts for the node as the consumer side.
The agreement is long-lived: "compute only, no redistribution".
The resulting long-lived credential is put into the DDO (the asset's description, stored encrypted) when the publisher registers the dataset on the Clio-X portal.

## Each compute job: no DSP

1. The consumer buys the asset on the Clio-X portal and starts a job.
2. The node fetches the file from the storage, using the URL and headers in the DDO.
3. The node runs the algorithm in an isolated container without network access.
4. The node returns only the results.

The consumer never gets the file.
The two phases are separate in time: the contract does not repeat for each job.

## What is Ocean's, and what is ours

Ocean itself only fetches by URL and headers.
Putting a DSP contract in front of the data is our design, not an Ocean feature.
ds.ldas.jp and the `ldas-dsp` providers implement DSP.
We have not run the DSP conformance test (TCK), so we do not call them conformant.

## Status

- Deployed: the non-public storage behind Cloudflare Access, and the node fetching from it with the service token. A real compute job has downloaded and processed a file this way.
- Planned: a DSP provider for the Clio-X data, built in `ldas-dsp`. It is not deployed yet.
