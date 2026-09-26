import { ethers } from 'ethers'
import { LoggerInstance } from '@oceanprotocol/lib'
import { chains } from '../../chains.config'

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

  // 【重要】GET /nonce の値 +1 にしてはいけない。
  // ノードは publish の encrypt など他の経路で `Date.now()` をそのまま nonce に
  // 使うため、一度ミリ秒の時刻が保存されると "+1" では追いつけず、以後ずっと
  // 401 "consumer address and nonce signature mismatch" を返す。
  // 症状は認証エラーとして出ず、「ジョブ一覧が空」「ダウンロードできない」
  // 「成果物が出ない」という別の顔で現れるので、原因に辿り着きにくい。
  // 単調増加でありさえすればよいので、他の経路と同じく時刻で揃える。
  const nonce = String(Date.now())

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

/**
 * 自分たちが運用する Ocean Node かどうか（認証必須の新しい API かの判定、
 * および無償ジョブ一覧をノードへ直接問い合わせてよいかの判定に使う）。
 *
 * 【重要】以前は localhost / 127.0.0.1 の決め打ちだった。
 * 自前ノードをクラウド（AWS eu-north-1 など）へ出した途端、
 * 判定が false になり、無償ジョブの一覧補完（fetchComputeJobsViaOceanNode）が
 * 働かなくなる。無償ジョブはオンチェーンの注文を作らないため、
 * 「ジョブは実行できているのに画面の一覧が空」という形で現れ、
 * 原因に辿り着きにくい（2026-08-12 に実際に踏んだ）。
 *
 * 判定基準を「ローカルかどうか」ではなく
 * 「chains.config.js に自分で登録した provider かどうか」に変える。
 */
export function isLocalOceanNode(providerUrl: string): boolean {
  if (!providerUrl) return false
  if (/localhost|127\.0\.0\.1/.test(providerUrl)) return true

  const normalize = (u: string) => {
    try {
      const { host } = new URL(u)
      return host.toLowerCase()
    } catch {
      return ''
    }
  }
  const target = normalize(providerUrl)
  if (!target) return false

  // isCustom を立てているチェーン（＝自分で建てた構成）の provider だけを対象にする。
  // 公開ネットワークの provider を巻き込まないため。
  return (chains as any[])
    .filter((c) => c?.isCustom)
    .flatMap((c) => [
      c?.providerUri,
      ...((c?.providers || []).map((p: any) => p?.url) || [])
    ])
    .filter(Boolean)
    .some((u: string) => normalize(u) === target)
}
