import { Signer, ethers } from 'ethers'
import { LoggerInstance } from '@oceanprotocol/lib'

/**
 * 無償（Dispenser / free）の資産に対して、Ocean Node の `freeStartCompute` で
 * 計算ジョブを開始する。
 *
 * 【なぜ別経路が要るか】
 * ポータルが使う ocean.js 3.1.3 は `initializeCompute` → 注文 → `startCompute`
 * という流れしか知らない。一方 Ocean Node 3.2.0 の `initializeCompute` は
 * `payment: { chainId, token }` を必須にし、escrow コントラクト前提の課金を行う。
 * そのため無償の資産でも 400 が返り、しかも本文がプレーンテキストなので
 * ocean.js 側の JSON.parse が落ちて、原因が見えないまま止まる。
 *
 * ノードには `freeStartCompute`（POST /api/services/freeCompute）という別の
 * コマンドがあり、こちらは payment も注文も要求しない。認可は計算環境の
 * `free.access`（アドレス列挙 / AccessList NFT）で行われる。無償の資産は
 * こちらに振り分けるのが正しい。
 *
 * 【署名】
 * message = consumerAddress + nonce + "freeStartCompute" を UTF-8 バイト列にして
 * solidityKeccak256(['bytes'], [...]) でハッシュ化し、それに personal_sign する。
 * ノード側 validateNonceAndSignature と同じ組み立て。
 */

export interface FreeComputeAssetRef {
  documentId: string
  serviceId: string
  userdata?: any
}

export interface FreeComputeAlgorithmRef extends FreeComputeAssetRef {
  algocustomdata?: any
}

const COMMAND = 'freeStartCompute'

async function getNonce(providerUrl: string, address: string): Promise<string> {
  const res = await fetch(
    `${providerUrl}/api/services/nonce?userAddress=${address}`
  )
  if (!res.ok) throw new Error(`nonce の取得に失敗しました (${res.status})`)
  const body = await res.json()
  // ノードは { nonce: "12" } を返す。未使用のアドレスでは 0 のことがある。
  return String(Number(body?.nonce ?? 0) + 1)
}

async function signForCommand(
  signer: Signer,
  address: string,
  nonce: string
): Promise<string> {
  const message = String(address) + nonce + COMMAND
  const hash = ethers.utils.solidityKeccak256(
    ['bytes'],
    [ethers.utils.hexlify(ethers.utils.toUtf8Bytes(message))]
  )
  return await signer.signMessage(ethers.utils.arrayify(hash))
}

export async function startFreeCompute(
  signer: Signer,
  providerUrl: string,
  params: {
    environment: string
    algorithm: FreeComputeAlgorithmRef
    datasets: FreeComputeAssetRef[]
    maxJobDuration?: number
    resources?: { id: string; amount: number }[]
    output?: any
  }
): Promise<any> {
  const consumerAddress = await signer.getAddress()
  const nonce = await getNonce(providerUrl, consumerAddress)
  const signature = await signForCommand(signer, consumerAddress, nonce)

  const body = {
    consumerAddress,
    nonce,
    signature,
    environment: params.environment,
    algorithm: params.algorithm,
    datasets: params.datasets,
    ...(params.maxJobDuration ? { maxJobDuration: params.maxJobDuration } : {}),
    ...(params.resources ? { resources: params.resources } : {}),
    ...(params.output ? { output: params.output } : {})
  }

  const res = await fetch(`${providerUrl}/api/services/freeCompute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  // ノードはエラー時に JSON ではなくプレーンテキストを返すことがある。
  // ここで握り潰すと原因が消えるので、本文をそのままメッセージに載せる。
  const raw = await res.text()
  if (!res.ok) {
    LoggerInstance.error('[freeCompute] ノードからのエラー:', res.status, raw)
    throw new Error(`freeCompute が失敗しました (${res.status}): ${raw}`)
  }
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

/** Dispenser 等で無償配布されている資産か */
export function isFreeAsset(asset: any): boolean {
  return asset?.accessDetails?.type === 'free'
}
