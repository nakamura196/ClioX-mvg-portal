import assert from 'node:assert/strict'
import { test } from 'node:test'
import { secp256k1 } from '@noble/curves/secp256k1'
import {
  buildApplyMessage,
  hashPersonalMessage,
  recoverPersonalSignAddress,
  verifyPersonalSign
} from './walletSignature.ts'
import {
  assertReady,
  consumeNonce,
  messageFor,
  newApplyState,
  resetUsedNonces,
  withSignature
} from './applicationFlow.ts'

// Known EIP-191 personal_sign vector (throwaway key, made outside this repo).
const VECTOR_MESSAGE = [
  'Clio-X の確認済み提供者に申し込みます。',
  'アドレス: 0x7E6064511C0CDD297a7ba54A7ad092251B0d5902',
  '番号: 7f2c91d4'
].join('\n')
const VECTOR_SIGNATURE =
  '0x802ecd485fa6d1816f5ca8cd450a2d23ace0183c344666cc52c77debf7a8921d7f77e59ff6812c206bcc1c5b5e8646b31f417fc5e3fc436249bb0a7bc95cb88d1c'
const VECTOR_SIGNER = '0x7E6064511C0CDD297a7ba54A7ad092251B0d5902'

// Throwaway keys for vectors generated in the test
const KEY_A = '4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318'
const KEY_B = '0123456789012345678901234567890123456789012345678901234567890123'

function personalSign(message, priv) {
  const sig = secp256k1.sign(hashPersonalMessage(message), priv)
  return '0x' + sig.toCompactHex() + (27 + sig.recovery).toString(16)
}

function addressOf(priv) {
  // Recover from a signature rather than re-implementing address derivation.
  return recoverPersonalSignAddress('x', personalSign('x', priv))
}

test('recovers the signer of a known personal_sign vector', () => {
  assert.equal(
    recoverPersonalSignAddress(VECTOR_MESSAGE, VECTOR_SIGNATURE),
    VECTOR_SIGNER
  )
  assert.equal(
    verifyPersonalSign(
      VECTOR_MESSAGE,
      VECTOR_SIGNATURE,
      VECTOR_SIGNER.toLowerCase()
    ),
    VECTOR_SIGNER
  )
})

test('one changed character in the nonce recovers a different address', () => {
  const tampered = VECTOR_MESSAGE.replace('7f2c91d4', '7f2c91d5')
  assert.equal(
    recoverPersonalSignAddress(tampered, VECTOR_SIGNATURE),
    '0x5F28240915886146047Df131EDB34ed147049053'
  )
  assert.throws(
    () => verifyPersonalSign(tampered, VECTOR_SIGNATURE, VECTOR_SIGNER),
    /not made by the connected wallet/
  )
})

test('wrong signer and malformed signatures are rejected', () => {
  const message = buildApplyMessage({
    address: addressOf(KEY_A),
    nonce: 'n1',
    origin: 'https://cliox.ldas.jp',
    issuedAt: '2026-11-25T00:00:00.000Z'
  })
  const good = personalSign(message, KEY_A)
  assert.equal(
    verifyPersonalSign(message, good, addressOf(KEY_A)),
    addressOf(KEY_A)
  )
  assert.throws(
    () =>
      verifyPersonalSign(
        message,
        personalSign(message, KEY_B),
        addressOf(KEY_A)
      ),
    /not made by the connected wallet/
  )
  assert.throws(
    () => recoverPersonalSignAddress(message, '0x1234'),
    /Malformed/
  )
  assert.throws(
    () => recoverPersonalSignAddress(message, good.slice(0, -2) + '1f'),
    /recovery id/
  )
})

test('stage 2 accepts only the wallet named in the message', () => {
  const state = newApplyState(addressOf(KEY_A), 'https://cliox.ldas.jp')
  const signed = withSignature(state, personalSign(messageFor(state), KEY_A))
  assert.equal(signed.signer, addressOf(KEY_A))
  assert.equal(signed.signedNonce, state.nonce)
  assert.throws(
    () => withSignature(state, personalSign(messageFor(state), KEY_B)),
    (err) => err.status === 403
  )
  // A signature over another application's message does not carry over.
  const other = newApplyState(addressOf(KEY_A), 'https://cliox.ldas.jp')
  assert.notEqual(other.nonce, state.nonce)
  assert.throws(
    () => withSignature(other, personalSign(messageFor(state), KEY_A)),
    (err) => err.status === 403
  )
})

test('stage 4: credential nonce must equal the wallet-message nonce', () => {
  const state = newApplyState(addressOf(KEY_A), 'https://cliox.ldas.jp')
  const signed = withSignature(state, personalSign(messageFor(state), KEY_A))
  const entry = {
    name: 'A',
    method: ['orcid'],
    selfDeclaredName: true,
    verifiedAt: '2026-11-25T00:00:00.000Z'
  }
  const ready = assertReady(
    { ...signed, credential: { nonce: state.nonce, entry } },
    true
  )
  assert.equal(ready.wallet, addressOf(KEY_A))
  assert.throws(
    () =>
      assertReady({ ...signed, credential: { nonce: 'other', entry } }, true),
    /different applications/
  )
  assert.throws(() => assertReady(signed, true), /credential first/)
  assert.throws(
    () =>
      assertReady(
        { ...state, credential: { nonce: state.nonce, entry } },
        true
      ),
    /Sign the application/
  )
  assert.throws(
    () =>
      assertReady(
        { ...signed, credential: { nonce: state.nonce, entry } },
        false
      ),
    /Consent/
  )
})

test('a nonce can be consumed once', () => {
  resetUsedNonces()
  const exp = Math.floor(Date.now() / 1000) + 600
  assert.equal(consumeNonce('abc', exp), true)
  assert.equal(consumeNonce('abc', exp), false)
  assert.equal(consumeNonce('abd', exp), true)
})
