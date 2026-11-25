# Applying as a verified provider

The prototype page `/experiment/apply-provider` lets a provider ask to be listed
with a "Verified by id.ldas.jp" mark. This page explains two choices on it that
people ask about: why the page asks for a **wallet signature**, and why the
**LDAS ID button is no longer in the site header**.

Code: `src/experiment/verified-provider/Page.tsx` (page),
`worker/applicationFlow.ts` and `worker/walletSignature.ts` (checks),
`/api/provider-application/*` in `worker/index.ts`. Operator steps are in
`docs/verified-providers.md` on the portal branch. Portal commit: `c2965491` (branch `feat/verified-mark`).

## Why a wallet signature

The registry links a wallet address to a name. The portal must therefore know
that the applicant really controls that wallet.

- **Connecting a wallet is only a claim.** When you connect MetaMask, the browser
  tells the page an address. The server never sees proof of it: any script can
  send any address to the server.
- **A signature is a proof the server can check by itself.** The Worker gives the
  page a short message containing a random, single-use number (nonce). The wallet
  signs it (`personal_sign`, EIP-191). From the message and the signature alone,
  the Worker computes which address signed. If that is not the address in the
  message, the application stops.

Signing costs nothing and writes nothing on chain. The message the wallet shows
looks like this:

```
Clio-X の認証済みプロバイダーに申し込みます。
Apply to be a verified Clio-X provider.

署名には費用がかからず、チェーンには何も書き込まれません。
Signing costs nothing and writes nothing on chain.

Address: 0x…
Nonce: <32 hex characters>
URI: https://cliox.ldas.jp
Issued At: 2026-11-25T…Z
```

Before this change (plan A), the page compared the connected wallet with a wallet
written inside the id.ldas.jp credential. That had two problems: the connected
address was still only the browser's claim, and id.ldas.jp is turning wallet
linking off, so credentials will stop carrying a wallet.

## The four checks

All four happen in the Worker. Nothing is stored except a sealed cookie that
expires after 10 minutes.

1. **Start**: the Worker issues the nonce and the message. The same nonce is
   later used as the OID4VP nonce for id.ldas.jp, so both proofs belong to one
   application.
2. **Wallet signature**: the Worker rebuilds the message from its own sealed state
   (it does not trust a message sent by the page) and recovers the signer.
3. **LDAS ID**: the id.ldas.jp credential is verified as before (issuer signature,
   key binding, nonce, audience, revocation). It gives the name and how the
   person was verified. A wallet in the credential, if any, is ignored.
4. **Send**: the Worker checks that the signature and the credential carry the
   same nonce and that consent was given, uses the nonce up (a second submit is
   refused), and emails the operator one registry line sealed with HMAC. The
   signature and the credential are discarded.

Measured on the branch: Worker tests `node --test worker/*.test.mjs` (20 pass).
The signature check uses `@noble/curves` and `@noble/hashes` (about 13 kB
gzipped in the Worker bundle). Recovery took about 15 ms on the first call and
about 1 ms afterwards in Node 25 on a laptop; Workers timings are not measured yet.

## Why the header LDAS ID button is hidden

The LDAS ID button in the header (`src/components/Header/LdasIdButton.tsx`) was
added for chatbot sign-in. Production runs with `CHATBOT_REQUIRE_SIGNIN = "false"`
(`wrangler.jsonc`), so the button did nothing useful there, and people took it
for the way to apply as a provider.

The button now asks the Worker (`GET /api/chatbot/signin`) whether chatbot
sign-in is required, and shows itself only if it is. The apply page has its own
"Verify with LDAS ID" step, so nothing is lost.
