import { useSyncExternalStore } from 'react'
import trialsJson from '../../../content/experiment/trials.json'
import { TrialsFile } from '@experiment/two-condition/lib/experiment'

// [prototype] 論文の図 1・デモ用（2026-11-04）。本番には配らない。
// 本物の資料ページで ?demo=1 を付けたときだけ、計算環境の一覧を
// /experiment の課題 t4 と同じ見本の 4 社に置き換える。値は説明用のダミー。
// ?env=a|b|c|d で選んだ状態にする（既定は a = Granite Cloud、図 2 と同じ）。
const TRIAL = 't4'
const ORDER = ['b', 'c', 'a', 'd']
export const DEMO_DEFAULT_ENV = 'a'

export function isComputeDemo(query: Record<string, unknown>): boolean {
  return query?.demo === '1' || query?.demo === 'true'
}

export function demoEnvId(pick: string): string {
  return `demo-${TRIAL}${pick}`
}

export function getDemoComputeEnvs(): any[] {
  const trial = (trialsJson as unknown as TrialsFile).trials.find(
    (t) => t.id === TRIAL
  )
  if (!trial) return []
  return ORDER.map((id) => {
    const o = trial.options.find((x) => x.id === id)
    return {
      id: demoEnvId(id),
      description: o.provider,
      cpuNumber: 1,
      gpuNumber: 0,
      maxJobDuration: 3600,
      priceMin: 0,
      trialOption: o,
      sample: `${TRIAL}${id}`
    }
  })
}

// 左の比較表（情報カードの下）と右の箱（購入の欄）は別の場所にあるので、
// 選んだ環境をここで共有する。デモのときだけ使う。

let demoSelected: string | undefined
const listeners = new Set<() => void>()

export function setDemoSelected(id: string | undefined): void {
  if (id === demoSelected) return
  demoSelected = id
  listeners.forEach((l) => l())
}

export function useDemoSelected(): string | undefined {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => demoSelected,
    () => undefined
  )
}
