import { LoggerInstance } from '@oceanprotocol/lib'

/**
 * ジョブ ID → アルゴリズム DID の対応を、ブラウザ側で覚えておくための小さな記憶。
 *
 * 【なぜ必要か】
 * ポータルはジョブを投入する瞬間、どのアルゴリズムを選んだかを確実に知っている
 * （利用者が選択欄で選んだのだから）。ところが Ocean Node 3.2.0 は、ジョブ状態の
 * 応答に `algoDID` を含めないことがある。その結果 ComputeJobs/Details は
 * `job.algoDID` が undefined になり、アルゴリズム名を解決できず「(名称不明)」に
 * フォールバックする。
 *
 * つまり「情報が無い」のではなく「選択時に持っていた情報が、実行の記録に
 * 引き継がれていない」。ノード側の修正を待たずに、ポータル側で引き継げる。
 *
 * 【設計上の注意 — 重要】
 * これは *表示の補助* であって *証拠ではない*。localStorage は利用者が消せるし、
 * 別のブラウザ・別の端末には引き継がれない。権威ある記録はノード／チェーン側にある。
 * したがってここで補った値を「検証済み」として扱ってはならない。
 * 本筋はノードが `algoDID` を返すことであり、これは暫定の埋め合わせである。
 */

const STORAGE_KEY = 'clioX_jobAlgorithmMemory'
const MAX_ENTRIES = 200

type Memory = Record<string, string>

function read(): Memory {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    // 壊れた値・別形式が入っていても画面を落とさない
    return parsed && typeof parsed === 'object' ? (parsed as Memory) : {}
  } catch (error) {
    LoggerInstance.warn('[jobAlgorithmMemory] 読み込みに失敗しました', error)
    return {}
  }
}

function write(memory: Memory): void {
  if (typeof window === 'undefined') return
  try {
    const keys = Object.keys(memory)
    // 無制限に増えないよう、古いものから捨てる（挿入順を保つ前提）
    const trimmed =
      keys.length > MAX_ENTRIES
        ? keys.slice(keys.length - MAX_ENTRIES).reduce<Memory>((acc, key) => {
            acc[key] = memory[key]
            return acc
          }, {})
        : memory
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch (error) {
    LoggerInstance.warn('[jobAlgorithmMemory] 保存に失敗しました', error)
  }
}

/**
 * ジョブ投入に成功した直後に呼ぶ。
 * 応答の形は経路（無償 / 有償）によって違うので、配列も単体も受ける。
 */
export function rememberJobAlgorithm(
  response: unknown,
  algorithmDid: string | undefined
): void {
  if (!algorithmDid) return

  const jobs = Array.isArray(response) ? response : [response]
  const memory = read()
  let stored = 0

  jobs.forEach((job) => {
    const jobId = (job as { jobId?: string })?.jobId
    if (!jobId) return
    memory[jobId] = algorithmDid
    stored += 1
  })

  if (stored === 0) {
    LoggerInstance.warn(
      '[jobAlgorithmMemory] 応答に jobId が無く、アルゴリズムを記録できませんでした'
    )
    return
  }
  write(memory)
}

/** ノードが algoDID を返さなかったときの控え。無ければ undefined。 */
export function recallJobAlgorithm(jobId: string): string | undefined {
  if (!jobId) return undefined
  return read()[jobId]
}
