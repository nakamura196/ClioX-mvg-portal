/**
 * State machine for a verified-provider application (plan B).
 *
 *   1. start       issue a nonce; the same nonce is the wallet-message nonce
 *                  and the OID4VP nonce, so both proofs belong to one application
 *   2. signature   recover the signer of the EIP-191 message (walletSignature.ts)
 *   3. credential  verify the id.ldas.jp presentation against the same nonce
 *   4. submit      check 2 and 3 share the nonce and consent was given, consume
 *                  the nonce, then seal and email the registry line
 *
 * The state lives in an HMAC-sealed, HttpOnly cookie (10 min) set by
 * worker/index.ts; nothing is persisted. Neither the signature nor the
 * credential is kept: the state records only the recovered address and the
 * registry entry derived from the credential.
 *
 * Pure functions (plus an isolate-local set of used nonces) so they can be
 * tested in Node.
 */

import type { RegistryEntry } from './providerApplication.ts'
import { buildApplyMessage, verifyPersonalSign } from './walletSignature.ts'

export const APPLY_STATE_TTL_SEC = 10 * 60

export interface ApplyState {
  v: 2
  nonce: string
  /** EIP-55 address the browser said was connected (a claim until signed) */
  address: string
  origin: string
  issuedAt: string
  consent: true
  /** Unix seconds */
  exp: number
  /** Address recovered from the wallet signature */
  signer?: string
  /** Nonce that was inside the signed message */
  signedNonce?: string
  /** OID4VP `state` of the id.ldas.jp request in progress */
  oid4vpState?: string
  /** Result of the verified credential (the credential itself is discarded) */
  credential?: { nonce: string; entry: RegistryEntry }
}

export class ApplicationError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

/** 128-bit random nonce, hex. */
export function newNonce(): string {
  const b = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
}

export function newApplyState(
  address: string,
  origin: string,
  now = Date.now()
): ApplyState {
  return {
    v: 2,
    nonce: newNonce(),
    address,
    origin,
    issuedAt: new Date(now).toISOString(),
    consent: true,
    exp: Math.floor(now / 1000) + APPLY_STATE_TTL_SEC
  }
}

export function messageFor(state: ApplyState): string {
  return buildApplyMessage({
    address: state.address,
    nonce: state.nonce,
    origin: state.origin,
    issuedAt: state.issuedAt
  })
}

export function assertLive(
  state: ApplyState | null,
  now = Date.now()
): ApplyState {
  if (!state || state.v !== 2 || state.exp < Math.floor(now / 1000)) {
    throw new ApplicationError(
      'Application session expired; please start again',
      400
    )
  }
  return state
}

/** Stage 2: the message is rebuilt from the sealed state, never taken from the request. */
export function withSignature(
  state: ApplyState,
  signature: string
): ApplyState {
  let signer: string
  try {
    signer = verifyPersonalSign(messageFor(state), signature, state.address)
  } catch (err) {
    throw new ApplicationError(
      err instanceof Error ? err.message : 'Invalid signature',
      403
    )
  }
  return { ...state, signer, signedNonce: state.nonce }
}

/** Stage 4 precondition. Returns the wallet (from the signature) and the entry. */
export function assertReady(
  state: ApplyState,
  consent: unknown
): { wallet: string; entry: RegistryEntry } {
  if (consent !== true || state.consent !== true) {
    throw new ApplicationError('Consent is required', 400)
  }
  if (!state.signer || state.signedNonce !== state.nonce) {
    throw new ApplicationError('Sign the application with your wallet first')
  }
  if (!state.credential) {
    throw new ApplicationError('Present your id.ldas.jp credential first')
  }
  if (state.credential.nonce !== state.nonce) {
    throw new ApplicationError(
      'The credential and the wallet signature belong to different applications',
      403
    )
  }
  return { wallet: state.signer, entry: state.credential.entry }
}

// ---------------------------------------------------------------------------
// Single use: a nonce can be submitted once. Kept in Worker memory (per
// isolate) until it would have expired anyway; the sealed cookie is also
// cleared on submit, and expires after APPLY_STATE_TTL_SEC.
// ---------------------------------------------------------------------------

const usedNonces = new Map<string, number>()

/** Returns true the first time a nonce is consumed, false on reuse. */
export function consumeNonce(
  nonce: string,
  exp: number,
  now = Date.now()
): boolean {
  const nowSec = Math.floor(now / 1000)
  for (const [k, e] of usedNonces) if (e < nowSec) usedNonces.delete(k)
  if (usedNonces.has(nonce)) return false
  usedNonces.set(nonce, exp)
  return true
}

export function resetUsedNonces(): void {
  usedNonces.clear()
}
