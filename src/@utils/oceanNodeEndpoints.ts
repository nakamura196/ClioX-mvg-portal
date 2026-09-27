import { ProviderInstance } from '@oceanprotocol/lib'

/**
 * Ocean Node 4.x に、ocean.js 3.1.3 が必要とする窓口一覧を補う。
 *
 * 【なぜ要るか】
 * ocean.js 3.1.3 は、ノードの入口（GET /）が返す `serviceEndpoints`
 * （窓口の名前 → [メソッド, パス]）を見て、計算環境・ファイル情報・計算の開始
 * などの URL を決める。Ocean Node 3.2.0 は入口でこれを返していたが、
 * 4.2.0 では入口から外された（窓口そのものは同じパスに残っている）。
 * 一覧が無いと getEndpointURL() が undefined になり、ocean.js は何も問い合わせず
 * null を返す。画面では「利用できるコンピュート環境がありません」
 * 「ファイル情報がありません」になる（2026-09-27 に cliox-node で確認）。
 *
 * 一覧の中身は Ocean Node 3.2.0 の routeUtils.js（routesNames）を写した。
 * ocean.js はファイル情報を `fileinfo`（小文字）の名前で探すので、両方入れる。
 */
const SERVICES = '/api/services'
const AQUARIUS = '/api/aquarius'

const oceanNodeServiceEndpoints: Record<string, [string, string]> = {
  computeEnvironments: ['GET', `${SERVICES}/computeEnvironments`],
  computeResult: ['GET', `${SERVICES}/computeResult`],
  initializeCompute: ['POST', `${SERVICES}/initializeCompute`],
  computeStart: ['POST', `${SERVICES}/compute`],
  freeCompute: ['POST', `${SERVICES}/freeCompute`],
  computeStatus: ['GET', `${SERVICES}/compute`],
  computeDelete: ['DELETE', `${SERVICES}/compute`],
  computeStop: ['PUT', `${SERVICES}/compute`],
  ddoMetadataQuery: ['POST', `${AQUARIUS}/assets/metadata/query`],
  getDDOState: ['GET', `${AQUARIUS}/state/ddo`],
  fileInfo: ['POST', `${SERVICES}/fileInfo`],
  fileinfo: ['POST', `${SERVICES}/fileInfo`],
  download: ['GET', `${SERVICES}/download`],
  encrypt: ['POST', `${SERVICES}/encrypt`],
  decrypt: ['POST', `${SERVICES}/decrypt`],
  encryptFile: ['POST', `${SERVICES}/encryptFile`],
  initialize: ['GET', `${SERVICES}/initialize`],
  nonce: ['GET', `${SERVICES}/nonce`]
}

let patched = false

export function patchOceanNodeEndpoints(): void {
  if (patched) return
  patched = true

  const original = ProviderInstance.getEndpoints.bind(ProviderInstance)
  ProviderInstance.getEndpoints = async (providerUri: string) => {
    const data = await original(providerUri)
    if (data?.software === 'Ocean-Node' && !data.serviceEndpoints) {
      return { ...data, serviceEndpoints: oceanNodeServiceEndpoints }
    }
    return data
  }
}

patchOceanNodeEndpoints()
