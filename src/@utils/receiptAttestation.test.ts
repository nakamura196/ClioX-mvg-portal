import { readFileSync } from 'fs'
import { join } from 'path'
import { inflateSync } from 'zlib'
import { ethers, utils } from 'ethers'
import { canonicalJson } from './canonicalJson'
import {
  EAS_SCHEMA,
  compactOffchainPackage,
  decodeAttestationData,
  encodeAttestationData,
  offchainUid,
  receiptSha256,
  schemaUid,
  signReceipt,
  verifySignedReceipt,
  AttestationMessage,
  OffchainPackage
} from './receiptAttestation'
import {
  buildSourceData,
  buildTransactionReceipt,
  computeSingleInterval,
  sourceSha256,
  TransactionInput
} from './transactionFootprint'
import vector from './__fixtures__/eas-offchain-vector.json'

// 公開のテスト用ニーモニック(Hardhat / anvil の既定)。本物の資産は入らない。
const TEST_MNEMONIC =
  'test test test test test test test test test test test junk'
const attester = ethers.Wallet.fromMnemonic(TEST_MNEMONIC)
const requester = ethers.Wallet.fromMnemonic(TEST_MNEMONIC, "m/44'/60'/0'/0/1")

const worked: TransactionInput = {
  intervals: [{ powerKW: 4, hours: 0.025, share: 0.25 }],
  allocation: 'reserved-share',
  powerQuality: 'provider-reported',
  pue: 1,
  pueQuality: 'provider-reported',
  water: {
    kind: 'flow',
    lPerHour: 12,
    quality: 'provider-reported',
    definition: 'consumption',
    scope: 'on-site'
  }
}
const params = {
  transactionId: 'tx-1',
  provider: 'Demo',
  location: { name: 'Nowhere', jurisdiction: 'XX' },
  startedAtTime: '2026-10-09T09:00:00Z',
  endedAtTime: '2026-10-09T09:01:30Z',
  input: worked
}
const mkReceipt = (input = worked) =>
  buildTransactionReceipt({
    ...params,
    input,
    footprint: computeSingleInterval(input.intervals[0], input)
  })

describe('canonicalJson (RFC 8785)', () => {
  it('sorts keys, no whitespace', () => {
    expect(
      canonicalJson({ b: 1, a: [true, null, 'x'], c: { z: 1, y: 2 } })
    ).toBe('{"a":[true,null,"x"],"b":1,"c":{"y":2,"z":1}}')
  })
  it('drops undefined keys, nulls undefined array items', () => {
    expect(canonicalJson({ a: undefined, b: [undefined, 1] })).toBe(
      '{"b":[null,1]}'
    )
  })
  it('numbers follow ECMAScript (RFC 8785 examples)', () => {
    expect(
      canonicalJson([1e21, 0.000001, 1e-7, 4.5, -0, 333333333.3333333])
    ).toBe('[1e+21,0.000001,1e-7,4.5,0,333333333.3333333]')
  })
  it('rejects NaN and Infinity', () => {
    expect(() => canonicalJson({ a: NaN })).toThrow()
    expect(() => canonicalJson([Infinity])).toThrow()
  })
  it('sorts keys by UTF-16 code units', () => {
    expect(canonicalJson({ é: 1, z: 2, '😀': 3 })).toBe('{"z":2,"é":1,"😀":3}')
  })
})

describe('source hash', () => {
  const src = buildSourceData(params)
  it('is stable for the worked example (pinned value)', () => {
    expect(sourceSha256(src)).toBe(
      '4eeceaab37cbd5a065a27e4b9bf0d791ef2056fa98ea7a0ae9ae2ae61d5d598b'
    )
  })
  it('does not depend on key order', () => {
    const reordered = JSON.parse(
      JSON.stringify({
        input: {
          water: worked.water,
          pue: 1,
          intervals: worked.intervals,
          powerQuality: 'provider-reported',
          pueQuality: 'provider-reported',
          allocation: 'reserved-share'
        },
        location: { jurisdiction: 'XX', name: 'Nowhere' },
        provider: 'Demo',
        transactionId: 'tx-1',
        endedAtTime: params.endedAtTime,
        startedAtTime: params.startedAtTime,
        schema: src.schema
      })
    )
    expect(sourceSha256(reordered)).toBe(sourceSha256(src))
  })
  it('changes when any input changes', () => {
    const base = sourceSha256(src)
    const variants: TransactionInput[] = [
      { ...worked, pue: 1.01 },
      { ...worked, intervals: [{ ...worked.intervals[0], share: 0.26 }] },
      { ...worked, intervals: [{ ...worked.intervals[0], powerKW: 4.1 }] },
      { ...worked, intervals: [{ ...worked.intervals[0], hours: 0.026 }] },
      {
        ...worked,
        water: { ...(worked.water as object), lPerHour: 13 } as never
      },
      {
        ...worked,
        grid: { gCO2ePerKWh: 400, label: 'x', asOf: 'a', source: 's' } as never
      }
    ]
    for (const input of variants) {
      expect(sourceSha256(buildSourceData({ ...params, input }))).not.toBe(base)
    }
    expect(
      sourceSha256(buildSourceData({ ...params, provider: 'Other' }))
    ).not.toBe(base)
    expect(
      sourceSha256(
        buildSourceData({
          ...params,
          location: { name: 'Nowhere', jurisdiction: 'YY' }
        })
      )
    ).not.toBe(base)
  })
  it('is carried by the receipt and survives a JSON round trip', () => {
    const r = mkReceipt()
    expect(r.source.sha256).toBe(sourceSha256(src))
    expect(r.source.canonicalization).toBe('RFC 8785 (JCS)')
    expect(receiptSha256(JSON.parse(JSON.stringify(r)))).toBe(receiptSha256(r))
  })
})

describe('EAS off-chain attestation: schema', () => {
  it('schema UID = keccak256(abi.encodePacked(schema, resolver 0, revocable))', () => {
    expect(schemaUid()).toBe(vector.schemaUid)
    expect(schemaUid(EAS_SCHEMA, ethers.constants.AddressZero, true)).toBe(
      utils.keccak256(
        utils.concat([
          utils.toUtf8Bytes(EAS_SCHEMA),
          ethers.constants.AddressZero,
          '0x01'
        ])
      )
    )
    expect(schemaUid(EAS_SCHEMA, ethers.constants.AddressZero, false)).not.toBe(
      schemaUid()
    )
  })
})

describe('cross-check with @ethereum-attestation-service/eas-sdk 2.10.0 (ethers v6)', () => {
  // vector は scratchpad の eas-check/gen.js (eas-sdk + ethers v6) が作った。
  const sdk = vector.sig as unknown as OffchainPackage['sig']
  const message = sdk.message as AttestationMessage

  it('same attester and recipient from the public test mnemonic', () => {
    expect(attester.address).toBe(vector.signer)
    expect(requester.address).toBe(vector.recipient)
  })
  it('same attestation data encoding', () => {
    expect(
      encodeAttestationData(
        vector.receiptSha,
        vector.sourceSha,
        'clio-x-transaction-allocation/0.1'
      )
    ).toBe(message.data)
    expect(decodeAttestationData(message.data).method).toBe(
      'clio-x-transaction-allocation/0.1'
    )
  })
  it('same off-chain UID', () => {
    expect(offchainUid(message)).toBe(sdk.uid)
  })
  it('same signature (byte for byte)', async () => {
    const raw = await attester._signTypedData(sdk.domain, sdk.types, message)
    const { v, r, s } = utils.splitSignature(raw)
    expect({ v, r, s }).toEqual(sdk.signature)
  })
  it('our verifier recovers the sdk signer from the sdk signature', () => {
    const rec = utils.verifyTypedData(
      sdk.domain,
      sdk.types,
      message,
      sdk.signature
    )
    expect(rec).toBe(vector.signer)
  })
  it('compact package equals the one the sdk puts in the easscan URL', () => {
    const token = decodeURIComponent(vector.url.split('#attestation=')[1])
    const sdkCompact = JSON.parse(
      inflateSync(Buffer.from(token, 'base64')).toString()
    )
    expect(compactOffchainPackage({ sig: sdk, signer: vector.signer })).toEqual(
      sdkCompact
    )
  })
})

describe('signReceipt / verifySignedReceipt', () => {
  const sign = (receipt = mkReceipt()) =>
    signReceipt({
      receipt,
      recipient: requester.address,
      signer: attester,
      time: 1791540000,
      salt: `0x${'22'.repeat(32)}`
    })

  it('signs and verifies without a wallet', async () => {
    const signed = await sign()
    const v = verifySignedReceipt(JSON.parse(JSON.stringify(signed)))
    expect(v.ok).toBe(true)
    expect(v.attester).toBe(attester.address)
    expect(v.recipient).toBe(requester.address)
    expect(v.time).toBe(1791540000)
    expect(v.sourceSha256).toBe(`0x${signed.receipt.source.sha256}`)
  })
  it('is deterministic for fixed time and salt', async () => {
    const a = await sign()
    const b = await sign()
    expect(a.attestation.package.sig.signature).toEqual(
      b.attestation.package.sig.signature
    )
  })
  it('re-formatting the receipt file does not break the signature', async () => {
    const signed = await sign()
    const again = JSON.parse(JSON.stringify(signed, null, 4))
    expect(verifySignedReceipt(again).ok).toBe(true)
  })
  it('detects an altered receipt value', async () => {
    const signed = JSON.parse(JSON.stringify(await sign()))
    signed.receipt.values.water.value = 0.001
    const v = verifySignedReceipt(signed)
    expect(v.ok).toBe(false)
    expect(v.checks.receiptHashMatches).toBe(false)
    expect(v.checks.signatureMatches).toBe(true)
  })
  it('detects a replaced source hash', async () => {
    const signed = JSON.parse(JSON.stringify(await sign()))
    signed.receipt.source.sha256 = '00'.repeat(32)
    const v = verifySignedReceipt(signed)
    expect(v.ok).toBe(false)
    expect(v.checks.sourceHashMatches).toBe(false)
  })
  it('detects a different signer', async () => {
    const signed = JSON.parse(JSON.stringify(await sign()))
    signed.attestation.package.signer = requester.address
    const v = verifySignedReceipt(signed)
    expect(v.ok).toBe(false)
    expect(v.checks.signatureMatches).toBe(false)
  })
  it('detects a changed recipient (uid and signature break)', async () => {
    const signed = JSON.parse(JSON.stringify(await sign()))
    signed.attestation.package.sig.message.recipient = attester.address
    const v = verifySignedReceipt(signed)
    expect(v.ok).toBe(false)
    expect(v.checks.uidMatches).toBe(false)
  })
  it('rejects an invalid recipient address', async () => {
    await expect(
      signReceipt({
        receipt: mkReceipt(),
        recipient: '0x123',
        signer: attester
      })
    ).rejects.toThrow(/recipient/)
  })
  it('returns a reason for a file that is not a signed receipt', () => {
    const v = verifySignedReceipt({ hello: 1 })
    expect(v.ok).toBe(false)
    expect(v.reason).toMatch(/not a signed receipt/)
  })
})

describe('committed samples', () => {
  const dir = join(
    __dirname,
    '..',
    '..',
    'docs',
    'prototypes',
    'sustainability-exp'
  )
  const read = (f: string) => JSON.parse(readFileSync(join(dir, f), 'utf8')) // eslint-disable-line security/detect-non-literal-fs-filename
  it('sample-signed-receipt.json verifies, and is signed by the public test key', () => {
    const v = verifySignedReceipt(read('sample-signed-receipt.json'))
    expect(v.ok).toBe(true)
    expect(v.attester).toBe(attester.address)
  })
  it('sample-source.json hashes to the source.sha256 in sample-receipt.json', () => {
    expect(sourceSha256(read('sample-source.json'))).toBe(
      read('sample-receipt.json').source.sha256
    )
  })
})
