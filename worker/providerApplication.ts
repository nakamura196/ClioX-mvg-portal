/**
 * Provider application helpers: derive registry entries from a verified
 * id.ldas.jp credential, sign them, and compose the operator email.
 *
 * Pure functions only (Web Crypto, no Node APIs) so they run in Workers and
 * in Node tests. The raw credential is never passed in here.
 */

import type { VerifiedLdasUser } from './ldasVerify.ts'

export interface RegistryEntry {
  name: string
  method: string[]
  selfDeclaredName: boolean
  verifiedAt: string
}

// ---------------------------------------------------------------------------
// EIP-55 checksum address (compact Keccak-256, BigInt based)
// ---------------------------------------------------------------------------

const MASK = (BigInt(1) << BigInt(64)) - BigInt(1)
const RC: bigint[] = [
  BigInt('0x0000000000000001'),
  BigInt('0x0000000000008082'),
  BigInt('0x800000000000808a'),
  BigInt('0x8000000080008000'),
  BigInt('0x000000000000808b'),
  BigInt('0x0000000080000001'),
  BigInt('0x8000000080008081'),
  BigInt('0x8000000000008009'),
  BigInt('0x000000000000008a'),
  BigInt('0x0000000000000088'),
  BigInt('0x0000000080008009'),
  BigInt('0x000000008000000a'),
  BigInt('0x000000008000808b'),
  BigInt('0x800000000000008b'),
  BigInt('0x8000000000008089'),
  BigInt('0x8000000000008003'),
  BigInt('0x8000000000008002'),
  BigInt('0x8000000000000080'),
  BigInt('0x000000000000800a'),
  BigInt('0x800000008000000a'),
  BigInt('0x8000000080008081'),
  BigInt('0x8000000000008080'),
  BigInt('0x0000000080000001'),
  BigInt('0x8000000080008008')
]
const ROT = [
  [0, 36, 3, 41, 18],
  [1, 44, 10, 45, 2],
  [62, 6, 43, 15, 61],
  [28, 55, 25, 21, 56],
  [27, 20, 39, 8, 14]
]
const rotl = (x: bigint, n: number): bigint =>
  n === 0 ? x : ((x << BigInt(n)) | (x >> BigInt(64 - n))) & MASK

function keccakF(s: bigint[]): void {
  for (let round = 0; round < 24; round++) {
    const c: bigint[] = []
    for (let x = 0; x < 5; x++)
      c[x] = s[x] ^ s[x + 5] ^ s[x + 10] ^ s[x + 15] ^ s[x + 20]
    for (let x = 0; x < 5; x++) {
      const d = c[(x + 4) % 5] ^ rotl(c[(x + 1) % 5], 1)
      for (let y = 0; y < 5; y++) s[x + 5 * y] ^= d
    }
    const b: bigint[] = new Array(25).fill(BigInt('0'))
    for (let x = 0; x < 5; x++)
      for (let y = 0; y < 5; y++)
        b[y + 5 * ((2 * x + 3 * y) % 5)] = rotl(s[x + 5 * y], ROT[x][y])
    for (let x = 0; x < 5; x++)
      for (let y = 0; y < 5; y++)
        s[x + 5 * y] =
          b[x + 5 * y] ^
          (~b[((x + 1) % 5) + 5 * y] & MASK & b[((x + 2) % 5) + 5 * y])
    s[0] ^= RC[round]
  }
}

export function keccak256Hex(input: Uint8Array): string {
  const rate = 136
  const padded = new Uint8Array(Math.ceil((input.length + 1) / rate) * rate)
  padded.set(input)
  padded[input.length] ^= 0x01
  padded[padded.length - 1] ^= 0x80
  const s: bigint[] = new Array(25).fill(BigInt('0'))
  for (let off = 0; off < padded.length; off += rate) {
    for (let i = 0; i < rate / 8; i++) {
      let lane = BigInt('0')
      for (let j = 7; j >= 0; j--)
        lane = (lane << BigInt('8')) | BigInt(padded[off + i * 8 + j])
      s[i] ^= lane
    }
    keccakF(s)
  }
  let out = ''
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 8; j++)
      out += Number((s[i] >> BigInt(8 * j)) & BigInt('0xff'))
        .toString(16)
        .padStart(2, '0')
  return out
}

export function toChecksumAddress(address: string): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error('Invalid address')
  const lower = address.slice(2).toLowerCase()
  const hash = keccak256Hex(new TextEncoder().encode(lower))
  let out = '0x'
  for (let i = 0; i < 40; i++)
    out += parseInt(hash[i], 16) >= 8 ? lower[i].toUpperCase() : lower[i]
  return out
}

// ---------------------------------------------------------------------------
// Entry derivation
// ---------------------------------------------------------------------------

/**
 * Method tags as derived from the credential's `ldas_verification` evidence
 * (free text written by id.ldas.jp) and disclosed claims. Best effort: the
 * operator reviews the result before listing.
 */
export function deriveMethods(
  user: Pick<VerifiedLdasUser, 'orcid' | 'emailDomain'>,
  verification: Record<string, unknown> | undefined
): string[] {
  const text = verification ? JSON.stringify(verification) : ''
  const tags: string[] = []
  if (user.emailDomain && /domain verified/i.test(text)) {
    tags.push(`domain:${user.emailDomain.toLowerCase()}`)
  }
  if (user.orcid) tags.push('orcid')
  if (/gakunin|学認/i.test(text)) tags.push('gakunin')
  if (/admin/i.test(text)) tags.push('admin-approved')
  return tags
}

export function buildEntry(
  user: VerifiedLdasUser,
  verification: Record<string, unknown> | undefined
): RegistryEntry {
  const method = deriveMethods(user, verification)
  return {
    name: user.name,
    method,
    // ORCID sign-in and email domain do not verify the person's name.
    selfDeclaredName: !(
      method.includes('gakunin') || method.includes('admin-approved')
    ),
    verifiedAt: user.verifiedAt
  }
}

/**
 * The exact string that is signed. Key order is fixed. The CLI
 * (scripts/registry/add-provider.mjs) rebuilds the same string.
 */
export function canonicalApplication(
  wallet: string,
  entry: RegistryEntry
): string {
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

export async function signApplication(
  key: string,
  wallet: string,
  entry: RegistryEntry
): Promise<string> {
  const k = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      'HMAC',
      k,
      new TextEncoder().encode(canonicalApplication(wallet, entry))
    )
  )
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function registrySnippet(wallet: string, entry: RegistryEntry): string {
  return JSON.stringify({ [wallet]: entry }, null, 2)
}

export function composeEmailBody(
  wallet: string,
  entry: RegistryEntry,
  signature: string
): string {
  return [
    'New verified-provider application (wallet signature and credential checked by the Worker).',
    '',
    `Wallet: ${wallet}`,
    `Name: ${entry.name}`,
    `Methods: ${entry.method.join(', ') || '(none derived)'}`,
    `Name self-declared: ${entry.selfDeclaredName}`,
    `Verified at: ${entry.verifiedAt}`,
    '',
    'Registry snippet (paste into scripts/registry/add-provider.mjs, do not edit):',
    registrySnippet(wallet, entry),
    '',
    `Signature (HMAC-SHA256): ${signature}`,
    '',
    'Only list this provider after you have reviewed it. A message without',
    'a signature that passes scripts/registry/add-provider.mjs is not from the portal.'
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Abuse limit: one application per wallet per window (per Worker isolate)
// ---------------------------------------------------------------------------

export const APPLY_WINDOW_MS = 10 * 60 * 1000
const lastApplied = new Map<string, number>()

/** Returns true if allowed (and records the attempt). */
export function allowApplication(wallet: string, now = Date.now()): boolean {
  for (const [k, t] of lastApplied) {
    if (now - t > APPLY_WINDOW_MS) lastApplied.delete(k)
  }
  const key = wallet.toLowerCase()
  if (lastApplied.has(key)) return false
  if (lastApplied.size >= 200) return false // global cap per isolate
  lastApplied.set(key, now)
  return true
}

export function resetApplicationLimit(): void {
  lastApplied.clear()
}
