# The Verify page

The portal menu has an item **Verify** (`/verify`).
It takes one asset identifier (`did:op:…`), finds the Gaia-X Service Credential attached to that asset, and asks a compliance service whether the credential passes.
What a Service Credential is, and how one is prepared, is on [The Gaia-X Service Credential button](/developers/gaia-x-credential).

**On the Sepolia trial, only one asset carries a credential: a demo we made on purpose, and it fails.**
Of the 77 assets on cliox-node none had a credential (counted on 2026-09-27), so we published
[a demo sample](#the-demo-sample) to show what the page does with one.
Every other asset ends with "Service Credential unavailable".

## How to use it

1. Open [cliox.ldas.jp/verify](https://cliox.ldas.jp/verify), or choose **Verify** in the top menu.
2. Paste the asset's DID into the box and press **Verify**.
   In the box the `did:op:` prefix may be left out; the page adds it.
3. The result appears below the box. You can also link straight to a result: `/verify?did=did:op:<64 hex>`.
   In the URL the prefix is **required**; without it the page says "The url is not for a valid DID".

The DID is shown on every asset page, and it is the last part of the asset page's URL.

![The Verify page on the trial site with the Declaration of Independence sample](/media/verify-en.png)

## What the results mean

Checked on https://cliox.ldas.jp on 2026-09-27 (headless browser, no wallet).

| What you see                                                     | Meaning                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Service Credential unavailable**                               | The asset exists, but its description has no credential. This is the result for every Sepolia asset, e.g. the Declaration sample `did:op:04f79245…9787`.                                                                                                                                         |
| **Asset unavailable** + "could not find an asset … in the cache" | The node this portal reads does not know the DID. A Pontus-X asset such as `did:op:3e8d6e4a…47f1` gives this on the trial, because the trial only reads cliox-node on Sepolia. It is not a verdict on the credential.                                                                            |
| **Asset unavailable** + "not for a valid DID"                    | The text is not a DID (typo, or the prefix missing in the URL).                                                                                                                                                                                                                                  |
| A **Service Credential** block with the JSON and a badge         | The credential was found. Two badges: **Service Credential** (check mark = the compliance service accepted it, cross = it did not) and **Credential ID match** (does the credential describe this DID?). The ID is only compared when the first badge passes; after a failure both show a cross. |

"Verified" means a compliance service accepted the file's signatures and content under the Gaia-X rules.
It does not mean anyone checked the data itself, and it says nothing about the archival quality of the record.

## How the check works

From the code on `deploy/hosting` (`a3e93a55`):

- `src/pages/verify.tsx` loads the asset with the same provider as the asset page (`src/@context/Asset.tsx`).
- The credential is read from `metadata.additionalInformation.gaiaXInformation.serviceSD`, either as `url` (fetched with GET) or as `raw` JSON.
- `verifyRawServiceCredential` in `src/components/Publish/_utils.ts` POSTs the whole JSON to `${NEXT_PUBLIC_COMPLIANCE_URI}/v1/api/credential-offers`. The default is `https://www.delta-dao.com/compliance`; the trial does not override it.
- HTTP **201** counts as verified; anything else (409, 500, network error) as not verified.
- The ID match compares the asset DID with the `id` of the single `gx:ServiceOffering` in the presentation. With several offerings it takes the one no other offering `gx:dependsOn`. With none, the badge warns "No root service found".
- The badge's "version" is the configured `NEXT_PUBLIC_COMPLIANCE_API_VERSION` (default `2210`), not a value read from the response (the check is commented out upstream).

Measured on 2026-09-27: the credential of a Pontus-X asset (`https://compliance.agrospai.udl.cat/.well-known/INRAE.vp.json`) sent to that endpoint returned **201** with a signed compliance credential.
That file holds only participant credentials (`gx:LegalParticipant` and two others) and no `gx:ServiceOffering`, so the page should show it as verified but with the "No root service found" warning (inferred from the code; not seen on screen).
Of the 300 newest Pontus-X assets with a `serviceSD.url` field, 286 had it empty.

Two things to know:

- **The credential is sent to a third party.** Every check, on this page and on each asset page that has a credential, sends the full credential from the viewer's browser to delta-dao.com. Credentials are meant to be public, so this is by design, but an institution hosting its own portal may want its own `NEXT_PUBLIC_COMPLIANCE_URI`.
- The page is excluded from search engines (`Disallow: /verify` in `src/pages/robots.txt.tsx`).

## The demo sample

**Gaia-X credential demo (not compliant) - sample record**, `did:op:f40f45aac2acc57fd668ed5c41a0eb7bd39f4c5fae5614286a8e5ab0453f1486`
([Verify](https://cliox.ldas.jp/verify?did=did:op:f40f45aac2acc57fd668ed5c41a0eb7bd39f4c5fae5614286a8e5ab0453f1486)).
The data is the Declaration of Independence text again. Published 2026-09-27 with the trial wallet.

![The Verify page with the demo credential: both badges show a cross](/media/verify-demo-en.png)

Its credential has the same shape as upstream ones (Trust Framework 22.10): a `gx:LegalParticipant`, the Gaia-X terms, and a `gx:ServiceOffering` whose `id` is the asset's DID.
All three are signed (JsonWebSignature2020, PS256) with a key published as `did:web:cliox.ldas.jp`:

- https://cliox.ldas.jp/.well-known/did.json (public key)
- https://cliox.ldas.jp/.well-known/gaia-x-demo/certificate-chain.crt (self-signed certificate)
- https://cliox.ldas.jp/.well-known/gaia-x-demo/declaration-demo.vp.json (the credential; the asset's `serviceSD.url`)

The compliance service answers:

```
409 X509 certificate chain could not be resolved against registry trust anchors
    for VC https://cliox.ldas.jp/.well-known/gaia-x-demo/declaration-demo.vp.json#participant.
```

So the signatures and the `did:web` were read and accepted; the file fails at the next step, because the certificate does not lead back to an authority Gaia-X trusts.
Before `did.json` was published, the same file failed one step earlier ("Could not load document for given did:web").
The portal does not show this reason; only the crosses. To see it, POST the file yourself:
`curl -X POST -H 'Content-Type: application/json' --data @declaration-demo.vp.json https://www.delta-dao.com/compliance/v1/api/credential-offers`.

**What a passing credential needs**, seen in the passing upstream example above:

1. A certificate that leads to a trust anchor. The agrospai.udl.cat key carries an electronic-seal certificate of the Universitat de Lleida ("segell electrònic", with its tax number), issued by the Catalan public-sector certification authority AOC (`CN=EC-SectorPublic`).
2. A registration-number credential issued by a Gaia-X notary (there: `did:web:www.delta-dao.com:notary:v1`, which checked the EU VAT number against VIES). Our demo has none.

Both are about the institution, not about software. That is why the demo cannot pass, and why taking part in Gaia-X is a decision for each institution.

Scripts and files: `deploy/trial/gaia-x-demo/` (build, check, one-shot runner) and `public/.well-known/` on `deploy/hosting`, commit `04a5fc36`.
The signing key is kept in the operator's 1Password, not in the repository.

## On the trial

No change was made to the page's code for Sepolia; it works as upstream.
Whether Clio-X institutions take part in Gaia-X at all is [open question 9](/project/open-questions).
