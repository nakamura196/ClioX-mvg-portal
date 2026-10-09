/**
 * 持続可能性の表示実験 (/experiment) の計算と記録。
 *
 * 2 条件・参加者間のランダム化実験:
 *   control   … 費用・所在地・法域・データ統治・認証だけを見せる
 *   treatment … 上記に加えて、1 件あたりの電力・水・炭素(質ラベル付き)を見せる
 *
 * 画面に出す数値はすべて content/experiment/trials.json の入力から
 * transactionFootprint.ts で計算する。手で書いた結果値は無い。
 *
 * 「正解」(最も資源の少ない選択肢)の定義:
 *   施設電力量 (facilityEnergy) が最小の選択肢。同値(相対差 1e-9 以下)は全部正解。
 *   水・炭素の最小も同じ規則で別に求め、電力最小と水最小が食い違うかを
 *   試行ごとに記録する(隠さない)。水が不明な選択肢が 1 つでもあれば、
 *   食い違いの判定は null(判定不能)とする。
 */
import {
  AllocationBasis,
  Interval,
  PowerScope,
  TransactionFootprint,
  TransactionInput,
  WaterInput,
  WaterKind,
  WaterScope,
  computeTransaction
} from './transactionFootprint'
import type { DataQuality } from './computeFootprint'

export type Condition = 'control' | 'treatment'
export type Bilingual = { en: string; ja: string }
export type IndigenousSuitability =
  | 'suitable'
  | 'conditional'
  | 'not-suitable'
  | 'unknown'

export interface TrialOption {
  id: string
  provider: string
  location: Bilingual
  jurisdiction: Bilingual
  costUSD: number
  governance: { indigenousData: IndigenousSuitability }
  certifications: string[]
  compute: {
    allocation: AllocationBasis
    intervals: Interval[]
    powerScope: PowerScope
    pue?: number
    powerQuality: DataQuality
    pueQuality?: DataQuality
    water: null | {
      kind: 'wue' | 'flow'
      value: number
      quality: DataQuality
      definition: WaterKind
      scope: WaterScope
      period?: string
    }
    grid: {
      gCO2ePerKWh: number
      label: string
      source: string
      quality: DataQuality
    }
  }
}

export interface Trial {
  id: string
  job: Bilingual
  options: TrialOption[]
}

export interface TrialsFile {
  version: string
  demoNotice: Bilingual
  priorityStatement: Bilingual
  trials: Trial[]
}

export function optionInput(o: TrialOption): TransactionInput {
  const w = o.compute.water
  const water: WaterInput | undefined = !w
    ? undefined
    : w.kind === 'wue'
    ? {
        kind: 'wue',
        lPerKWh: w.value,
        quality: w.quality,
        definition: w.definition,
        scope: w.scope,
        period: w.period
      }
    : {
        kind: 'flow',
        lPerHour: w.value,
        quality: w.quality,
        definition: w.definition,
        scope: w.scope
      }
  return {
    intervals: o.compute.intervals,
    allocation: o.compute.allocation,
    powerQuality: o.compute.powerQuality,
    powerScope: o.compute.powerScope,
    pue: o.compute.pue,
    pueQuality: o.compute.pueQuality,
    water,
    grid: {
      gCO2ePerKWh: o.compute.grid.gCO2ePerKWh,
      label: o.compute.grid.label,
      asOf: 'see source',
      source: o.compute.grid.source
    }
  }
}

export function optionFootprint(o: TrialOption): TransactionFootprint {
  return computeTransaction(optionInput(o))
}

export interface ComputedOption {
  option: TrialOption
  footprint: TransactionFootprint
}

export interface TrialFlags {
  energyLowestIds: string[]
  waterLowestIds: string[]
  carbonLowestIds: string[]
  costLowestIds: string[]
  /** 電力最小と水最小が一致するか。水が不明な選択肢があれば null */
  energyWaterAgree: boolean | null
  /** 水が不明な選択肢の id */
  waterUnknownIds: string[]
}

function lowestIds(items: { id: string; v?: number }[]): string[] {
  const known = items.filter((i) => typeof i.v === 'number') as {
    id: string
    v: number
  }[]
  if (!known.length) return []
  const min = Math.min(...known.map((i) => i.v))
  return known.filter((i) => i.v - min <= Math.abs(min) * 1e-9).map((i) => i.id)
}

export function computeTrial(trial: Trial): {
  options: ComputedOption[]
  flags: TrialFlags
} {
  const options = trial.options.map((option) => ({
    option,
    footprint: optionFootprint(option)
  }))
  const energyLowestIds = lowestIds(
    options.map((o) => ({
      id: o.option.id,
      v: o.footprint.facilityEnergy.value
    }))
  )
  const waterLowestIds = lowestIds(
    options.map((o) => ({ id: o.option.id, v: o.footprint.water.value }))
  )
  const carbonLowestIds = lowestIds(
    options.map((o) => ({ id: o.option.id, v: o.footprint.carbon.value }))
  )
  const costLowestIds = lowestIds(
    options.map((o) => ({ id: o.option.id, v: o.option.costUSD }))
  )
  const waterUnknownIds = options
    .filter((o) => o.footprint.water.value === undefined)
    .map((o) => o.option.id)
  const same = (a: string[], b: string[]) =>
    a.length === b.length && a.every((x) => b.includes(x))
  return {
    options,
    flags: {
      energyLowestIds,
      waterLowestIds,
      carbonLowestIds,
      costLowestIds,
      energyWaterAgree: waterUnknownIds.length
        ? null
        : same(energyLowestIds, waterLowestIds),
      waterUnknownIds
    }
  }
}

export function shuffled<T>(items: T[], rnd: () => number = Math.random): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function randomCondition(rnd: () => number = Math.random): Condition {
  return rnd() < 0.5 ? 'control' : 'treatment'
}

export function parseCondition(v: unknown): Condition | undefined {
  return v === 'control' || v === 'treatment' ? v : undefined
}

// ---------------------------------------------------------------------------
// 記録
// ---------------------------------------------------------------------------

export interface TrialRecord {
  trialIndex: number
  trialId: string
  condition: Condition
  pid: string
  displayedOrder: string[]
  chosen: string
  chosenIsEnergyLowest: boolean
  /** 水が不明な選択肢があっても、水が分かる選択肢の中の最小かどうか */
  chosenIsWaterLowest: boolean
  chosenIsCarbonLowest: boolean
  chosenIsCostLowest: boolean
  energyWaterAgree: boolean | null
  chosenEnergyKWh: number | null
  chosenWaterL: number | null
  chosenCostUSD: number
  /** 試行の表示から確定ボタンまで (ms) */
  responseMs: number
  /** 試行の表示から最初の選択まで (ms) */
  firstChoiceMs: number
  changedChoice: boolean
  timestamp: string
}

/** 浮動小数点の端数(1.6500000000000001)を記録に残さない */
function round6(v: number | undefined): number | null {
  return v === undefined ? null : Number(v.toPrecision(6))
}

export function buildTrialRecord(p: {
  trial: Trial
  trialIndex: number
  condition: Condition
  pid: string
  displayedOrder: string[]
  chosen: string
  responseMs: number
  firstChoiceMs: number
  changedChoice: boolean
  now: Date
}): TrialRecord {
  const { options, flags } = computeTrial(p.trial)
  const c = options.find((o) => o.option.id === p.chosen)
  return {
    trialIndex: p.trialIndex,
    trialId: p.trial.id,
    condition: p.condition,
    pid: p.pid,
    displayedOrder: p.displayedOrder,
    chosen: p.chosen,
    chosenIsEnergyLowest: flags.energyLowestIds.includes(p.chosen),
    chosenIsWaterLowest: flags.waterLowestIds.includes(p.chosen),
    chosenIsCarbonLowest: flags.carbonLowestIds.includes(p.chosen),
    chosenIsCostLowest: flags.costLowestIds.includes(p.chosen),
    energyWaterAgree: flags.energyWaterAgree,
    chosenEnergyKWh: round6(c?.footprint.facilityEnergy.value),
    chosenWaterL: round6(c?.footprint.water.value),
    chosenCostUSD: c?.option.costUSD ?? NaN,
    responseMs: Math.round(p.responseMs),
    firstChoiceMs: Math.round(p.firstChoiceMs),
    changedChoice: p.changedChoice,
    timestamp: p.now.toISOString()
  }
}

export interface ResultsFile {
  schema: 'clio-x-sustainability-experiment-results/0.1'
  trialsVersion: string
  condition: Condition
  pid: string
  startedAt: string
  finishedAt: string
  records: TrialRecord[]
}

const CSV_COLUMNS: (keyof TrialRecord)[] = [
  'pid',
  'condition',
  'trialIndex',
  'trialId',
  'displayedOrder',
  'chosen',
  'chosenIsEnergyLowest',
  'chosenIsWaterLowest',
  'chosenIsCarbonLowest',
  'chosenIsCostLowest',
  'energyWaterAgree',
  'chosenEnergyKWh',
  'chosenWaterL',
  'chosenCostUSD',
  'responseMs',
  'firstChoiceMs',
  'changedChoice',
  'timestamp'
]

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = Array.isArray(v) ? v.join('|') : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function resultsToCSV(records: TrialRecord[]): string {
  const rows = records.map((r) =>
    CSV_COLUMNS.map((k) => csvCell(r[k])).join(',')
  )
  return [CSV_COLUMNS.join(','), ...rows].join('\n') + '\n'
}

// ---------------------------------------------------------------------------
// design.json: シミュレーション(MATLAB 等)用に、表示される数値をそのまま書き出す
// ---------------------------------------------------------------------------

export function buildDesign(file: TrialsFile): object {
  return {
    schema: 'clio-x-sustainability-experiment-design/0.1',
    trialsVersion: file.version,
    note: 'All per-option figures are computed from the trial inputs by transactionFootprint.ts. Demo data only; not provider claims.',
    correctOptionRule:
      'Lowest facility energy per transaction; ties are all correct. Water-lowest and carbon-lowest are listed separately; energyWaterAgree is null when any option has unknown water.',
    trials: file.trials.map((t) => {
      const { options, flags } = computeTrial(t)
      return {
        id: t.id,
        job: t.job,
        flags,
        options: options.map(({ option, footprint }) => ({
          id: option.id,
          provider: option.provider,
          location: option.location,
          jurisdiction: option.jurisdiction,
          costUSD: option.costUSD,
          governance: option.governance,
          certifications: option.certifications,
          itEnergyKWh: footprint.itEnergy.value ?? null,
          facilityEnergyKWh: footprint.facilityEnergy.value ?? null,
          waterL: footprint.water.value ?? null,
          waterReason: footprint.water.reason ?? null,
          carbonGCO2e: footprint.carbon.value ?? null,
          quality: {
            energy: footprint.facilityEnergy.quality,
            water: footprint.water.quality,
            carbon: footprint.carbon.quality
          },
          isEnergyLowest: flags.energyLowestIds.includes(option.id),
          isWaterLowest: flags.waterLowestIds.includes(option.id),
          isCarbonLowest: flags.carbonLowestIds.includes(option.id),
          isCostLowest: flags.costLowestIds.includes(option.id)
        }))
      }
    })
  }
}
