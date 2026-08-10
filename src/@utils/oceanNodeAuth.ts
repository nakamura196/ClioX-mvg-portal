import { ethers } from 'ethers'
import { LoggerInstance } from '@oceanprotocol/lib'

/**
 * Ocean Node 3.2.0 の認証付きエンドポイントを、ブラウザのウォレットで直接叩く。
 *
 * 【なぜ要るか】
 * ocean.js 3.1.3 の ProviderInstance.encrypt() は認証パラメータを送らないが、
 * Ocean Node 3.2.0 の /api/services/encrypt は consumerAddress / nonce / signature
 * を要求し、無いと 401 を返す。publish はこの encrypt を通るので、そのままでは
 * 手元のノードに対して公開できない。
 *
 * 【署名の作り方】ノードの validateNonceAndSignature と同じ組み立て。
 *   message = consumerAddress + nonce + <コマンド名>
 *   hash    = solidityKeccak256(['bytes'], [utf8(message)])
 *   これに personal_sign する。
 */

async function browserSigner(): Promise<ethers.providers.JsonRpcSigner> {
  const eth = (globalThis as any).ethereum
  if (!eth) throw new Error('ウォレットが見つかりません')
  const provider = new ethers.providers.Web3Provider(eth)
  await provider.send('eth_requestAccounts', [])
  return provider.getSigner()
}

export async function signNodeCommand(
  providerUrl: string,
  command: string,
  existingSigner?: ethers.Signer
): Promise<{ consumerAddress: string; nonce: string; signature: string }> {
  const signer = existingSigner || (await browserSigner())
  const consumerAddress = await signer.getAddress()

  const res = await fetch(
    `${providerUrl}/api/services/nonce?userAddress=${consumerAddress}`
  )
  const body = res.ok ? await res.json() : {}
  const nonce = String(Number(body?.nonce ?? 0) + 1)

  const message = String(consumerAddress) + nonce + command
  const hash = ethers.utils.solidityKeccak256(
    ['bytes'],
    [ethers.utils.hexlify(ethers.utils.toUtf8Bytes(message))]
  )
  const signature = await signer.signMessage(ethers.utils.arrayify(hash))
  return { consumerAddress, nonce, signature }
}

/** 認証パラメータ付きで /api/services/encrypt を呼び、暗号化済み文字列を返す */
export async function encryptViaOceanNode(
  files: any,
  providerUrl: string
): Promise<string> {
  const { consumerAddress, nonce, signature } = await signNodeCommand(
    providerUrl,
    'encrypt'
  )
  const q = new URLSearchParams({ consumerAddress, nonce, signature })
  const res = await fetch(`${providerUrl}/api/services/encrypt?${q}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: JSON.stringify(files)
  })
  const raw = await res.text()
  if (!res.ok) {
    LoggerInstance.error('[encrypt] ノードからのエラー:', res.status, raw)
    throw new Error(`encrypt が失敗しました (${res.status}): ${raw}`)
  }
  return raw
}

/**
 * 認証パラメータ付きのダウンロード URL を組み立てる。
 *
 * ocean.js 3.1.3 の getDownloadUrl() は `documentId + nonce` を署名する旧方式だが、
 * Ocean Node 3.2.0 は `consumerAddress + nonce + "download"` を期待する。
 * そのままだと本文 45 バイトの
 * "consumer address and nonce signature mismatch" が返り、
 * ブラウザはそれをファイルとして保存してしまう（中身がエラー文のファイルができる）。
 */
export async function buildDownloadUrlViaOceanNode(
  signer: ethers.Signer,
  providerUrl: string,
  params: {
    documentId: string
    serviceId: string
    transferTxId: string
    fileIndex?: number
    userdata?: any
  }
): Promise<string> {
  const { consumerAddress, nonce, signature } = await signNodeCommand(
    providerUrl,
    'download',
    signer
  )
  const q = new URLSearchParams({
    fileIndex: String(params.fileIndex ?? 0),
    documentId: params.documentId,
    serviceId: params.serviceId,
    transferTxId: params.transferTxId,
    nonce,
    consumerAddress,
    signature
  })
  if (params.userdata) q.set('userdata', JSON.stringify(params.userdata))
  return `${providerUrl}/api/services/download?${q}`
}

/**
 * 計算ジョブの一覧を Ocean Node から直接取得する。
 *
 * ocean.js 3.1.3 の computeStatus() は手元のノードから空配列しか返さない
 * （ジョブ自体は node 側に存在し、GET /api/services/compute?consumerAddress=…
 * で 4 件返ることを確認済み）。画面の「Your Compute Jobs」が
 * "No results found" のままになるため、手元のノードには自前で問い合わせる。
 */
export async function fetchComputeJobsViaOceanNode(
  providerUrl: string,
  consumerAddress: string
): Promise<any[]> {
  try {
    const res = await fetch(
      `${providerUrl}/api/services/compute?consumerAddress=${consumerAddress}`
    )
    if (!res.ok) return []
    const body = await res.json()
    return Array.isArray(body) ? body : body ? [body] : []
  } catch (e) {
    LoggerInstance.error('[computeStatus] 取得に失敗:', (e as Error).message)
    return []
  }
}

/**
 * 計算ジョブの成果物を取得する URL を組み立てる。
 *
 * 署名の対象は `consumerAddress + nonce + "getComputeResult"`。
 * ocean.js 3.1.3 の getComputeResultUrl() は旧方式で署名するため、
 * 手元のノードでは弾かれる（download と同じ構図）。
 */
export async function buildComputeResultUrlViaOceanNode(
  signer: ethers.Signer,
  providerUrl: string,
  jobId: string,
  index: number,
  environment?: string
): Promise<string> {
  const { consumerAddress, nonce, signature } = await signNodeCommand(
    providerUrl,
    'getComputeResult',
    signer
  )
  // 【重要】ジョブ一覧（GET /api/services/compute）が返す jobId は単体だが、
  // computeResult は `<クラスタhash>-<jobId>` を期待する。前置しないと
  // hash の切り出しに失敗し、500 "Invalid C2D Environment" になる。
  const cluster = String(environment || '').split('-')[0]
  const fullJobId =
    jobId.includes('-') || !cluster ? jobId : `${cluster}-${jobId}`
  const q = new URLSearchParams({
    consumerAddress,
    jobId: fullJobId,
    index: String(index),
    nonce,
    signature
  })
  return `${providerUrl}/api/services/computeResult?${q}`
}

/**
 * URL の中身を取得し、**指定したファイル名で**保存する。
 *
 * Ocean Node の computeResult は Content-Disposition を返さず、
 * content-type も tar でさえ text/plain と申告する。そのため
 * downloadFileBrowser() に任せると、ブラウザは名前も拡張子も決められず
 * `file`（拡張子なし）で保存される。
 *
 * 一方、ジョブ一覧には results[i].filename（outputs.tar / algorithm.log 等）が
 * 入っている。画面はその名前を表示にも使っているので、保存時にも使う。
 */
export async function downloadUrlAsFile(
  url: string,
  filename: string
): Promise<void> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(
      `ダウンロードに失敗しました (${res.status}): ${body.slice(0, 200)}`
    )
  }
  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename || 'result'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(objectUrl)
}

/** 手元に建てた Ocean Node かどうか（認証必須の新しい API かの判定に使う） */
export function isLocalOceanNode(providerUrl: string): boolean {
  return /localhost|127\.0\.0\.1/.test(providerUrl || '')
}
