/**
 * Verifier for id.ldas.jp credentials (OID4VP 1.0, RFC 9901 dc+sd-jwt + kb+jwt,
 * W3C VCDM 2.0 vc+jwt, and W3C Bitstring Status List v1.0).
 *
 * Uses only standard Web Crypto / Fetch / DecompressionStream APIs so it runs
 * with zero external dependencies on both Cloudflare Workers and Node 22.
 */

export interface VerifiedLdasUser {
  sub: string
  name: string
  orcid?: string
  memberOf?: string
  wallet?: string
  affiliation?: string
  emailDomain?: string
  issuer: string
  format: 'dc+sd-jwt' | 'vc+jwt'
  statusIndex?: string
  verifiedAt: string
  /** Issuer's `ldas_verification` evidence (not part of the session) */
  verification?: Record<string, unknown>
}

export interface VerifyOptions {
  issuerOrigin?: string
  expectedAud?: string
  expectedNonce?: string
  requireKeyBinding?: boolean
  fetchFn?: typeof fetch
}

const DEFAULT_ISSUER_ORIGIN = 'https://id.ldas.jp'

function b64urlToBytes(input: string): Uint8Array {
  const pad = (4 - (input.length % 4)) % 4
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad)
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function bytesToB64url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodeJsonSegment<T = Record<string, unknown>>(seg: string): T {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(seg))) as T
}

async function sha256B64url(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text)
  )
  return bytesToB64url(new Uint8Array(digest))
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('gzip')
  const stream = new Blob([bytes as unknown as BlobPart])
    .stream()
    .pipeThrough(ds)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

// Short-lived in-memory cache for the issuer DID document public key
const keyCache = new Map<
  string,
  { key: CryptoKey; did: string; expiresAt: number }
>()

async function fetchIssuerPublicKey(
  issuerOrigin: string,
  fetchFn: typeof fetch
): Promise<{ key: CryptoKey; did: string }> {
  const now = Date.now()
  const useCache = fetchFn === fetch
  const cached = useCache ? keyCache.get(issuerOrigin) : undefined
  if (cached && cached.expiresAt > now) {
    return { key: cached.key, did: cached.did }
  }

  const res = await fetchFn(`${issuerOrigin}/.well-known/did.json`, {
    headers: { Accept: 'application/json' }
  })
  if (!res.ok) {
    throw new Error(`Failed to fetch issuer DID document (${res.status})`)
  }
  const doc = (await res.json()) as {
    id?: string
    verificationMethod?: Array<{
      id?: string
      publicKeyJwk?: JsonWebKey
    }>
  }
  const vm = doc.verificationMethod?.[0]
  if (!doc.id || !vm?.publicKeyJwk) {
    throw new Error('Issuer DID document missing verificationMethod')
  }

  const key = await crypto.subtle.importKey(
    'jwk',
    vm.publicKeyJwk,
    { name: 'Ed25519' },
    false,
    ['verify']
  )
  if (useCache) {
    keyCache.set(issuerOrigin, {
      key,
      did: doc.id,
      expiresAt: now + 10 * 60 * 1000
    })
  }
  return { key, did: doc.id }
}

async function verifyEd25519Jwt(
  jwt: string,
  publicKey: CryptoKey
): Promise<{ header: Record<string, unknown>; payload: Record<string, any> }> {
  const parts = jwt.split('.')
  if (parts.length !== 3) throw new Error('Invalid JWT format')
  const [headerB64, payloadB64, sigB64] = parts
  const header = decodeJsonSegment<Record<string, unknown>>(headerB64)
  if (header.alg !== 'EdDSA') {
    throw new Error(`Unsupported JWT alg: ${String(header.alg)}`)
  }
  const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`)
  const signature = b64urlToBytes(sigB64)
  const valid = await crypto.subtle.verify(
    'Ed25519',
    publicKey,
    signature as unknown as BufferSource,
    signingInput
  )
  if (!valid) throw new Error('Invalid Ed25519 JWT signature')
  const payload = decodeJsonSegment<Record<string, any>>(payloadB64)
  return { header, payload }
}

async function checkBitstringStatus(
  credentialStatus: Record<string, any> | undefined,
  issuerOrigin: string,
  publicKey: CryptoKey,
  expectedDid: string,
  fetchFn: typeof fetch
): Promise<string | undefined> {
  if (!credentialStatus) return undefined
  if (credentialStatus.type !== 'BitstringStatusListEntry') return undefined

  const listUrl = String(credentialStatus.statusListCredential || '')
  const indexStr = String(credentialStatus.statusListIndex ?? '')
  if (!listUrl || !/^\d+$/.test(indexStr)) {
    throw new Error('Malformed credentialStatus entry')
  }
  // Guard against SSRF: status list must live on the trusted issuer origin
  if (!listUrl.startsWith(`${issuerOrigin}/`)) {
    throw new Error('Untrusted statusListCredential origin')
  }

  const res = await fetchFn(listUrl, {
    headers: { Accept: 'application/vc+jwt, application/json' }
  })
  if (!res.ok) {
    throw new Error(`Failed to fetch status list (${res.status})`)
  }
  const raw = (await res.text()).trim()
  const { payload: statusCred } = await verifyEd25519Jwt(raw, publicKey)
  if (statusCred.iss !== expectedDid && statusCred.issuer !== expectedDid) {
    throw new Error('Status list issuer mismatch')
  }
  const encodedList = String(statusCred.credentialSubject?.encodedList || '')
  if (!encodedList.startsWith('u')) {
    throw new Error('Unsupported Bitstring Status List encoding')
  }

  const compressed = b64urlToBytes(encodedList.slice(1))
  const bitstring = await gunzip(compressed)
  const idx = Number(indexStr)
  const byteIndex = idx >> 3
  if (byteIndex >= bitstring.length) {
    throw new Error('Status list index out of range')
  }
  const isRevoked = (bitstring[byteIndex] & (1 << (7 - (idx & 7)))) !== 0
  if (isRevoked) {
    throw new Error('Credential has been revoked')
  }
  return indexStr
}

/**
 * Extracts a single credential string from an OID4VP 1.0 vp_token (DCQL JSON
 * object `{ "<query_id>": ["<sd-jwt+kb>"] }`) or a raw JWT / SD-JWT string.
 */
export function extractCredentialFromVpToken(rawVpToken: string): string {
  const trimmed = rawVpToken.trim()
  if (trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>
    for (const val of Object.values(parsed)) {
      if (Array.isArray(val) && typeof val[0] === 'string' && val[0]) {
        return val[0]
      }
      if (typeof val === 'string' && val) return val
    }
    throw new Error('vp_token JSON contained no credential')
  }
  return trimmed
}

/**
 * Verifies an id.ldas.jp credential (`dc+sd-jwt` with optional `kb+jwt`, or
 * `vc+jwt`) against `/.well-known/did.json` and `/status/1`.
 */
export async function verifyLdasCredential(
  rawToken: string,
  options: VerifyOptions = {}
): Promise<VerifiedLdasUser> {
  const issuerOrigin = (options.issuerOrigin || DEFAULT_ISSUER_ORIGIN).replace(
    /\/+$/,
    ''
  )
  const fetchFn = options.fetchFn || fetch
  const token = extractCredentialFromVpToken(rawToken)

  const { key: issuerKey, did: expectedDid } = await fetchIssuerPublicKey(
    issuerOrigin,
    fetchFn
  )

  const isSdJwt = token.includes('~')
  let issuerJwt = token
  let disclosures: string[] = []
  let kbJwt: string | null = null
  let sdJwtWithoutKb = ''

  if (isSdJwt) {
    const parts = token.split('~')
    issuerJwt = parts[0]
    const last = parts[parts.length - 1]
    if (last && last.includes('.')) {
      kbJwt = last
      disclosures = parts.slice(1, -1).filter(Boolean)
      sdJwtWithoutKb = token.slice(0, token.length - kbJwt.length)
    } else {
      disclosures = parts.slice(1).filter(Boolean)
      sdJwtWithoutKb = token.endsWith('~') ? token : `${token}~`
    }
  }

  const { header, payload } = await verifyEd25519Jwt(issuerJwt, issuerKey)

  if (payload.iss !== expectedDid && payload.issuer !== expectedDid) {
    throw new Error('Credential issuer mismatch')
  }
  const nowSec = Math.floor(Date.now() / 1000)
  if (typeof payload.exp === 'number' && payload.exp < nowSec - 30) {
    throw new Error('Credential expired')
  }
  if (typeof payload.iat === 'number' && payload.iat > nowSec + 300) {
    throw new Error('Credential issued in the future')
  }

  // Merge selectively disclosed claims into credentialSubject
  const subject: Record<string, any> = { ...(payload.credentialSubject || {}) }
  if (isSdJwt && disclosures.length > 0) {
    const allowedHashes = new Set<string>(
      Array.isArray(subject._sd) ? subject._sd : []
    )
    for (const d of disclosures) {
      const digest = await sha256B64url(d)
      if (!allowedHashes.has(digest)) {
        throw new Error('SD-JWT disclosure digest mismatch')
      }
      const parsed = decodeJsonSegment<unknown[]>(d)
      if (!Array.isArray(parsed) || parsed.length < 3) {
        throw new Error('Malformed SD-JWT disclosure')
      }
      const [, claimName, claimValue] = parsed
      if (typeof claimName === 'string') {
        subject[claimName] = claimValue
      }
    }
  }

  // Verify Key Binding JWT (RFC 9901) if present or required
  if (options.requireKeyBinding && !kbJwt) {
    throw new Error('Missing required kb+jwt key binding')
  }
  if (kbJwt) {
    const cnfJwk = payload.cnf?.jwk as JsonWebKey | undefined
    if (!cnfJwk) {
      throw new Error('kb+jwt present but credential has no cnf.jwk')
    }
    const kbParts = kbJwt.split('.')
    if (kbParts.length !== 3) throw new Error('Malformed kb+jwt')
    const [kbHeadB64, kbPayB64, kbSigB64] = kbParts
    const kbHeader = decodeJsonSegment<Record<string, unknown>>(kbHeadB64)
    if (kbHeader.alg !== 'ES256' || kbHeader.typ !== 'kb+jwt') {
      throw new Error('Invalid kb+jwt header')
    }
    const holderKey = await crypto.subtle.importKey(
      'jwk',
      cnfJwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify']
    )
    const kbValid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      holderKey,
      b64urlToBytes(kbSigB64) as unknown as BufferSource,
      new TextEncoder().encode(`${kbHeadB64}.${kbPayB64}`)
    )
    if (!kbValid) throw new Error('Invalid kb+jwt signature')

    const kbPayload = decodeJsonSegment<Record<string, any>>(kbPayB64)
    const expectedSdHash = await sha256B64url(sdJwtWithoutKb)
    if (kbPayload.sd_hash !== expectedSdHash) {
      throw new Error('kb+jwt sd_hash mismatch')
    }
    if (options.expectedAud && kbPayload.aud !== options.expectedAud) {
      throw new Error('kb+jwt audience mismatch')
    }
    if (options.expectedNonce && kbPayload.nonce !== options.expectedNonce) {
      throw new Error('kb+jwt nonce mismatch')
    }
    if (
      typeof kbPayload.iat === 'number' &&
      Math.abs(nowSec - kbPayload.iat) > 600
    ) {
      throw new Error('kb+jwt timestamp outside allowed skew')
    }
  } else {
    // Fallback mode (without kb+jwt): check nonce/aud directly on issuer JWT
    if (
      options.expectedAud &&
      payload.aud &&
      payload.aud !== options.expectedAud
    ) {
      throw new Error('Credential audience mismatch')
    }
    if (
      options.expectedNonce &&
      payload.nonce &&
      payload.nonce !== options.expectedNonce
    ) {
      throw new Error('Credential nonce mismatch')
    }
  }

  // Verify W3C Bitstring Status List v1.0 revocation status
  const statusIndex = await checkBitstringStatus(
    payload.credentialStatus,
    issuerOrigin,
    issuerKey,
    expectedDid,
    fetchFn
  )

  // Extract wallet address from disclosed `wallet` or `did:pkh:eip155:<chain>:<addr>`
  let wallet: string | undefined =
    typeof subject.wallet === 'string' ? subject.wallet : undefined
  if (!wallet && typeof subject.id === 'string') {
    const m = /^did:pkh:eip155:\d+:(0x[a-fA-F0-9]{40})$/.exec(subject.id)
    if (m) wallet = m[1]
  }

  return {
    sub: String(subject.id || ''),
    name: String(subject.name || subject.orcid || 'LDAS User'),
    orcid: typeof subject.orcid === 'string' ? subject.orcid : undefined,
    memberOf:
      typeof subject.memberOf === 'string' ? subject.memberOf : undefined,
    wallet,
    affiliation:
      typeof subject.affiliation === 'string' ? subject.affiliation : undefined,
    emailDomain:
      typeof subject.emailDomain === 'string' ? subject.emailDomain : undefined,
    issuer: expectedDid,
    format: header.typ === 'dc+sd-jwt' || isSdJwt ? 'dc+sd-jwt' : 'vc+jwt',
    statusIndex,
    verifiedAt: new Date().toISOString(),
    verification:
      payload.ldas_verification && typeof payload.ldas_verification === 'object'
        ? payload.ldas_verification
        : undefined
  }
}
