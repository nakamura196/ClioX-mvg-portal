/**
 * 受領証の各値(IT 電力量・施設電力量・水・炭素)を、どう計算したかの過程。
 * 画面の「計算の過程を表示する」で使う。
 *
 * 入力一式(元データ)から計算をたどり直し、数値を代入した式を返す。
 * 式そのものは transactionFootprint.ts の computeTransaction と同じ。
 * 結果の値と区分は受領証の値を使う(ここで別の値を作らない)。
 * 式の文字列は言語に依らない。説明の文は画面側の文言で付ける。
 */
import type { DataQuality } from './computeFootprint'
import type {
  Quantity,
  TransactionReceipt,
  TransactionSourceData
} from './transactionFootprint'

export type StepKey = 'itEnergy' | 'facilityEnergy' | 'water' | 'carbon'

export type StepKind =
  | 'itShare'
  | 'itMeasured'
  | 'itFromFacility'
  | 'facilityPue'
  | 'facilityGiven'
  | 'waterFlow'
  | 'waterWue'
  | 'carbon'
  | 'unknown'

/** 区分を決めた入力。結果の区分は、このうち最も弱いもの */
export type StepInput =
  | 'power'
  | 'allocation'
  | 'measured'
  | 'itEnergy'
  | 'pue'
  | 'water'
  | 'facilityEnergy'
  | 'grid'

export interface Step {
  key: StepKey
  kind: StepKind
  /** 区間ごとの代入式。例: "0.45 kW × 0.2 h × 0.25 = 0.0225 kWh" */
  terms: string[]
  /** 結果を出す最後の式。例: "0.0225 + 0.05 = 0.0725 kWh" */
  total?: string
  quantity: Quantity
  qualityInputs: { input: StepInput; quality: DataQuality }[]
}

/** 有効数字 4 桁。途中の値を表の値(3 桁)と見比べられるよう、1 桁多く出す */
export const fmt = (v: number): string => String(Number(v.toPrecision(4)))

const sumLine = (parts: number[], unit: string): string => {
  const total = parts.reduce((a, b) => a + b, 0)
  return parts.length > 1
    ? `${parts.map(fmt).join(' + ')} = ${fmt(total)} ${unit}`
    : `${fmt(total)} ${unit}`
}

const unknownStep = (key: StepKey, quantity: Quantity): Step => ({
  key,
  kind: 'unknown',
  terms: [],
  quantity,
  qualityInputs: []
})

export function receiptSteps(
  receipt: TransactionReceipt,
  source: TransactionSourceData
): Step[] {
  const { input } = source
  const v = receipt.values
  const scope = input.powerScope ?? 'it-only'
  const pueQuality = input.pueQuality ?? 'provider-reported'
  const allocQuality: DataQuality =
    input.allocation === 'dedicated' &&
    input.intervals.every((i) => i.share === 1)
      ? input.powerQuality
      : 'portal-estimated'

  // 区間ごとの P·Δt·s(kWh)
  const powerTerms = input.intervals.map((i) => ({
    text: `${fmt(i.powerKW ?? NaN)} kW × ${fmt(i.hours)} h × ${fmt(i.share)}`,
    value: (i.powerKW ?? NaN) * i.hours * i.share
  }))
  const poolLines = powerTerms.map((t) => `${t.text} = ${fmt(t.value)} kWh`)
  const poolTotal = sumLine(
    powerTerms.map((t) => t.value),
    'kWh'
  )
  const poolInputs = [
    { input: 'power' as const, quality: input.powerQuality },
    ...(allocQuality !== input.powerQuality
      ? [{ input: 'allocation' as const, quality: allocQuality }]
      : [])
  ]

  // --- IT 電力量 ---
  let it: Step
  if (v.itEnergy.value === undefined) {
    it = unknownStep('itEnergy', v.itEnergy)
  } else if (input.allocation === 'measured-per-job' && scope === 'it-only') {
    it = {
      key: 'itEnergy',
      kind: 'itMeasured',
      terms: [],
      total: `${fmt(v.itEnergy.value)} kWh`,
      quantity: v.itEnergy,
      qualityInputs: [{ input: 'measured', quality: 'measured' }]
    }
  } else if (scope === 'facility') {
    it = {
      key: 'itEnergy',
      kind: 'itFromFacility',
      terms: [],
      total: `${fmt(v.facilityEnergy.value as number)} kWh ÷ ${fmt(
        input.pue as number
      )} = ${fmt(v.itEnergy.value)} kWh`,
      quantity: v.itEnergy,
      qualityInputs: [
        { input: 'facilityEnergy', quality: v.facilityEnergy.quality },
        { input: 'pue', quality: pueQuality }
      ]
    }
  } else {
    it = {
      key: 'itEnergy',
      kind: 'itShare',
      terms: poolLines,
      total: poolTotal,
      quantity: v.itEnergy,
      qualityInputs: poolInputs
    }
  }

  // --- 施設電力量 ---
  let facility: Step
  if (v.facilityEnergy.value === undefined) {
    facility = unknownStep('facilityEnergy', v.facilityEnergy)
  } else if (scope === 'facility') {
    const measured = input.allocation === 'measured-per-job'
    facility = {
      key: 'facilityEnergy',
      kind: 'facilityGiven',
      terms: measured ? [] : poolLines,
      total: measured ? `${fmt(v.facilityEnergy.value)} kWh` : poolTotal,
      quantity: v.facilityEnergy,
      qualityInputs: measured
        ? [{ input: 'measured', quality: 'measured' }]
        : poolInputs
    }
  } else {
    facility = {
      key: 'facilityEnergy',
      kind: 'facilityPue',
      terms: [],
      total: `${fmt(v.itEnergy.value as number)} kWh × ${fmt(
        input.pue as number
      )} = ${fmt(v.facilityEnergy.value)} kWh`,
      quantity: v.facilityEnergy,
      qualityInputs: [
        { input: 'itEnergy', quality: v.itEnergy.quality },
        { input: 'pue', quality: pueQuality }
      ]
    }
  }

  // --- 水 ---
  let water: Step
  const w = input.water
  if (v.water.value === undefined || !w) {
    water = unknownStep('water', v.water)
  } else if (w.kind === 'wue') {
    water = {
      key: 'water',
      kind: 'waterWue',
      terms: [],
      total: `${fmt(v.itEnergy.value as number)} kWh × ${fmt(
        w.lPerKWh
      )} L/kWh = ${fmt(v.water.value)} L`,
      quantity: v.water,
      qualityInputs: [
        { input: 'water', quality: w.quality },
        { input: 'itEnergy', quality: v.itEnergy.quality }
      ]
    }
  } else {
    const terms = input.intervals.map((i) => {
      const q = (i.waterLPerHour ?? w.lPerHour) as number
      const r = i.waterShare ?? i.share
      return {
        text: `${fmt(q)} L/h × ${fmt(i.hours)} h × ${fmt(r)}`,
        value: q * i.hours * r
      }
    })
    water = {
      key: 'water',
      kind: 'waterFlow',
      terms: terms.map((t) => `${t.text} = ${fmt(t.value)} L`),
      total: sumLine(
        terms.map((t) => t.value),
        'L'
      ),
      quantity: v.water,
      qualityInputs: [
        { input: 'water', quality: w.quality },
        { input: 'allocation', quality: 'portal-estimated' }
      ]
    }
  }

  // --- 炭素 ---
  let carbon: Step
  if (v.carbon.value === undefined || !input.grid) {
    carbon = unknownStep('carbon', v.carbon)
  } else {
    carbon = {
      key: 'carbon',
      kind: 'carbon',
      terms: [],
      total: `${fmt(v.facilityEnergy.value as number)} kWh × ${fmt(
        input.grid.gCO2ePerKWh
      )} gCO2e/kWh = ${fmt(v.carbon.value)} gCO2e`,
      quantity: v.carbon,
      qualityInputs: [
        { input: 'facilityEnergy', quality: v.facilityEnergy.quality },
        { input: 'grid', quality: 'portal-estimated' }
      ]
    }
  }

  return [it, facility, water, carbon]
}
