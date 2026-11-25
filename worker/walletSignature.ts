/**
 * Wallet-signature proof for provider applications (EIP-191 personal_sign).
 *
 * Connecting a wallet in the browser only tells the page an address; anyone
 * can claim any address. A personal_sign signature over a message that
 * carries a server-issued nonce lets the Worker recover the signer's address
 * itself, so the address in the registry is one the applicant controls.
 *
 * secp256k1 recovery and Keccak-256 come from @noble/curves / @noble/hashes
 * (audited, ~13 kB gzipped in the Worker bundle). No elliptic-curve code here.
 */

import { secp256k1 } from '@noble/curves/secp256k1'
import { keccak_256 as keccak256 } from '@noble/hashes/sha3'
import { toChecksumAddress } from './providerApplication.ts'

// The Worker recovers one signature per isolate at most a few times, so the
// default 8-bit precomputation table for the base point (built lazily on the
// first call) costs more than it saves. A 4-bit table cut the first recovery
// from ~15.6 ms to ~6 ms in Node 25 (later calls ~1.6 vs ~1.9 ms), which
// matters on the free plan's 10 ms CPU budget.
secp256k1.ProjectivePoint.BASE._setWindowSize(4)

export interface ApplyMessageFields {
  /** EIP-55 address the applicant says they will sign with */
  address: string
  /** Server-issued application nonce (also the OID4VP nonce) */
  nonce: string
  /** Origin of the portal, so a signature cannot be replayed on another site */
  origin: string
  /** ISO 8601 time the nonce was issued */
  issuedAt: string
}

/**
 * The exact text the wallet signs. Bilingual so it reads the same in either
 * locale; the Worker rebuilds it from its own sealed state, never from the
 * request body.
 */
export function buildApplyMessage(f: ApplyMessageFields): string {
  return [
    'Clio-X の認証済みプロバイダーに申し込みます。',
    'Apply to be a verified Clio-X provider.',
    '',
    '署名には費用がかからず、チェーンには何も書き込まれません。',
    'Signing costs nothing and writes nothing on chain.',
    '',
    `Address: ${f.address}`,
    `Nonce: ${f.nonce}`,
    `URI: ${f.origin}`,
    `Issued At: ${f.issuedAt}`
  ].join('\n')
}

/** EIP-191 version 0x45 hash: keccak256("\x19Ethereum Signed Message:\n" + len + message). */
export function hashPersonalMessage(message: string): Uint8Array {
  const body = new TextEncoder().encode(message)
  const prefix = new TextEncoder().encode(
    `\x19Ethereum Signed Message:\n${body.length}`
  )
  const buf = new Uint8Array(prefix.length + body.length)
  buf.set(prefix)
  buf.set(body, prefix.length)
  return keccak256(buf)
}

function toHex(bytes: Uint8Array): string {
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

/** Recovers the EIP-55 address that produced a 65-byte personal_sign signature. */
export function recoverPersonalSignAddress(
  message: string,
  signature: string
): string {
  if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) {
    throw new Error('Malformed signature')
  }
  const v = parseInt(signature.slice(130), 16)
  const recovery = v >= 27 ? v - 27 : v
  if (recovery !== 0 && recovery !== 1) {
    throw new Error('Malformed signature (recovery id)')
  }
  const sig = secp256k1.Signature.fromCompact(
    signature.slice(2, 130)
  ).addRecoveryBit(recovery)
  const pub = sig
    .recoverPublicKey(hashPersonalMessage(message))
    .toRawBytes(false)
  const addr = keccak256(pub.slice(1)).slice(-20)
  return toChecksumAddress(`0x${toHex(addr)}`)
}

/**
 * Throws unless `signature` over `message` was made by `expectedAddress`.
 * Returns the recovered EIP-55 address.
 */
export function verifyPersonalSign(
  message: string,
  signature: string,
  expectedAddress: string
): string {
  const signer = recoverPersonalSignAddress(message, signature)
  if (signer.toLowerCase() !== expectedAddress.toLowerCase()) {
    throw new Error('The signature was not made by the connected wallet')
  }
  return signer
}
