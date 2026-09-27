# The Gaia-X Service Credential button

Asset pages on the upstream portal have a button **Prepare Gaia-X Service Credential**.
This page explains what it is, what it actually does, and why the Sepolia trial site hides it.

## In one paragraph

Gaia-X is a European initiative for sharing data between organisations under one set of rules.
Each organisation describes itself, and each service it offers, in a signed file that machines can check.
The button helps a data provider write the first draft of such a file for one asset.
It only downloads an **unsigned template**. Nothing is sent anywhere and nothing is written on chain.

## The pieces

| Term                   | What it is                                                                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gaia-X                 | A European association (Gaia-X AISBL, Brussels) that publishes rules for trustworthy data sharing, the _Trust Framework_.                             |
| Verifiable Credential  | A W3C standard for a JSON statement signed by whoever issues it, so others can check who said it and that it was not changed.                         |
| Participant Credential | The organisation's own credential: who it is as a legal entity.                                                                                       |
| Service Credential     | A credential about one offering (here: one Clio-X asset). It points to the Participant Credential of its provider.                                    |
| `did:web`              | An identifier tied to a web domain you control; the key used to sign lives under that domain.                                                         |
| GXDCH                  | Gaia-X Digital Clearing House: services run by several operators that check credentials against the rules and sign a compliance result.               |
| Pontus-X               | The Ocean-based network that upstream Clio-X publishes on. It is run as part of the Gaia-X ecosystem, which is why the portal carries these features. |

In archival terms: a Participant Credential is like an institution's registration, and a Service Credential is like a signed finding-aid entry that says which institution vouches for it.
The difference is that anyone can check the signature by machine.

## What the button does

Measured from the code (`src/components/@shared/DDODownloadButton/`):

1. It opens a form with five fields: the provider's `did:web`, the base URL where credentials will be hosted, the URL of the provider's Participant Credential, and two optional lists of related credentials.
2. On **Download** it builds a JSON file `service_did_op_<id>.json` in the browser and saves it.
3. The file is a `gx:ServiceOffering` for the asset's DID, using the Trust Framework **22.10** vocabulary from the Gaia-X _lab development_ registry.
4. Several values are placeholders the provider must replace: `issuanceDate` is empty, terms and conditions are `[basedomain]/yourtermsandconditions.txt` with hash `[hash]`, the policy is `…/yourpolicy.json`, and GDPR is assumed.
5. There is no signature.

To make it count, the provider has to fill in the placeholders, sign the file with the key of their `did:web`, host it at the stated URL, and have it checked by a clearing house.
Then the URL (or the raw JSON) goes into the asset's **Service Credential** field when publishing or editing.
The portal sends it to the compliance service in `NEXT_PUBLIC_COMPLIANCE_URI` (default `https://www.delta-dao.com/compliance`) and, if it passes, shows a "Service Credential" block on the asset page.

## Why the Sepolia trial hides it

Since commit `f0307b02` on `deploy/hosting`, the button appears only for assets on Gaia-X networks: Pontus-X devnet (32456), Pontus-X testnet (32457) and the old Gaia-X testnet (2021000).
On Sepolia it is hidden, for three reasons.

- Sepolia is not part of the Gaia-X ecosystem. No one would check the credential.
- The trial has no `did:web` or Participant Credential, so the form cannot be filled in honestly.
- The template follows Trust Framework 22.10. Later Gaia-X releases changed the format, so the file would need rework even on Pontus-X.

Upstream Clio-X on Pontus-X is not affected.
The **Service Credential** field in the publish and edit forms is still there on Sepolia; it is optional and does nothing unless filled.

## Open question

Whether Clio-X institutions want to take part in Gaia-X at all is a decision for the project, not a technical one.
If they do, the template should be updated to the current Trust Framework before anyone relies on it.
