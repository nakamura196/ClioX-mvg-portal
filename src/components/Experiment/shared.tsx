import { ReactElement } from 'react'
import type { DataQuality } from '@utils/computeFootprint'
import type { Bilingual } from '@utils/experiment'
import styles from './index.module.css'

export function download(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function fill(
  template: string,
  values: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? ''))
}

export const pick = (b: Bilingual, ja: boolean) => (ja ? b.ja : b.en)

/** 3 桁の有効数字。0 と区別するため、小さい値も 0 に丸めない */
export function num(v: number | undefined | null, dash = '—'): string {
  if (v === undefined || v === null || !Number.isFinite(v)) return dash
  return String(Number(v.toPrecision(3)))
}

export function QualityBadge({
  quality,
  label
}: {
  quality: DataQuality
  label: string
}): ReactElement {
  const cls =
    quality === 'measured'
      ? styles.measured
      : quality === 'unknown'
      ? styles.unknown
      : styles.estimated
  return <span className={`${styles.badge} ${cls}`}>{label}</span>
}
