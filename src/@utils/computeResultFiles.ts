import { ComputeResult, ProviderInstance } from '@oceanprotocol/lib'
import { Signer } from 'ethers'
import {
  buildComputeResultUrlViaOceanNode,
  isLocalOceanNode
} from './oceanNodeAuth'

// Ocean Node 4.x に移ってから、アルゴリズムの成果物（/data/outputs）は
// 1 つの outputs.tar にまとめて返される（compute_engine_docker.js が
// Docker の getArchive をそのまま保存する。中身は "outputs/<名前>"）。
// Pontus-X の旧来の C2D はファイルを 1 つずつ返していたので、可視化と
// チャットボットは結果のファイル名で中身を見分けている。ここで tar を開いて、
// 旧来と同じ「ファイル名と中身の組」に揃える。

export interface ComputeResultFile {
  filename: string
  content: string
}

function readString(bytes: Uint8Array, start: number, length: number): string {
  const slice = bytes.subarray(start, start + length)
  const end = slice.indexOf(0)
  return new TextDecoder().decode(end === -1 ? slice : slice.subarray(0, end))
}

function readOctal(bytes: Uint8Array, start: number, length: number): number {
  const text = readString(bytes, start, length).trim()
  return text ? parseInt(text, 8) : 0
}

/**
 * 通常ファイルだけを取り出す（ディレクトリ・リンクは捨てる）。
 * ustar / GNU の長い名前（'L'）/ pax（'x'）の path に対応（圧縮なしの tar のみ）。
 */
export function untar(
  input: ArrayBuffer | Uint8Array
): { name: string; data: Uint8Array }[] {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)

  const files: { name: string; data: Uint8Array }[] = []
  let offset = 0
  let nextName: string | undefined

  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512)
    if (header.every((b) => b === 0)) break

    const size = readOctal(header, 124, 12)
    const type = String.fromCharCode(header[156] || 0x30)
    const dataStart = offset + 512
    const data = bytes.subarray(dataStart, dataStart + size)
    offset = dataStart + Math.ceil(size / 512) * 512

    if (type === 'L') {
      nextName = readString(data, 0, data.length)
      continue
    }
    if (type === 'x') {
      const path = new TextDecoder()
        .decode(data)
        .split('\n')
        .map((line) => line.match(/^\d+ path=(.*)$/)?.[1])
        .find(Boolean)
      if (path) nextName = path
      continue
    }

    const prefix = readString(header, 345, 155)
    const name =
      nextName ?? (prefix ? `${prefix}/` : '') + readString(header, 0, 100)
    nextName = undefined
    if (type === '0' || type === '\0') files.push({ name, data })
  }
  return files
}

function isTar(filename: string | undefined): boolean {
  return /\.tar$/i.test(filename ?? '')
}

/**
 * ジョブの結果ファイルを取得する。tar は開いて、中のファイルを並べる
 * （ファイル名はパスの最後の部分だけにする）。
 * `pick` で取得する結果の番号を絞れる（ログを取りに行かないため）。
 */
export async function fetchComputeResultFiles(
  job: ComputeJobMetaData,
  serviceEndpoint: string,
  signer: Signer,
  pick: (result: ComputeResult, index: number) => boolean = () => true
): Promise<ComputeResultFile[]> {
  const results = Array.isArray(job.results) ? job.results : []
  const files: ComputeResultFile[] = []

  for (let i = 0; i < results.length; i++) {
    if (!pick(results[i], i)) continue
    if (files.length > 0) {
      // 署名の nonce がぶつからないよう間を空ける（元の実装と同じ）
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
    // 自前の Ocean Node は新しい署名方式を求める（ocean.js の
    // getComputeResultUrl は旧方式で、弾かれる）。Results.tsx と同じ分け方。
    const index = results[i]?.index ?? i
    const url = isLocalOceanNode(serviceEndpoint)
      ? await buildComputeResultUrlViaOceanNode(
          signer,
          serviceEndpoint,
          job.jobId,
          index,
          (job as { environment?: string }).environment
        )
      : await ProviderInstance.getComputeResultUrl(
          serviceEndpoint,
          signer,
          job.jobId,
          index
        )
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(
        `結果 ${results[i]?.filename ?? i} を取得できません (HTTP ${
          response.status
        })`
      )
    }

    if (isTar(results[i]?.filename)) {
      const entries = untar(await response.arrayBuffer())
      for (const entry of entries) {
        files.push({
          filename: entry.name.split('/').pop() || entry.name,
          content: new TextDecoder().decode(entry.data)
        })
      }
    } else {
      files.push({
        filename: results[i]?.filename ?? `#${i}`,
        content: await response.text()
      })
    }
  }
  return files
}
