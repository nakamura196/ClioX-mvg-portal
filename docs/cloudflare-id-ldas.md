# Cloudflare Workers + Assets & id.ldas.jp Integration

This document describes how `cliox.ldas.jp` runs on **Cloudflare Workers + Assets (free plan)** and integrates with **`https://id.ldas.jp`** (OID4VP 1.0, RFC 9901 `dc+sd-jwt` + `kb+jwt`, W3C Bitstring Status List v1.0).

## 1. Architecture (Cloudflare Free Plan)

- **Static UI (`./out`)**: Next.js 15 Pages Router exported statically (`npm run build:cf`). Static pages and `/_next/static/*` are served directly by Cloudflare Workers Assets (**0 ms Worker CPU**).
- **Lightweight API Worker (`worker/index.ts`)**: Invoked only for `/api/*`, `/ja/*`, dynamic shells (`/asset/*`, `/profile/*`), `/robots.txt`, `/sitemap.xml`, and legacy redirects.
- **Backend (`cliox-node.ldas.jp`)**: Stays on the `mdx` VM (Docker Ocean Node + Subgraph + optional Chatbot) exposed via Cloudflare Tunnel.

## 2. id.ldas.jp Integration

### A. Portal Sign-In (OID4VP 1.0 + `dc+sd-jwt` + `kb+jwt`)

1. Clicking **LDAS ID** in the header calls `GET /api/auth/ldas/start`.
2. The Worker generates a random `state` and `nonce`, stores them in a short-lived HMAC-signed `HttpOnly` cookie, and redirects to `https://id.ldas.jp/authorize` with `response_type=vp_token` and `dcql_query`.
3. `id.ldas.jp` authenticates the user (ORCID / GakuNin RDM / institutional email OTP / Passkey), issues a selectively disclosed `dc+sd-jwt` bound to a browser-generated P-256 `kb+jwt`, and redirects to `/ldas-callback/#vp_token=...&state=...`.
4. `/ldas-callback` posts the token to `POST /api/auth/ldas/verify`. The Worker verifies:
   - `state` match (CSRF protection)
   - Ed25519 signature against `https://id.ldas.jp/.well-known/did.json`
   - SD-JWT `_sd` disclosure digests
   - `kb+jwt` P-256 signature, `aud`, `nonce`, and `sd_hash`
   - Signed W3C Bitstring Status List v1.0 (`https://id.ldas.jp/status/1`) for immediate revocation
5. On success, the Worker issues an HMAC-signed `HttpOnly` session cookie (`cliox_ldas_session`). The header displays the verified name, affiliation, ORCID, and whether the credential wallet (`did:pkh`) matches the connected MetaMask wallet.

### B. Ocean Node Policy Server (`POST /api/policy-server`)

The Worker also exposes `POST /api/policy-server` for Ocean Node's `POLICY_SERVER_URL`.
It verifies an `id.ldas.jp` VC (`vc+jwt` or `dc+sd-jwt`), checks `/status/1` revocation, and confirms that the credential's `did:pkh` wallet matches `consumerAddress`.

## 3. Build, Test, and Deploy

```zsh
# 1. Run credential verifier tests
node --test worker/ldasVerify.test.mjs

# 2. Build static export (`out/`)
npm run build:cf

# 3. Deploy Worker + Assets to Cloudflare
npx wrangler deploy

# 4. Set secrets from 1Password (never write secrets to disk)
openssl rand -base64 32 | tr -d '\n' | npx wrangler secret put SESSION_SECRET
# Optional (if chatbot / contact form is enabled):
# op read "op://Personal/<item>/chatbot_api_key" | tr -d '\n' | npx wrangler secret put CHATBOT_API_KEY
# op read "op://Personal/id-ldas resend/api_key" | tr -d '\n' | npx wrangler secret put RESEND_API_KEY
```

### Cutover from Vercel to Cloudflare (`cliox.ldas.jp`)

1. Verify the deployed `workers.dev` preview URL (`https://cliox-portal.<subdomain>.workers.dev`).
2. Uncomment `"routes": [{ "pattern": "cliox.ldas.jp", "custom_domain": true }]` in `wrangler.jsonc`.
3. Remove the Vercel CNAME for `cliox.ldas.jp` in Cloudflare DNS (or let Custom Domains replace it) and run `npx wrangler deploy`.
