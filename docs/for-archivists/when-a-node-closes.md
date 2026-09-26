# When the service that published your records closes

_A note for archivists. Draft, 2026-09-26. Not reviewed yet._

## In one sentence

In Clio-X, a published record stays tied to the service (the "node") that
published it. If that service closes, the record disappears from every
catalogue, even though nothing has been deleted.

## What happened to us

Between 10 and 13 August 2026 we published 29 test records on the Clio-X trial
network. They went through two services we ran ourselves: one on a laptop and
one on a rented cloud server.

On 5 September 2026 we closed the cloud server to reduce costs. On
26 September we started a new service on a university server and pointed the
Clio-X catalogue at it. **None of the 29 records appeared.**

The files themselves were not lost. They are still where we stored them. What
we lost was the way in: the catalogue could no longer read the descriptions,
and nobody could request the files through Clio-X.

## Why

When a record is published, the service **seals** its description and the
location of its files. A public ledger (the blockchain) keeps the sealed
version, together with **the address of the service that sealed it**.

To show the record, a catalogue has to ask that address to unseal it. It never
tries anyone else. Our two old addresses no longer answer, so the records stay
sealed.

**An archival comparison.** Think of catalogue cards that a registry office
writes in its own code. The cards stay on a public shelf forever, and each one
says which office wrote it. When that office closes, the cards are still on the
shelf, but nobody can read them.

**Where the comparison stops.** We still had the key of the cloud service; our
new service uses the same key. It did not help, because the catalogue asks the
_address_, not the key. The old address was a bare machine number
(`16.192.66.21`) that disappeared with the rental. If it had been a name we
control, such as `records.example.org`, we could have pointed that name at the
new service. We believe 16 of the 29 records would then have come back. (This
is our reading of the software; we have not tested it.)

## What is not lost

- The ledger still shows that each record exists, who owns it, and every
  change and request made to it. That history cannot be erased.
- The files are wherever the institution stored them.

## What an institution should decide before it publishes

1. **Publish under a web address the institution controls for the long
   term.** Use a name, not the number of one machine. You can move a name to a
   new machine.
2. **Keep the service's key in the institution's secure store.** The key is
   needed together with the address. Having only one of them does not help.
3. **Before closing a service, list everything published through it** and
   decide for each record: move it (publish again elsewhere) or retire it on
   purpose.
4. **Keep your own copy of the descriptions outside Clio-X.** Clio-X is a
   place to share records. It is not the preservation copy.
5. **If another organisation runs the service for you** (for example, a
   Pontus-X member), ask what happens to your records if that service closes.

## Questions this raises for Clio-X

- Should Clio-X ask institutions for points 1 and 2 before they join?
- Should Clio-X offer a way to move records between services?
- Could the "custodian" of a record in Clio-X be the institution, not the
  service it happened to use?
