import assert from 'node:assert/strict'
import { test } from 'node:test'
import { verifyLdasCredential, bytesToB64url } from './ldasVerify.ts'

async function sha256B64url(text) {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text)
  )
  return bytesToB64url(new Uint8Array(buf))
}

async function gzip(bytes) {
  const cs = new CompressionStream('gzip')
  const stream = new Blob([bytes]).stream().pipeThrough(cs)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function signEd25519Jwt(header, payload, privateKey) {
  const h = bytesToB64url(new TextEncoder().encode(JSON.stringify(header)))
  const p = bytesToB64url(new TextEncoder().encode(JSON.stringify(payload)))
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      'Ed25519',
      privateKey,
      new TextEncoder().encode(`${h}.${p}`)
    )
  )
  return `${h}.${p}.${bytesToB64url(sig)}`
}

let sharedIssuerKeys
async function makeFixture({
  revoked = false,
  aud = 'https://cliox.ldas.jp',
  nonce = 'n-123',
  shareKeys = false,
  evidence
} = {}) {
  const issuerKeys =
    (shareKeys && sharedIssuerKeys) ||
    (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
      'sign',
      'verify'
    ]))
  if (shareKeys) sharedIssuerKeys = issuerKeys
  const issuerPubJwk = await crypto.subtle.exportKey(
    'jwk',
    issuerKeys.publicKey
  )

  const holderKeys = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  )
  const holderPubJwk = await crypto.subtle.exportKey(
    'jwk',
    holderKeys.publicKey
  )
  const cnfJwk = {
    kty: holderPubJwk.kty,
    crv: holderPubJwk.crv,
    x: holderPubJwk.x,
    y: holderPubJwk.y
  }

  const disclosures = [
    ['s1', 'name', 'Satoru Nakamura'],
    ['s2', 'orcid', 'https://orcid.org/0000-0001-8245-7925'],
    ['s3', 'memberOf', 'LDAS'],
    ['s4', 'affiliation', 'The University of Tokyo'],
    ['s5', 'emailDomain', 'u-tokyo.ac.jp'],
    ['s6', 'wallet', '0x6E430000000000000000000000000000000032C3']
  ].map((arr) => bytesToB64url(new TextEncoder().encode(JSON.stringify(arr))))
  const sdHashes = await Promise.all(disclosures.map((d) => sha256B64url(d)))

  const now = Math.floor(Date.now() / 1000)
  const issuerJwt = await signEd25519Jwt(
    { alg: 'EdDSA', typ: 'dc+sd-jwt', kid: 'did:web:id.ldas.jp#key-1' },
    {
      iss: 'did:web:id.ldas.jp',
      issuer: 'did:web:id.ldas.jp',
      iat: now,
      exp: now + 3600,
      vct: 'https://id.ldas.jp/credentials/member/v1',
      ...(evidence ? { ldas_verification: evidence } : {}),
      cnf: { jwk: cnfJwk },
      credentialSubject: {
        id: 'did:pkh:eip155:11155111:0x6E430000000000000000000000000000000032C3',
        _sd: sdHashes
      },
      credentialStatus: {
        id: 'https://id.ldas.jp/status/1#7',
        type: 'BitstringStatusListEntry',
        statusPurpose: 'revocation',
        statusListIndex: '7',
        statusListCredential: 'https://id.ldas.jp/status/1'
      }
    },
    issuerKeys.privateKey
  )

  const sdJwtWithoutKb = `${issuerJwt}~${disclosures.join('~')}~`
  const sd_hash = await sha256B64url(sdJwtWithoutKb)
  const kbH = bytesToB64url(
    new TextEncoder().encode(JSON.stringify({ alg: 'ES256', typ: 'kb+jwt' }))
  )
  const kbP = bytesToB64url(
    new TextEncoder().encode(JSON.stringify({ iat: now, aud, nonce, sd_hash }))
  )
  const kbSig = new Uint8Array(
    await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      holderKeys.privateKey,
      new TextEncoder().encode(`${kbH}.${kbP}`)
    )
  )
  const fullToken = `${sdJwtWithoutKb}${kbH}.${kbP}.${bytesToB64url(kbSig)}`
  const vpToken = JSON.stringify({ 'cliox-ldas-member': [fullToken] })

  const bits = new Uint8Array(16384)
  if (revoked) bits[7 >> 3] |= 1 << (7 - (7 & 7))
  const encodedList = `u${bytesToB64url(await gzip(bits))}`
  const statusJwt = await signEd25519Jwt(
    { alg: 'EdDSA', typ: 'vc+jwt', kid: 'did:web:id.ldas.jp#key-1' },
    {
      iss: 'did:web:id.ldas.jp',
      issuer: 'did:web:id.ldas.jp',
      iat: now,
      credentialSubject: { encodedList }
    },
    issuerKeys.privateKey
  )

  const didDoc = {
    id: 'did:web:id.ldas.jp',
    verificationMethod: [
      { id: 'did:web:id.ldas.jp#key-1', publicKeyJwk: issuerPubJwk }
    ]
  }

  const mockFetch = async (url) => {
    const s = String(url)
    if (s.endsWith('/.well-known/did.json')) {
      return new Response(JSON.stringify(didDoc), { status: 200 })
    }
    if (s.endsWith('/status/1')) {
      return new Response(statusJwt, { status: 200 })
    }
    return new Response('not found', { status: 404 })
  }

  return { vpToken, mockFetch, didDoc, statusJwt }
}

test('verifies valid OID4VP dc+sd-jwt + kb+jwt + signed status list', async () => {
  const { vpToken, mockFetch } = await makeFixture({
    revoked: false,
    aud: 'https://cliox.ldas.jp',
    nonce: 'nonce-abc'
  })
  const user = await verifyLdasCredential(vpToken, {
    issuerOrigin: 'https://id.ldas.jp',
    expectedAud: 'https://cliox.ldas.jp',
    expectedNonce: 'nonce-abc',
    requireKeyBinding: true,
    fetchFn: mockFetch
  })
  assert.equal(user.name, 'Satoru Nakamura')
  assert.equal(user.affiliation, 'The University of Tokyo')
  assert.equal(user.memberOf, 'LDAS')
  assert.equal(user.wallet, '0x6E430000000000000000000000000000000032C3')
  assert.equal(user.format, 'dc+sd-jwt')
})

test('rejects revoked credential via W3C Bitstring Status List', async () => {
  const { vpToken, mockFetch } = await makeFixture({
    revoked: true,
    aud: 'https://cliox.ldas.jp',
    nonce: 'nonce-rev'
  })
  await assert.rejects(
    () =>
      verifyLdasCredential(vpToken, {
        issuerOrigin: 'https://id.ldas.jp',
        expectedAud: 'https://cliox.ldas.jp',
        expectedNonce: 'nonce-rev',
        requireKeyBinding: true,
        fetchFn: mockFetch
      }),
    /revoked/i
  )
})

test('rejects mismatched nonce in kb+jwt', async () => {
  const { vpToken, mockFetch } = await makeFixture({
    revoked: false,
    aud: 'https://cliox.ldas.jp',
    nonce: 'nonce-real'
  })
  await assert.rejects(
    () =>
      verifyLdasCredential(vpToken, {
        issuerOrigin: 'https://id.ldas.jp',
        expectedAud: 'https://cliox.ldas.jp',
        expectedNonce: 'nonce-wrong',
        requireKeyBinding: true,
        fetchFn: mockFetch
      }),
    /nonce mismatch/i
  )
})

// --- provider application ---------------------------------------------------
import {
  toChecksumAddress,
  deriveMethods,
  buildEntry,
  signApplication,
  composeEmailBody,
  allowApplication,
  resetApplicationLimit
} from './providerApplication.ts'
import {
  verifySnippet,
  addToRegistry,
  removeFromRegistry
} from '../scripts/registry/add-provider.mjs'

test('toChecksumAddress matches EIP-55 test vectors', () => {
  for (const a of [
    '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
    '0xedAa08237554bBafC218f0EaA86704e1aDe9262E'
  ]) {
    assert.equal(toChecksumAddress(a.toLowerCase()), a)
  }
})

test('deriveMethods reads ldas_verification evidence', () => {
  const evidence = {
    method: 'ORCID sign-in only (anyone with an ORCID iD)',
    affiliationVerification:
      'Institutional email domain verified by one-time code (raw email not stored)'
  }
  assert.deepEqual(
    deriveMethods(
      { orcid: 'https://orcid.org/x', emailDomain: 'U-Tokyo.ac.jp' },
      evidence
    ),
    ['domain:u-tokyo.ac.jp', 'orcid']
  )
  assert.deepEqual(
    deriveMethods({}, { method: 'Approved by an administrator' }),
    ['admin-approved']
  )
  assert.deepEqual(deriveMethods({}, undefined), [])
})

test('signed application verifies in the CLI; tampering and a wrong key fail', async () => {
  const user = {
    name: 'A Provider',
    orcid: 'https://orcid.org/x',
    emailDomain: 'example.org',
    verifiedAt: '2026-11-25T00:00:00.000Z'
  }
  const entry = buildEntry(user, {
    affiliationVerification:
      'Institutional email domain verified by one-time code'
  })
  const wallet = toChecksumAddress('0xedaa08237554bbafc218f0eaa86704e1ade9262e')
  const sig = await signApplication('k1', wallet, entry)
  const body = composeEmailBody(wallet, entry, sig)
  assert.match(body, /Signature \(HMAC-SHA256\)/)
  assert.ok(!/vp_token|eyJ/.test(body))

  const snippet = JSON.stringify({ [wallet]: entry })
  const ok = verifySnippet(snippet, sig, 'k1')
  assert.equal(ok.wallet, wallet)
  assert.throws(() => verifySnippet(snippet, sig, 'other'), /Signature/)
  const forged = JSON.stringify({ [wallet]: { ...entry, name: 'Evil' } })
  assert.throws(() => verifySnippet(forged, sig, 'k1'), /Signature/)
  assert.throws(() => verifySnippet(snippet, sig, ''), /not set/)

  const next = addToRegistry({ issuer: 'x', updated: '', providers: {} }, ok)
  assert.equal(next.providers[wallet].verifiedAt, entry.verifiedAt)
})

test('one application per wallet per window', () => {
  resetApplicationLimit()
  assert.equal(allowApplication('0xAbc', 1000), true)
  assert.equal(allowApplication('0xabc', 2000), false)
  assert.equal(allowApplication('0xabc', 1000 + 11 * 60 * 1000), true)
})

// --- Worker endpoints (plan B: start -> signature -> present -> credential -> submit)
import worker from './index.ts'
import { resetUsedNonces } from './applicationFlow.ts'
import { hashPersonalMessage } from './walletSignature.ts'
import { secp256k1 } from '@noble/curves/secp256k1'
import { keccak_256 } from '@noble/hashes/sha3'

// Throwaway test key (never used anywhere else)
const TEST_PRIV =
  '4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318'
const hex = (b) =>
  Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
const TEST_WALLET = toChecksumAddress(
  '0x' +
    hex(
      keccak_256(secp256k1.getPublicKey(TEST_PRIV, false).slice(1)).slice(-20)
    )
)
function personalSign(message, priv = TEST_PRIV) {
  const sig = secp256k1.sign(hashPersonalMessage(message), priv)
  return '0x' + sig.toCompactHex() + (27 + sig.recovery).toString(16)
}

const ORIGIN = 'http://localhost:8148'
const ENV = {} // local dev: no binding, no secrets

function cookieJar() {
  let cookie = ''
  const call = async (path, body, method = 'POST') => {
    const res = await worker.fetch(
      new Request(`${ORIGIN}/api/provider-application/${path}`, {
        method,
        headers: cookie ? { Cookie: cookie } : {},
        body: method === 'GET' ? undefined : JSON.stringify(body ?? {})
      }),
      ENV
    )
    const set = res.headers.get('Set-Cookie')
    if (set) cookie = set.split(';')[0]
    return res
  }
  call.cookie = () => cookie
  return call
}

async function withIssuerFetch(fixture, fn) {
  const realFetch = globalThis.fetch
  globalThis.fetch = async (u) => {
    const s = String(u)
    if (s.endsWith('/.well-known/did.json'))
      return new Response(JSON.stringify(fixture.didDoc))
    if (s.endsWith('/status/1')) return new Response(fixture.statusJwt)
    return new Response('nf', { status: 404 })
  }
  try {
    return await fn()
  } finally {
    globalThis.fetch = realFetch
  }
}

/**
 * Runs the four stages. `sign(message)` returns the signature to send;
 * `credentialNonce(nonce)` picks the nonce the presentation is bound to.
 */
async function applyRoundTrip({
  connected = TEST_WALLET,
  sign = (m) => personalSign(m),
  credentialNonce = (n) => n,
  evidence
} = {}) {
  const call = cookieJar()
  const start = await call('start', { wallet: connected, consent: true })
  assert.equal(start.status, 200)
  const { message, nonce } = await start.json()
  assert.ok(message.includes(`Nonce: ${nonce}`))

  const signed = await call('signature', { signature: sign(message) })
  if (signed.status !== 200) return { res: signed, logs: [] }

  const present = await call('present')
  assert.equal(present.status, 200)
  const q = new URL((await present.json()).authorizeUrl).searchParams
  assert.equal(q.get('nonce'), nonce) // one nonce for both proofs

  const fixture = await makeFixture({
    aud: ORIGIN,
    nonce: credentialNonce(nonce),
    shareKeys: true,
    evidence
  })
  const cred = await withIssuerFetch(fixture, () =>
    call('credential', { vp_token: fixture.vpToken, state: q.get('state') })
  )
  if (cred.status !== 200) return { res: cred, logs: [] }

  const logs = []
  const realLog = console.log
  console.log = (...a) => logs.push(a.join(' '))
  try {
    const res = await call('submit', { consent: true })
    return { res, logs, call }
  } finally {
    console.log = realLog
  }
}

test('application endpoint: signature + credential on one nonce is accepted', async () => {
  resetApplicationLimit()
  resetUsedNonces()
  const { res, logs } = await applyRoundTrip({
    evidence: {
      affiliationVerification:
        'Institutional email domain verified by one-time code'
    }
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.submitted, true)
  assert.equal(body.wallet, TEST_WALLET) // from the signature, not the credential
  assert.deepEqual(body.method, ['domain:u-tokyo.ac.jp', 'orcid'])
  assert.equal(logs.length, 1)
  assert.match(logs[0], /Signature \(HMAC-SHA256\): [0-9a-f]{64}/)
  assert.ok(logs[0].includes(`Wallet: ${TEST_WALLET}`))
  assert.ok(!logs[0].includes('~'))
})

test('application endpoint: a signature from another key is rejected', async () => {
  resetApplicationLimit()
  resetUsedNonces()
  const other =
    '0123456789012345678901234567890123456789012345678901234567890123'
  const { res } = await applyRoundTrip({ sign: (m) => personalSign(m, other) })
  assert.equal(res.status, 403)
})

test("application endpoint: claiming someone else's wallet is rejected", async () => {
  resetApplicationLimit()
  resetUsedNonces()
  const { res } = await applyRoundTrip({
    connected: '0x1111111111111111111111111111111111111111'
  })
  assert.equal(res.status, 403)
})

test('application endpoint: credential bound to another nonce is rejected', async () => {
  resetApplicationLimit()
  resetUsedNonces()
  const { res } = await applyRoundTrip({ credentialNonce: () => 'other-nonce' })
  assert.equal(res.status, 401)
  assert.match((await res.json()).error, /nonce mismatch/i)
})

test('application endpoint: submit needs consent, and a nonce is single use', async () => {
  resetApplicationLimit()
  resetUsedNonces()
  const call = cookieJar()
  const start = await call('start', { wallet: TEST_WALLET, consent: true })
  const { message, nonce } = await start.json()
  await call('signature', { signature: personalSign(message) })
  const q = new URL((await (await call('present')).json()).authorizeUrl)
    .searchParams
  const fixture = await makeFixture({ aud: ORIGIN, nonce, shareKeys: true })
  await withIssuerFetch(fixture, () =>
    call('credential', { vp_token: fixture.vpToken, state: q.get('state') })
  )
  const status = await (await call('status', undefined, 'GET')).json()
  assert.equal(status.signer, TEST_WALLET)
  assert.ok(status.credential)

  assert.equal((await call('submit', { consent: false })).status, 400)

  // Keep the sealed state so it can be replayed after submit clears it.
  const saved = call.cookie()
  const realLog = console.log
  console.log = () => {}
  try {
    assert.equal((await call('submit', { consent: true })).status, 200)
    const again = await worker.fetch(
      new Request(`${ORIGIN}/api/provider-application/submit`, {
        method: 'POST',
        headers: { Cookie: saved },
        body: JSON.stringify({ consent: true })
      }),
      ENV
    )
    assert.equal(again.status, 409)
  } finally {
    console.log = realLog
  }
})

test('application endpoint: second application within the window is limited', async () => {
  resetApplicationLimit()
  resetUsedNonces()
  const realLog = console.log
  console.log = () => {}
  try {
    assert.equal((await applyRoundTrip()).res.status, 200)
    assert.equal((await applyRoundTrip()).res.status, 429)
  } finally {
    console.log = realLog
  }
})

test('removeFromRegistry deletes by wallet, case-insensitively', () => {
  const w = '0xedAa08237554bBafC218f0EaA86704e1aDe9262E'
  const reg = {
    issuer: 'x',
    updated: '',
    providers: {
      [w]: { name: 'A' },
      '0x1111111111111111111111111111111111111111': { name: 'B' }
    }
  }
  const out = removeFromRegistry(reg, w.toLowerCase())
  assert.equal(out.removed.wallet, w)
  assert.equal(out.removed.entry.name, 'A')
  assert.deepEqual(Object.keys(out.registry.providers), [
    '0x1111111111111111111111111111111111111111'
  ])
  assert.equal(
    removeFromRegistry(reg, '0x2222222222222222222222222222222222222222')
      .removed,
    undefined
  )
})
