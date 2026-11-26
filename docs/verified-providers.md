# Verified providers ("Verified by id.ldas.jp")

Providers who have shown an id.ldas.jp credential get a mark in the catalogue,
and the search page can be limited to them. The list is a static file in this
repository, maintained by the operator.

## The registry file

`public/registry/providers.json` (served at `/registry/providers.json`):

```json
{
  "issuer": "did:web:id.ldas.jp",
  "updated": "2026-11-25T00:00:00Z",
  "providers": {
    "0xChecksumWallet": {
      "name": "Name from the credential",
      "method": ["domain:example.org", "orcid"],
      "selfDeclaredName": true,
      "verifiedAt": "2026-11-25T00:00:00.000Z"
    }
  }
}
```

- `method` tags: `domain:<d>` (institutional email domain verified), `orcid`,
  `gakunin`, `admin-approved`.
- `verifiedAt`: when the credential was checked. The portal shows the mark only
  if this is within `NEXT_PUBLIC_LDAS_REGISTRY_MAX_AGE_DAYS` days (default 365).
  Entries without `verifiedAt`, or older, are treated as unverified. To keep a
  provider listed, re-apply (a fresh application replaces the entry) or edit the
  date after re-checking them yourself.
- To remove a provider (revocation), delete their entry and deploy.
- `NEXT_PUBLIC_LDAS_REGISTRY_URL` can point elsewhere (a local fixture in tests).

## How a provider is added

Plan B (2026-11-25): the wallet is proven by a wallet signature, not by the
credential. Connecting a wallet in the browser is only a claim the browser
makes; a signature is a proof the Worker checks itself. id.ldas.jp is turning
wallet linking off, so credentials will no longer carry a wallet.

1. The provider opens `/experiment/apply-provider` (`/ja/experiment/apply-provider`),
   connects their wallet (header button) and ticks the consent box (it lists
   exactly what is published).
2. **Start + wallet signature.** "Sign with wallet" calls
   `POST /api/provider-application/start` `{wallet, consent: true}`. The Worker
   issues a random 128-bit nonce and returns the EIP-191 message to sign
   (bilingual text, then `Address`, `Nonce`, `URI` = portal origin,
   `Issued At`). The page asks the wallet for `personal_sign`, then sends only
   the signature to `POST .../signature`. The Worker rebuilds the message from
   its own state, recovers the signer (`worker/walletSignature.ts`,
   `@noble/curves` secp256k1) and rejects it unless it equals the address in
   the message.
3. **LDAS ID.** "Verify with LDAS ID" calls `POST .../present`, which returns
   the id.ldas.jp authorize URL whose OID4VP nonce **is the same application
   nonce**. `/ldas-callback` posts the presentation to `POST .../credential`.
   The Worker verifies it as before (issuer signature, `kb+jwt` key binding,
   nonce, audience, revocation) and keeps only the derived entry (name, method
   tags, `selfDeclaredName`, `verifiedAt`). No wallet claim is requested; a
   `did:pkh` in the credential, if present, is ignored.
4. **Send.** `POST .../submit` `{consent: true}` checks that the signature and
   the credential carry the same nonce and that consent was given, uses the
   nonce up (a replay gets 409), then emails the operator through Resend
   (the same service and sender as the contact form, which upstream also uses). The email has the wallet (from the signature), name,
   method tags, `selfDeclaredName`, verification time, a registry snippet, and
   an HMAC-SHA256 seal. Neither the signature nor the credential is stored or
   emailed.

Between the steps, the state lives in one HMAC-sealed, HttpOnly cookie
(`cliox_ldas_apply`, sealed with `SESSION_SECRET`, 10 minutes). `GET .../status`
lets the page show where the application stands. Code: `worker/applicationFlow.ts`
(state machine), `/api/provider-application/*` in `worker/index.ts`.

4. The operator reviews the application. If it is acceptable, save the snippet
   from the email to a file (or pipe it) and run the CLI. It checks the
   signature and only then edits the registry:

   ```sh
   pbpaste | APPLICATION_SIGNING_KEY="$(op read 'op://<vault>/<item>/<field>')" \
     node scripts/registry/add-provider.mjs - <signature-from-email>
   git diff public/registry/providers.json
   ```

   A message whose signature does not verify is not from the portal: do not add it.

5. Commit and deploy as usual.

Method tags are derived best-effort from the credential's `ldas_verification`
evidence, so review them. `selfDeclaredName` is `true` unless the evidence shows
`gakunin` or `admin-approved`.

## Operator duties (privacy)

The apply page promises the applicant the following, so the operator must keep it:

- Delete application emails that you do not approve within 30 days.
- A listing lasts until it expires or the provider asks for removal. Expiry is
  automatic in the portal (the mark disappears after the max age), but remove
  expired entries from the file when convenient.
- Removal requests arrive by email at the contact shown on the page (kept in
  `content/verifiedProvider.json`). Handle them promptly:

  ```sh
  node scripts/registry/add-provider.mjs remove <wallet>
  git diff public/registry/providers.json
  ```

  Then commit and deploy; the entry is only gone from the site after the deploy.

- Only the wallet, name, method tags, `selfDeclaredName` and `verifiedAt` are kept.
  Do not add email addresses or ORCID iDs to the registry.

## Worker configuration

| Name                      | Kind       | Purpose                                                    |
| ------------------------- | ---------- | ---------------------------------------------------------- |
| `RESEND_API_KEY`          | secret     | Resend key; also used by the contact form                  |
| `RESEND_FROM_EMAIL`       | var/secret | Sender, an address on a domain verified in Resend          |
| `OPERATOR_EMAIL`          | secret     | Recipient                                                  |
| `APPLICATION_SIGNING_KEY` | secret     | HMAC key; also needed by the CLI                           |
| `SESSION_SECRET`          | secret     | Already used for sign-in; also seals the application state |

Without a Resend key (local dev on localhost), the Worker prints the email body
to the console instead and still shows the "submitted" screen; a throwaway
signing key is used. In production, a missing binding or key returns 503.

Abuse limit: one application per wallet per 10 minutes, and at most 200
distinct wallets in the window, kept in Worker memory (per isolate). Used
nonces are kept the same way until they expire, and the cookie is cleared on
submit, so a replay is refused within an isolate; a replay that reaches another
isolate within the 10 minutes would only send the operator a duplicate email.
These are best-effort brakes, not guarantees; the real gate is that a wallet
signature and a valid, unrevoked id.ldas.jp credential are both required and
that the operator reviews every entry.

Tests: `node --test worker/*.test.mjs` (signature recovery, wrong signer,
tampered nonce, nonce reuse, credential nonce mismatch, the whole flow).
