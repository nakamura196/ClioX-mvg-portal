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

1. The provider opens `/apply-provider` (`/ja/apply-provider`), connects their
   wallet, ticks the consent box (it lists exactly what is published) and
   presents their id.ldas.jp credential (the existing OID4VP flow, `dc+sd-jwt` +
   `kb+jwt`).
2. The Worker (`worker/index.ts`, `/api/provider-application/*`) verifies the
   credential (signature, key binding, nonce, revocation) and rejects it if the
   credential's wallet differs from the connected wallet.
3. The Worker emails the operator (Cloudflare Email Routing `send_email`). The
   email has the wallet, name, method tags, `selfDeclaredName`, verification
   time, a registry snippet, and an HMAC-SHA256 signature. The credential itself
   is neither stored nor emailed.
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

| Name                      | Kind                                       | Purpose                                                    |
| ------------------------- | ------------------------------------------ | ---------------------------------------------------------- |
| `APPLICATION_EMAIL`       | `send_email` binding (in `wrangler.jsonc`) | Sends the email                                            |
| `OPERATOR_EMAIL`          | secret                                     | Recipient; a verified Email Routing destination            |
| `APPLICATION_FROM_EMAIL`  | var/secret                                 | Sender, an address on a domain with Email Routing          |
| `APPLICATION_SIGNING_KEY` | secret                                     | HMAC key; also needed by the CLI                           |
| `SESSION_SECRET`          | secret                                     | Already used for sign-in; also seals the application state |

Without the binding (local dev on localhost), the Worker prints the email body
to the console instead and still shows the "submitted" screen; a throwaway
signing key is used. In production, a missing binding or key returns 503.

Abuse limit: one application per wallet per 10 minutes, and at most 200
distinct wallets in the window, kept in Worker memory (per isolate). It is a
best-effort brake, not a guarantee; the real gate is that a valid, unrevoked
id.ldas.jp credential is required and that the operator reviews every entry.
