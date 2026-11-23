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

async function makeFixture({ revoked = false, aud = 'https://cliox.ldas.jp', nonce = 'n-123' } = {}) {
  const issuerKeys = await crypto.subtle.generateKey(
    { name: 'Ed25519' },
    true,
    ['sign', 'verify']
  )
  const issuerPubJwk = await crypto.subtle.exportKey('jwk', issuerKeys.publicKey)

  const holderKeys = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  )
  const holderPubJwk = await crypto.subtle.exportKey('jwk', holderKeys.publicKey)
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
  ].map((arr) =>
    bytesToB64url(new TextEncoder().encode(JSON.stringify(arr)))
  )
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
    new TextEncoder().encode(
      JSON.stringify({ iat: now, aud, nonce, sd_hash })
    )
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

  return { vpToken, mockFetch }
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
