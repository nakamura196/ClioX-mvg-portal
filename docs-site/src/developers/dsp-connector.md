# Clio-X and a Dataspace Protocol connector

**Clio-X (Ocean compute-to-data) and a Dataspace Protocol (DSP) connector do different jobs, and they can be joined by one credential.**
The connector decides who may use a dataset and under what terms.
The Ocean node runs the computation without ever handing the file to the consumer.
This page draws the relation generically, for a provider whose data must not be public.

![Clio-X, an Ocean node and a DSP connector: where the file goes, and where only metadata or results go](/dsp/dsp-connector-en.svg)

## What each part does

- **The Ocean node holds no dataset.**
  The asset's description (the DDO) stores the file's URL and the request headers, encrypted.
  For each compute job the node fetches the file, runs the algorithm in an isolated container without network access, and returns only the results.
  The consumer never gets the file.
- **The data stays in a non-public place run by the provider.**
  In the example we deployed, that is `cliox-files.ldas.jp`, behind Cloudflare Access.
  People log in by email.
  The node uses a long-lived service token (two headers), stored encrypted in the DDO.
- **A DSP connector** (for example ds.ldas.jp, or Eclipse EDC) offers datasets in a catalog with ODRL policies (machine-readable usage terms).
  It negotiates a contract with the consumer, then starts a transfer that returns a data address and a temporary credential.

## How the two are joined

For Clio-X, the Ocean node is treated as **one consumer** of the connector.
That consumer holds a long-lived agreement: "compute only, no redistribution".
A transfer under that agreement would normally give a temporary credential.
Here the credential is permanent, and it is put into the DDO, where the node reads it for each job.

## What is Ocean's, and what is ours

Ocean itself only fetches a file by URL and headers.
It does not speak DSP.
Putting a DSP connector in front of the data is our design, not an Ocean feature.

ds.ldas.jp implements DSP. We have not run the DSP conformance test (TCK), so we do not call it conformant.
It is one example of a connector, not the only choice.

## Status

- Deployed: the non-public store behind Cloudflare Access, and the node fetching from it with the service token. A real compute job has downloaded and processed a file this way.
- Planned: a DSP provider for this data, built in `ldas-dsp`. It is not deployed yet.
