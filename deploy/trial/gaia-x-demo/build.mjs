// Build a DEMO Gaia-X credential (Trust Framework 22.10 shape) for one asset
// on the Clio-X Sepolia trial, signed with a self-made key under did:web:cliox.ldas.jp.
//
// It is deliberately NOT compliant: the key's certificate is self-signed (no
// eIDAS / EV trust anchor) and there is no legal-registration-number credential
// from a Gaia-X notary. The compliance service is expected to reject it; the
// point is to show what the portal's Verify page does with a real-shaped file.
//
// Usage:
//   GX_DEMO_KEY=<PKCS#8 PEM> GX_DEMO_CERT=<PEM> node build.mjs <did:op:…> <name> <outDir>
// Writes <outDir>/did.json, <outDir>/gaia-x-demo/certificate-chain.crt and
// <outDir>/gaia-x-demo/<name>.vp.json (outDir = the portal's public/.well-known).
// <name> must match serviceSD.url in the asset's metadata.
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign
} from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import jsonld from 'jsonld'

const [did, name, outDir] = process.argv.slice(2)
if (
  !/^did:op:[0-9a-f]{64}$/.test(did || '') ||
  !/^[a-z0-9-]+$/.test(name || '') ||
  !outDir
) {
  console.error('usage: node build.mjs <did:op:…> <name> <outDir>')
  process.exit(1)
}
const pem = process.env.GX_DEMO_KEY
const certPem = process.env.GX_DEMO_CERT
if (!pem || !certPem)
  throw new Error('GX_DEMO_KEY and GX_DEMO_CERT are required')

const HOST = 'cliox.ldas.jp'
const ISSUER = `did:web:${HOST}`
const VM = `${ISSUER}#X509-JWK2020`
const BASE = `https://${HOST}/.well-known/gaia-x-demo`
const vpUrl = `${BASE}/${name}.vp.json`
const participantId = `https://${HOST}/.well-known/gaia-x-demo/participant`
const now = new Date().toISOString()
const TF =
  'https://registry.lab.gaia-x.eu/development/api/trusted-shape-registry/v1/shapes/jsonld/trustframework#'
const CTX = [
  'https://www.w3.org/2018/credentials/v1',
  'https://w3id.org/security/suites/jws-2020/v1',
  TF
]
const NOTE =
  "DEMONSTRATION ONLY. Made for the Clio-X Sepolia trial to show the portal's Verify page. " +
  'Not issued by a legal entity, signed with a self-signed certificate, and not Gaia-X compliant.'

const key = createPrivateKey(pem)

// JsonWebSignature2020 as the Gaia-X signing tools do it: URDNA2015 → SHA-256
// (hex string) → detached JWS, PS256, b64=false.
async function signCredential(vc) {
  const canon = await jsonld.canonize(vc, {
    algorithm: 'URDNA2015',
    format: 'application/n-quads',
    safe: false
  })
  const hash = createHash('sha256').update(canon).digest('hex')
  const header = Buffer.from(
    JSON.stringify({ alg: 'PS256', b64: false, crit: ['b64'] })
  ).toString('base64url')
  const sig = sign('sha256', Buffer.from(`${header}.${hash}`), {
    key,
    padding: 6, // RSA_PKCS1_PSS_PADDING
    saltLength: 32
  }).toString('base64url')
  return {
    ...vc,
    proof: {
      type: 'JsonWebSignature2020',
      created: now,
      proofPurpose: 'assertionMethod',
      verificationMethod: VM,
      jws: `${header}..${sig}`
    }
  }
}

const participant = {
  '@context': CTX,
  id: `${vpUrl}#participant`,
  type: 'VerifiableCredential',
  issuer: ISSUER,
  issuanceDate: now,
  credentialSubject: {
    id: participantId,
    type: 'gx:LegalParticipant',
    'gx:legalName': 'Clio-X Sepolia trial (DEMO - not a legal entity)',
    'gx:description': NOTE,
    'gx:legalRegistrationNumber': { id: `${participantId}#lrn` },
    'gx:headquarterAddress': { 'gx:countrySubdivisionCode': 'JP-13' },
    'gx:legalAddress': { 'gx:countrySubdivisionCode': 'JP-13' }
  }
}

const terms = {
  '@context': CTX,
  id: `${vpUrl}#tandc`,
  type: 'VerifiableCredential',
  issuer: ISSUER,
  issuanceDate: now,
  credentialSubject: {
    id: `${participantId}#tandc`,
    type: 'gx:GaiaXTermsAndConditions',
    'gx:termsAndConditions':
      'The PARTICIPANT signing the Self-Description agrees as follows:\n- to update its descriptions about any changes, be it technical, organizational, or legal - especially but not limited to contractual in regards to the indicated attributes present in the descriptions.\n\nThe keypair used to sign Verifiable Credentials will be revoked where Gaia-X Association becomes aware of any inaccurate statements in regards to the claims which result in a non-compliance with the Trust Framework and policy rules defined in the Policy Rules and Labelling Document (PRLD).'
  }
}

const trialTerms = 'https://cliox-docs.ldas.jp/developers/verify'
const service = {
  '@context': CTX,
  id: `${vpUrl}#service`,
  type: 'VerifiableCredential',
  issuer: ISSUER,
  issuanceDate: now,
  credentialSubject: {
    id: did,
    type: 'gx:ServiceOffering',
    'gx:providedBy': { id: participantId },
    'gx:description': NOTE,
    'gx:policy': [''],
    'gx:termsAndConditions': {
      'gx:URL': trialTerms,
      'gx:hash': createHash('sha256').update(trialTerms).digest('hex')
    },
    'gx:dataAccountExport': {
      'gx:requestType': 'email',
      'gx:accessType': 'digital',
      'gx:formatType': 'application/json'
    }
  }
}

const vp = {
  '@context': 'https://www.w3.org/2018/credentials/v1',
  type: 'VerifiablePresentation',
  verifiableCredential: [
    await signCredential(participant),
    await signCredential(terms),
    await signCredential(service)
  ]
}

const jwk = createPublicKey(key).export({ format: 'jwk' })
const didDoc = {
  '@context': [
    'https://www.w3.org/ns/did/v1',
    'https://w3id.org/security/suites/jws-2020/v1'
  ],
  id: ISSUER,
  verificationMethod: [
    {
      '@context': 'https://w3c-ccg.github.io/lds-jws2020/contexts/v1/',
      id: VM,
      type: 'JsonWebKey2020',
      controller: ISSUER,
      publicKeyJwk: {
        kty: jwk.kty,
        n: jwk.n,
        e: jwk.e,
        alg: 'PS256',
        x5u: `${BASE}/certificate-chain.crt`
      }
    }
  ],
  assertionMethod: [VM]
}

mkdirSync(join(outDir, 'gaia-x-demo'), { recursive: true })
writeFileSync(join(outDir, 'did.json'), JSON.stringify(didDoc, null, 2) + '\n')
writeFileSync(
  join(outDir, 'gaia-x-demo', 'certificate-chain.crt'),
  certPem.trim() + '\n'
)
writeFileSync(
  join(outDir, 'gaia-x-demo', `${name}.vp.json`),
  JSON.stringify(vp, null, 2) + '\n'
)
console.log(vpUrl)
