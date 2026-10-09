/**
 * 受領証への署名: EAS (Ethereum Attestation Service) の off-chain attestation。
 *
 * ブロックチェーンには何も書かない(ガス代なし)。署名は EIP-712 の型付きデータで、
 * ethers v5 の utils だけで作り、確かめる(ウォレット不要で検証できる)。
 * 型定義・UID の計算は eas-sdk 2.10.0 の Offchain(Version2)と同じ。
 * eas-sdk(ethers v6 が必要)とのバイト単位の一致は receiptAttestation.test.ts の固定ベクターで確認する。
 *
 * 署名するスキーマ(EAS の schema 文字列):
 *   bytes32 receiptSha256,bytes32 sourceSha256,string method
 * 文書そのものではなく 2 つのハッシュと方法の識別子だけを載せる。
 *   - 受領証の本文を載せない: 数値の内訳やメモは受領証側にあり、公開せずに済む
 *   - 入力一式のハッシュ(sourceSha256)も載せる: 受領証を作り直しても、元データとの結びつきが署名に残る
 *   - method を載せる: どの会計方法の版で出したかが署名に含まれる
 * このスキーマは、まだどのチェーンにも登録していない(Sepolia への登録は利用者の作業)。
 * off-chain attestation は登録なしでも署名・検証できるが、easscan で
 * スキーマ名を表示するには登録が要る。
 */
import { BigNumber, ethers, utils } from 'ethers'
import { canonicalSha256 } from './canonicalJson'
import type { TransactionReceipt } from './transactionFootprint'

export const EAS_SCHEMA =
  'bytes32 receiptSha256,bytes32 sourceSha256,string method'
export const EAS_SCHEMA_REVOCABLE = true
export const EAS_NETWORK = {
  name: 'sepolia',
  chainId: 11155111,
  /** EAS コントラクト (VERSION() が "0.26" を返すことを 2026-10-09 に Sepolia で確認) */
  address: '0xC2679fBD37d54388Ce493F1DB75320D236e1815e',
  version: '0.26'
} as const
/** off-chain attestation の版。eas-sdk の OffchainAttestationVersion.Version2 (salt あり) */
export const OFFCHAIN_VERSION = 2
export const ATTEST_DOMAIN_NAME = 'EAS Attestation'
export const ZERO_BYTES32 = `0x${'00'.repeat(32)}`

export const OFFCHAIN_TYPES = {
  Attest: [
    { name: 'version', type: 'uint16' },
    { name: 'schema', type: 'bytes32' },
    { name: 'recipient', type: 'address' },
    { name: 'time', type: 'uint64' },
    { name: 'expirationTime', type: 'uint64' },
    { name: 'revocable', type: 'bool' },
    { name: 'refUID', type: 'bytes32' },
    { name: 'data', type: 'bytes' },
    { name: 'salt', type: 'bytes32' }
  ]
}

/** keccak256(abi.encodePacked(schema, resolver, revocable)) */
export function schemaUid(
  schema: string = EAS_SCHEMA,
  resolver: string = ethers.constants.AddressZero,
  revocable: boolean = EAS_SCHEMA_REVOCABLE
): string {
  return utils.solidityKeccak256(
    ['string', 'address', 'bool'],
    [schema, resolver, revocable]
  )
}

export interface AttestationMessage {
  version: number
  schema: string
  recipient: string
  time: string
  expirationTime: string
  revocable: boolean
  refUID: string
  data: string
  salt: string
}

export interface OffchainDomain {
  name: string
  version: string
  chainId: string
  verifyingContract: string
}

/** eas-sdk の SignedOffchainAttestation と同じ形(bigint は文字列にしてある) */
export interface SignedOffchainAttestation {
  version: number
  uid: string
  domain: OffchainDomain
  primaryType: 'Attest'
  types: typeof OFFCHAIN_TYPES
  message: AttestationMessage
  signature: { v: number; r: string; s: string }
}

/** easscan に読ませられる単位(attester のアドレスと署名) */
export interface OffchainPackage {
  sig: SignedOffchainAttestation
  signer: string
}

export interface SignedReceipt {
  schema: 'clio-x-signed-receipt/0.1'
  /** 署名に使った鍵が公開のテスト鍵なら、その旨 */
  testKeyNotice?: string
  receipt: TransactionReceipt
  attestation: {
    easSchema: string
    easSchemaUid: string
    network: { chainId: number; easContract: string; easVersion: string }
    package: OffchainPackage
  }
}

/** 受領証の SHA-256(0x 付き)。正規化した JSON を対象にするので、整形や改行に左右されない */
export const receiptSha256 = (receipt: unknown): string =>
  canonicalSha256(receipt)

export function encodeAttestationData(
  receiptHash: string,
  sourceHash: string,
  method: string
): string {
  return utils.defaultAbiCoder.encode(
    ['bytes32', 'bytes32', 'string'],
    [receiptHash, sourceHash, method]
  )
}

export function decodeAttestationData(data: string): {
  receiptSha256: string
  sourceSha256: string
  method: string
} {
  const [r, s, m] = utils.defaultAbiCoder.decode(
    ['bytes32', 'bytes32', 'string'],
    data
  )
  return { receiptSha256: r, sourceSha256: s, method: m }
}

export function offchainUid(m: AttestationMessage): string {
  return utils.solidityKeccak256(
    [
      'uint16',
      'bytes',
      'address',
      'address',
      'uint64',
      'uint64',
      'bool',
      'bytes32',
      'bytes',
      'bytes32',
      'uint32'
    ],
    [
      m.version,
      utils.hexlify(utils.toUtf8Bytes(m.schema)),
      m.recipient,
      ethers.constants.AddressZero,
      m.time,
      m.expirationTime,
      m.revocable,
      m.refUID,
      m.data,
      m.salt,
      0
    ]
  )
}

export interface SignParams {
  receipt: TransactionReceipt
  /** 受領証を返す相手(ジョブを依頼した人)のウォレットアドレス */
  recipient: string
  /** 署名する人(事業者)。ethers v5 の Signer(wagmi の signer でよい) */
  signer: ethers.Signer
  /** 署名時刻(秒)。省略時は現在 */
  time?: number
  /** 32 バイトの乱数。省略時は乱数 */
  salt?: string
  /** 署名に使った鍵が公開のテスト鍵なら注記を入れる */
  testKeyNotice?: string
}

export function attestationDomain(): OffchainDomain {
  return {
    name: ATTEST_DOMAIN_NAME,
    version: EAS_NETWORK.version,
    chainId: String(EAS_NETWORK.chainId),
    verifyingContract: EAS_NETWORK.address
  }
}

/** 受領証に EAS off-chain attestation の署名を付ける。ネットワークには何も送らない */
export async function signReceipt(p: SignParams): Promise<SignedReceipt> {
  if (!utils.isAddress(p.recipient)) {
    throw new Error('recipient is not a valid address')
  }
  const recipient = utils.getAddress(p.recipient)
  const uid = schemaUid()
  const message: AttestationMessage = {
    version: OFFCHAIN_VERSION,
    schema: uid,
    recipient,
    time: String(p.time ?? Math.floor(Date.now() / 1000)),
    expirationTime: '0',
    revocable: EAS_SCHEMA_REVOCABLE,
    refUID: ZERO_BYTES32,
    data: encodeAttestationData(
      receiptSha256(p.receipt),
      `0x${p.receipt.source.sha256}`,
      p.receipt.allocation.method
    ),
    salt: p.salt ?? utils.hexlify(utils.randomBytes(32))
  }
  const domain = attestationDomain()
  const raw = await (
    p.signer as unknown as {
      _signTypedData: (d: unknown, t: unknown, v: unknown) => Promise<string>
    }
  )._signTypedData(domain, OFFCHAIN_TYPES, message)
  const { v, r, s } = utils.splitSignature(raw)
  const signerAddress = await p.signer.getAddress()
  return {
    schema: 'clio-x-signed-receipt/0.1',
    ...(p.testKeyNotice ? { testKeyNotice: p.testKeyNotice } : {}),
    receipt: p.receipt,
    attestation: {
      easSchema: EAS_SCHEMA,
      easSchemaUid: uid,
      network: {
        chainId: EAS_NETWORK.chainId,
        easContract: EAS_NETWORK.address,
        easVersion: EAS_NETWORK.version
      },
      package: {
        signer: signerAddress,
        sig: {
          version: OFFCHAIN_VERSION,
          uid: offchainUid(message),
          domain,
          primaryType: 'Attest',
          types: OFFCHAIN_TYPES,
          message,
          signature: { v, r, s }
        }
      }
    }
  }
}

export interface VerifyResult {
  /** すべての検査が通った */
  ok: boolean
  checks: {
    /** 受領証の形(署名つき受領証として読めるか) */
    wellFormed: boolean
    /** 受領証を正規化して取った SHA-256 が、署名された値と等しい */
    receiptHashMatches: boolean
    /** 受領証の source.sha256 が、署名された値と等しい */
    sourceHashMatches: boolean
    /** 署名された method が、受領証の method と等しい */
    methodMatches: boolean
    /** スキーマが想定どおり(schema 文字列から UID を再計算して一致) */
    schemaMatches: boolean
    /** attestation の UID が内容から再計算した値と等しい */
    uidMatches: boolean
    /** 署名から復元したアドレスが、署名者として書かれたアドレスと等しい */
    signatureMatches: boolean
    /** ドメインが Sepolia の EAS 0.26 */
    networkMatches: boolean
  }
  attester?: string
  recipient?: string
  time?: number
  receiptSha256?: string
  sourceSha256?: string
  method?: string
  reason?: string
}

/** 署名つき受領証を、ウォレットなしで確かめる。例外は投げず、結果に理由を入れる */
export function verifySignedReceipt(file: unknown): VerifyResult {
  const checks: VerifyResult['checks'] = {
    wellFormed: false,
    receiptHashMatches: false,
    sourceHashMatches: false,
    methodMatches: false,
    schemaMatches: false,
    uidMatches: false,
    signatureMatches: false,
    networkMatches: false
  }
  const fail = (reason: string): VerifyResult => ({
    ok: false,
    checks,
    reason
  })
  try {
    const f = file as SignedReceipt
    const pkg = f?.attestation?.package
    const sig = pkg?.sig
    if (
      f?.schema !== 'clio-x-signed-receipt/0.1' ||
      !f.receipt ||
      !sig?.message ||
      !sig.signature ||
      !pkg.signer
    ) {
      return fail('This is not a signed receipt file.')
    }
    checks.wellFormed = true
    const m = sig.message
    const decoded = decodeAttestationData(m.data)
    const hash = receiptSha256(f.receipt)
    checks.receiptHashMatches = decoded.receiptSha256 === hash
    checks.sourceHashMatches =
      decoded.sourceSha256 === `0x${f.receipt.source?.sha256}`
    checks.methodMatches = decoded.method === f.receipt.allocation?.method
    checks.schemaMatches =
      m.schema === schemaUid() && f.attestation.easSchema === EAS_SCHEMA
    checks.uidMatches = offchainUid(m) === sig.uid
    // 型定義と署名の対象は、ファイルの中身ではなくこのコードの定義を使う
    const domain = {
      name: ATTEST_DOMAIN_NAME,
      version: sig.domain.version,
      chainId: sig.domain.chainId,
      verifyingContract: sig.domain.verifyingContract
    }
    const recovered = utils.verifyTypedData(domain, OFFCHAIN_TYPES, m, {
      v: sig.signature.v,
      r: sig.signature.r,
      s: sig.signature.s
    })
    checks.signatureMatches =
      utils.getAddress(recovered) === utils.getAddress(pkg.signer)
    checks.networkMatches =
      sig.domain.version === EAS_NETWORK.version &&
      BigNumber.from(sig.domain.chainId).eq(EAS_NETWORK.chainId) &&
      utils.getAddress(sig.domain.verifyingContract) ===
        utils.getAddress(EAS_NETWORK.address)
    return {
      ok: Object.values(checks).every(Boolean),
      checks,
      attester: utils.getAddress(recovered),
      recipient: utils.getAddress(m.recipient),
      time: Number(m.time),
      receiptSha256: decoded.receiptSha256,
      sourceSha256: decoded.sourceSha256,
      method: decoded.method
    }
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e))
  }
}

/** 入力ファイルから source.sha256 を再計算した値が、受領証の値と等しいか */
export function sourceMatchesReceipt(
  receipt: Pick<TransactionReceipt, 'source'>,
  sourceHash: string
): boolean {
  return receipt.source.sha256 === sourceHash
}

/** easscan の URL に入れる形(eas-sdk の compactOffchainAttestationPackage と同じ並び) */
export function compactOffchainPackage(pkg: OffchainPackage): unknown[] {
  const { sig, signer } = pkg
  return [
    sig.domain.version,
    sig.domain.chainId,
    sig.domain.verifyingContract,
    sig.signature.r,
    sig.signature.s,
    sig.signature.v,
    signer,
    sig.uid,
    sig.message.schema,
    sig.message.recipient === ethers.constants.AddressZero
      ? '0'
      : sig.message.recipient,
    Number(sig.message.time),
    Number(sig.message.expirationTime),
    sig.message.refUID === ZERO_BYTES32 ? '0' : sig.message.refUID,
    sig.message.revocable,
    sig.message.data,
    0,
    sig.message.version,
    sig.message.salt
  ]
}

/**
 * easscan で署名を見るための URL。
 * 圧縮は zlib(deflate)で、ブラウザの CompressionStream を使う。無い環境では null。
 */
export async function easscanOffchainUrl(
  pkg: OffchainPackage,
  base = 'https://sepolia.easscan.org'
): Promise<string | null> {
  if (typeof CompressionStream === 'undefined') return null
  const json = JSON.stringify(compactOffchainPackage(pkg))
  const stream = new Blob([new TextEncoder().encode(json)])
    .stream()
    .pipeThrough(new CompressionStream('deflate'))
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer())
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return `${base}/offchain/url/#attestation=${encodeURIComponent(btoa(bin))}`
}
