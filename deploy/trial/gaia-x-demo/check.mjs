import { createHash, createPublicKey, verify } from 'node:crypto'
import { readFileSync } from 'node:fs'
import jsonld from 'jsonld'
const [vpPath, didPath] = process.argv.slice(2)
const vp = JSON.parse(readFileSync(vpPath))
const doc = JSON.parse(readFileSync(didPath))
const pub = createPublicKey({
  key: doc.verificationMethod[0].publicKeyJwk,
  format: 'jwk'
})
for (const vc of vp.verifiableCredential) {
  const { proof, ...body } = vc
  const canon = await jsonld.canonize(body, {
    algorithm: 'URDNA2015',
    format: 'application/n-quads',
    safe: false
  })
  const hash = createHash('sha256').update(canon).digest('hex')
  const [h, , s] = proof.jws.split('.')
  const ok = verify(
    'sha256',
    Buffer.from(`${h}.${hash}`),
    { key: pub, padding: 6, saltLength: 32 },
    Buffer.from(s, 'base64url')
  )
  console.log(
    vc.credentialSubject.type,
    ok,
    canon.split('\n').length - 1,
    'quads'
  )
}
