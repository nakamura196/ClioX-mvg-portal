/**
 * 分析の炭素・費用の見積もり報告書（試作 f）。
 *
 * computeFootprint の見積もりを、計画書や業務記録に添付できる形
 * (画面・CSV・JSON・印刷) にまとめる。
 *
 * 方針は computeFootprint と同じ:
 *   - 算出できない行を 0 として合計に入れない。合計は「算出できた行だけの下限」
 *     であることと、除外した行の数を必ず併記する
 *   - 行ごとの品質ラベルと出典を消さない
 *   - これは計画段階の見積もりであって、実行したジョブの記録ではない
 */
import {
  ComputeLocation,
  DataQuality,
  Footprint,
  GridIntensity,
  PowerProfile,
  computeFootprintForKey
} from './computeFootprint'

export interface ReportLineInput {
  id: string
  /** 利用者が付ける行の名前（例: "OCR, Stockholm"） */
  label: string
  /** listKnownLocations() の key */
  envKey: string
  jobs: number
  minutesPerJob: number
}

export interface ReportLine extends ReportLineInput {
  durationSeconds: number
  footprint: Footprint
}

export interface ReportTotals {
  energyKWh?: number
  gCO2e?: number
  usdCost?: number
  /** 炭素が算出できた行の数 / 全行数 */
  carbonLines: number
  costLines: number
  lineCount: number
  /** 合計に含めた行の中で最も弱い品質 */
  quality: DataQuality
}

/**
 * alternatives … 候補どうしを比べる（どれか 1 つを実行する）。合計に意味は無い
 * combined     … すべての行を実行する。合計を出す
 */
export type ReportMode = 'alternatives' | 'combined'

export interface CarbonReport {
  mode: ReportMode
  title: string
  purpose: string
  preparedBy: string
  generatedAt: string
  lines: ReportLine[]
  totals: ReportTotals
}

// 弱いほど大きい。合計の品質は、含めた行のうち最も弱いものに引きずられる。
const QUALITY_RANK: Record<DataQuality, number> = {
  measured: 0,
  'provider-reported': 1,
  'portal-estimated': 2,
  unknown: 3
}

function weakest(qualities: DataQuality[]): DataQuality {
  if (!qualities.length) return 'unknown'
  return qualities.reduce((a, b) => (QUALITY_RANK[b] > QUALITY_RANK[a] ? b : a))
}

function sum(values: (number | undefined)[]): number | undefined {
  const known = values.filter((v): v is number => v != null)
  return known.length ? known.reduce((a, b) => a + b, 0) : undefined
}

/**
 * 算出できなかった理由の種類。computeFootprint の reason は日本語の文なので、
 * 画面と書き出しでは言語に合わせてこの種類から文を作る。
 */
export type ReasonCode = 'no-location' | 'no-grid' | 'no-power'

export function reasonCode(f: Footprint): ReasonCode | undefined {
  if (f.gCO2e != null) return undefined
  if (!f.location) return 'no-location'
  if (!f.grid) return 'no-grid'
  if (!f.power) return 'no-power'
  return undefined
}

/** 書き出し用（英語）。画面の文言は content/carbonReport(.ja).json にある */
export const REASON_EN: Record<ReasonCode, string> = {
  'no-location':
    'The compute environment does not declare where it physically runs, so emissions cannot be calculated.',
  'no-grid':
    'No verified grid carbon intensity is registered for this region yet.',
  'no-power': 'The power draw of this environment has not been measured yet.'
}

export function lineDurationSeconds(input: ReportLineInput): number {
  const jobs = Number(input.jobs)
  const minutes = Number(input.minutesPerJob)
  if (!Number.isFinite(jobs) || !Number.isFinite(minutes)) return 0
  return Math.max(0, jobs) * Math.max(0, minutes) * 60
}

export function buildCarbonReport(params: {
  mode?: ReportMode
  title: string
  purpose: string
  preparedBy: string
  lines: ReportLineInput[]
  now?: Date
}): CarbonReport {
  const lines: ReportLine[] = params.lines.map((input) => {
    const durationSeconds = lineDurationSeconds(input)
    return {
      ...input,
      durationSeconds,
      footprint: computeFootprintForKey(input.envKey, durationSeconds)
    }
  })

  const withCarbon = lines.filter((l) => l.footprint.gCO2e != null)
  const withCost = lines.filter((l) => l.footprint.usdCost != null)

  return {
    mode: params.mode ?? 'combined',
    title: params.title,
    purpose: params.purpose,
    preparedBy: params.preparedBy,
    generatedAt: (params.now ?? new Date()).toISOString(),
    lines,
    totals: {
      energyKWh: sum(withCarbon.map((l) => l.footprint.energyKWh)),
      gCO2e: sum(withCarbon.map((l) => l.footprint.gCO2e)),
      usdCost: sum(withCost.map((l) => l.footprint.usdCost)),
      carbonLines: withCarbon.length,
      costLines: withCost.length,
      lineCount: lines.length,
      quality: weakest(withCarbon.map((l) => l.footprint.quality))
    }
  }
}

/** 報告書の JSON。PROV の語彙で「誰が・いつ・何を見積もったか」を残す */
export function carbonReportToJSON(report: CarbonReport): object {
  const env = (loc?: ComputeLocation) =>
    loc && {
      provider: loc.provider,
      label: loc.label,
      labelEn: loc.en?.label,
      regionCode: loc.regionCode,
      processingLocation: loc.processingLocation,
      processingLocationEn: loc.en?.processingLocation,
      jurisdiction: loc.jurisdiction,
      usdPerHour: loc.usdPerHour,
      reportedPUE: loc.reportedPUE,
      reportedWaterLPerKWh: loc.reportedWaterLPerKWh,
      reportedAsOf: loc.reportedAsOf
    }
  const grid = (g?: GridIntensity) => g && { ...g }
  const power = (p?: PowerProfile) => p && { ...p }

  return {
    '@context': [
      'https://www.w3.org/ns/prov#',
      'https://greensoftware.foundation/sci'
    ],
    type: 'prov:Entity',
    reportType: 'planning estimate (not a record of jobs that were run)',
    mode:
      report.mode === 'alternatives'
        ? 'alternatives: the lines are options to choose between; only one would run'
        : 'combined: every line would run; totals apply',
    title: report.title,
    purpose: report.purpose,
    wasAttributedTo: report.preparedBy || undefined,
    generatedAtTime: report.generatedAt,
    wasGeneratedBy: 'Clio-X portal prototype (proto/carbon-report)',
    lines: report.lines.map((l) => ({
      label: l.label,
      environmentKey: l.envKey,
      environment: env(l.footprint.location),
      jobs: l.jobs,
      minutesPerJob: l.minutesPerJob,
      durationSeconds: l.durationSeconds,
      energyKWh: l.footprint.energyKWh,
      gCO2e: l.footprint.gCO2e,
      usdCost: l.footprint.usdCost,
      pue: l.footprint.pue,
      quality: l.footprint.quality,
      reason: reasonCode(l.footprint) && REASON_EN[reasonCode(l.footprint)],
      gridIntensity: grid(l.footprint.grid),
      powerProfile: power(l.footprint.power)
    })),
    totals:
      report.mode === 'alternatives'
        ? undefined
        : {
            ...report.totals,
            note: 'Totals include only lines that could be estimated. Lines that could not are excluded, not counted as zero.'
          },
    methodology: {
      standard: 'ISO/IEC 21031:2024 (Software Carbon Intensity)',
      scope: 'operational only (embodied carbon excluded)',
      carbonAccounting: 'location-based',
      functionalUnit: '1 compute job',
      notes: [
        'CPU energy is not included: it cannot be measured from inside a virtual machine.',
        'Where the facility PUE is not reported, PUE 1.0 is used as a lower bound.',
        'Each value carries its quality: measured / provider-reported / portal-estimated / unknown.'
      ]
    }
  }
}

function csvCell(v: unknown): string {
  if (v == null) return ''
  const s = String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * 行ごとの CSV。算出できない値は空欄にする（0 を書かない）。
 * 合計行は入れない: 表計算で再集計されたとき、除外の注記が失われるため。
 * 先頭の BOM は、Excel が日本語を正しく開くためのもの。
 */
export function carbonReportToCSV(
  report: CarbonReport,
  options: { lang?: 'en' | 'ja'; reasons?: Record<ReasonCode, string> } = {}
): string {
  const ja = options.lang === 'ja'
  const reasons = options.reasons ?? REASON_EN
  const pick = (x?: { source: string; sourceEn?: string }) =>
    x && (ja ? x.source : x.sourceEn ?? x.source)
  const header = [
    'label',
    'provider',
    'environment',
    'processing_location',
    'jurisdiction',
    'jobs',
    'minutes_per_job',
    'hours',
    'energy_kWh',
    'emissions_gCO2e',
    'cost_usd',
    'quality',
    'reason_if_not_estimated',
    'grid_gCO2e_per_kWh',
    'grid_source',
    'power_W',
    'power_quality',
    'power_source',
    'pue'
  ]
  const rows = report.lines.map((l) => {
    const f = l.footprint
    return [
      l.label,
      f.location?.provider,
      f.location &&
        (ja ? f.location.label : f.location.en?.label ?? f.location.label),
      f.location &&
        (ja
          ? f.location.processingLocation
          : f.location.en?.processingLocation ?? f.location.processingLocation),
      f.location?.jurisdiction,
      l.jobs,
      l.minutesPerJob,
      +(l.durationSeconds / 3600).toFixed(4),
      f.energyKWh != null ? +f.energyKWh.toFixed(6) : undefined,
      f.gCO2e != null ? +f.gCO2e.toFixed(3) : undefined,
      f.usdCost != null ? +f.usdCost.toFixed(4) : undefined,
      f.quality,
      reasonCode(f) && reasons[reasonCode(f)],
      f.grid?.gCO2ePerKWh,
      f.grid && `${pick(f.grid)} (${f.grid.asOf})`,
      f.power?.watts,
      f.power?.quality,
      pick(f.power),
      f.pue
    ]
  })
  return (
    '﻿' +
    [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') +
    '\r\n'
  )
}

/** ダウンロードするファイルのバイト列の SHA-256（16進）。固定性の確認用 */
export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
