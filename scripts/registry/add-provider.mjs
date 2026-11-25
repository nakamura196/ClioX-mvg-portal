#!/usr/bin/env node
/**
 * Adds a provider to public/registry/providers.json, but only if the HMAC
 * signature from the application email is valid.
 *
 * Usage (the key never goes on the command line or into a file):
 *   APPLICATION_SIGNING_KEY="$(op read 'op://<vault>/<item>/<field>')" \
 *     node scripts/registry/add-provider.mjs <snippet.json> <signature>
 * or pipe the snippet:
 *   pbpaste | APPLICATION_SIGNING_KEY=... node scripts/registry/add-provider.mjs - <signature>
 *
 * <snippet.json> holds the "Registry snippet" block from the email, i.e.
 * {"0xChecksumWallet": {"name", "method", "selfDeclaredName", "verifiedAt"}}.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REGISTRY = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'public',
  'registry',
  'providers.json'
)

/** Must stay identical to canonicalApplication() in worker/providerApplication.ts */
export function canonicalApplication(wallet, entry) {
  return JSON.stringify({
    wallet,
    entry: {
      name: entry.name,
      method: entry.method,
      selfDeclaredName: entry.selfDeclaredName,
      verifiedAt: entry.verifiedAt
    }
  })
}

/** Returns { wallet, entry } if the signature is valid; throws otherwise. */
export function verifySnippet(snippetText, signature, key) {
  if (!key) throw new Error('APPLICATION_SIGNING_KEY is not set')
  const snippet = JSON.parse(snippetText)
  const wallets = Object.keys(snippet)
  if (wallets.length !== 1)
    throw new Error('Snippet must contain exactly one wallet')
  const wallet = wallets[0]
  if (!/^0x[0-9a-fA-F]{40}$/.test(wallet))
    throw new Error('Invalid wallet address')
  const entry = snippet[wallet]
  const expected = createHmac('sha256', key)
    .update(canonicalApplication(wallet, entry))
    .digest()
  const given = Buffer.from(String(signature).trim(), 'hex')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new Error('Signature does not match: do NOT add this entry')
  }
  return { wallet, entry }
}

export function addToRegistry(registry, { wallet, entry }, now = new Date()) {
  const providers = { ...registry.providers }
  for (const existing of Object.keys(providers)) {
    if (existing.toLowerCase() === wallet.toLowerCase())
      delete providers[existing]
  }
  providers[wallet] = {
    name: entry.name,
    method: entry.method,
    selfDeclaredName: entry.selfDeclaredName,
    verifiedAt: entry.verifiedAt
  }
  return { ...registry, updated: now.toISOString(), providers }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [file, signature] = process.argv.slice(2)
  if (!file || !signature) {
    console.error(
      'Usage: node scripts/registry/add-provider.mjs <snippet.json|-> <signature>'
    )
    process.exit(2)
  }
  try {
    const text = fs.readFileSync(file === '-' ? 0 : file, 'utf8')
    const verified = verifySnippet(
      text,
      signature,
      process.env.APPLICATION_SIGNING_KEY
    )
    const registry = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'))
    const next = addToRegistry(registry, verified)
    fs.writeFileSync(REGISTRY, `${JSON.stringify(next, null, 2)}\n`)
    console.log(
      `Added ${verified.wallet} (${verified.entry.name}). Review with git diff, then commit.`
    )
  } catch (err) {
    console.error(err.message)
    process.exit(1)
  }
}
