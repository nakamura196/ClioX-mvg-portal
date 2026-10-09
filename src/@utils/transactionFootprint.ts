/**
 * 1 件の処理(transaction)あたりの電力・水・炭素の計上。
 * V. Lemieux 案の方法(2026-10 草稿)の実装。
 *
 *   E_i = Σ_k P_k · Δt_k · s_{i,k}     (kWh, IT 電力。P_k は kW, Δt_k は時間)
 *   W_i = Σ_k Q_k · Δt_k · r_{i,k}     (L, Q_k は水の流量 L/h, r は既定で s)
 *
 * 水の入力は 2 通りを受け付ける。草稿の式は「流量 L/h」だが、図に出ている値は
 * 事業者申告の WUE (L/kWh, 年間平均) だった。
 *   - 流量     : W = Σ Q_k · Δt_k · r_k          (「計算シェアで割り振った会計上の推定」)
 *   - WUE      : W = IT 電力量 × WUE             (The Green Grid の定義: 現地水使用量 / IT 電力量)
 * 炭素は 草稿の式に無かったので、施設電力量 × 系統排出係数 (location-based) とする。
 *
 * 守る規則 (computeFootprint.ts と同じ):
 *   - 入力が欠けた値は 0 にせず unknown とし、理由を書く。
 *   - すべての値に quality と basis (どう出した値か) を付ける。
 *   - 水は「割り振りによる推定」であり、実測の消費量ではない。
 */
import type { DataQuality, GridIntensity } from './computeFootprint'
import { canonicalSha256, stripHexPrefix } from './canonicalJson'

export const TRANSACTION_METHOD = {
  id: 'clio-x-transaction-allocation',
  version: '0.1'
} as const

export const TRANSACTION_METHOD_LABEL = `${TRANSACTION_METHOD.id}/${TRANSACTION_METHOD.version}`

/**
 * 割り当ての根拠。
 *   dedicated        … 専有マシン。シェア 100%
 *   reserved-share   … 共有 GPU 等の予約分(同等の容量)× 時間
 *   measured-per-job … ジョブ単位で実測した電力量があるので、それを使う
 */
export type AllocationBasis =
  | 'dedicated'
  | 'reserved-share'
  | 'measured-per-job'

/** 事業者が出す電力値に冷却が含まれるか */
export type PowerScope = 'it-only' | 'facility'

/** 水の定義。再循環の流量は消費ではない */
export type WaterKind =
  | 'withdrawal'
  | 'consumption'
  | 'recirculating-flow'
  | 'unspecified'

/** 現地の水か、発電に使われた水か */
export type WaterScope = 'on-site' | 'electricity-generation' | 'unspecified'

export interface Interval {
  /** この区間の IT 電力 (kW)。プール全体の電力 */
  powerKW?: number
  /** 区間の長さ (時間) */
  hours: number
  /** 計算シェア s (0〜1) */
  share: number
  /** 水の流量 Q_k (L/h)。流量で水を出すときだけ */
  waterLPerHour?: number
  /** 水の割り当て率 r。省略時は share と同じ */
  waterShare?: number
}

export type WaterInput =
  | {
      kind: 'flow'
      /** 区間に waterLPerHour が無いときに使う既定の流量 (L/h) */
      lPerHour?: number
      quality: DataQuality
      definition: WaterKind
      scope: WaterScope
    }
  | {
      kind: 'wue'
      lPerKWh: number
      quality: DataQuality
      definition: WaterKind
      scope: WaterScope
      /** 例: 年間平均 */
      period?: string
    }

export interface TransactionInput {
  intervals: Interval[]
  allocation: AllocationBasis
  powerQuality: DataQuality
  /** 事業者の電力値が IT のみか、冷却込みか。既定は it-only */
  powerScope?: PowerScope
  /** PUE。it-only なら施設電力量 = IT × PUE に使う */
  pue?: number
  pueQuality?: DataQuality
  /** ジョブ単位の実測 IT 電力量 (kWh)。allocation が measured-per-job のとき使う */
  measuredITEnergyKWh?: number
  water?: WaterInput
  grid?: GridIntensity
}

export interface Quantity {
  value?: number
  unit: string
  quality: DataQuality
  /** どう出した値か (英語・機械可読な短文) */
  basis: string
  /** value が無いとき、なぜ出せないか */
  reason?: string
}

export interface TransactionFootprint {
  method: typeof TRANSACTION_METHOD
  allocation: AllocationBasis
  intervals: Interval[]
  /** 計算シェアを時間で重み付けした平均 (表示用) */
  averageShare?: number
  totalHours: number
  itEnergy: Quantity
  facilityEnergy: Quantity
  water: Quantity
  carbon: Quantity
  waterDefinition?: { kind: WaterKind; scope: WaterScope }
  notes: string[]
}

const RANK: Record<DataQuality, number> = {
  measured: 3,
  'provider-reported': 2,
  'portal-estimated': 1,
  unknown: 0
}

/** 入力のうち最も弱いものが、結果の品質になる */
export function weakestQuality(...qs: DataQuality[]): DataQuality {
  return qs.reduce((a, b) => (RANK[b] < RANK[a] ? b : a), 'measured')
}

const unknown = (unit: string, reason: string): Quantity => ({
  unit,
  quality: 'unknown',
  basis: 'cannot be established',
  reason
})

const valid = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n >= 0

export function computeTransaction(
  input: TransactionInput
): TransactionFootprint {
  const { intervals, allocation } = input
  const notes: string[] = []
  const totalHours = intervals.reduce((a, i) => a + i.hours, 0)
  const averageShare =
    totalHours > 0
      ? intervals.reduce((a, i) => a + i.share * i.hours, 0) / totalHours
      : undefined

  // --- IT 電力量 ---
  let itEnergy: Quantity
  if (allocation === 'measured-per-job') {
    itEnergy = valid(input.measuredITEnergyKWh)
      ? {
          value: input.measuredITEnergyKWh,
          unit: 'kWh',
          quality: 'measured',
          basis: 'measured per job (no allocation applied)'
        }
      : unknown(
          'kWh',
          'allocation is measured-per-job but no measured energy was supplied'
        )
  } else if (intervals.some((i) => !valid(i.powerKW))) {
    itEnergy = unknown(
      'kWh',
      'pool power (kW) is missing for at least one interval'
    )
  } else if (
    intervals.some((i) => !valid(i.hours) || !(i.share >= 0 && i.share <= 1))
  ) {
    itEnergy = unknown(
      'kWh',
      'duration or compute share is missing or outside 0..1'
    )
  } else {
    const value = intervals.reduce(
      (a, i) => a + (i.powerKW as number) * i.hours * i.share,
      0
    )
    const full = intervals.every((i) => i.share === 1)
    itEnergy = {
      value,
      unit: 'kWh',
      // 割り振りを含む値は、元の電力が実測でも推定扱いにする
      quality:
        allocation === 'dedicated' && full
          ? input.powerQuality
          : weakestQuality(input.powerQuality, 'portal-estimated'),
      basis:
        allocation === 'dedicated'
          ? 'sum of pool power x duration (dedicated machine, share 100%)'
          : 'sum of pool power x duration x reserved compute share'
    }
  }

  // --- 施設電力量 ---
  const scope = input.powerScope ?? 'it-only'
  let facilityEnergy: Quantity
  if (scope === 'facility') {
    // 事業者の電力値に冷却が含まれる: そのまま施設電力量。IT 分は PUE があれば逆算
    facilityEnergy = {
      ...itEnergy,
      basis: itEnergy.basis + '; provider states cooling is included'
    }
    if (valid(itEnergy.value) && valid(input.pue) && input.pue >= 1) {
      itEnergy = {
        ...itEnergy,
        value: itEnergy.value / input.pue,
        quality: weakestQuality(
          itEnergy.quality,
          input.pueQuality ?? 'provider-reported'
        ),
        basis: 'facility energy / PUE (derived)'
      }
    } else if (itEnergy.value !== undefined) {
      itEnergy = unknown(
        'kWh',
        'power includes cooling and no PUE was given, so the IT-only part cannot be separated'
      )
    }
  } else if (!valid(itEnergy.value)) {
    facilityEnergy = unknown('kWh', itEnergy.reason ?? 'IT energy is unknown')
  } else if (!valid(input.pue) || input.pue < 1) {
    facilityEnergy = unknown(
      'kWh',
      'power is IT-only and no valid PUE (>= 1) was supplied, so cooling and overhead cannot be added'
    )
  } else {
    facilityEnergy = {
      value: itEnergy.value * input.pue,
      unit: 'kWh',
      quality: weakestQuality(
        itEnergy.quality,
        input.pueQuality ?? 'provider-reported'
      ),
      basis: `IT energy x PUE ${input.pue}`
    }
  }

  // --- 水 ---
  let water: Quantity
  let waterDefinition: TransactionFootprint['waterDefinition']
  const w = input.water
  if (!w) {
    water = unknown('L', 'no water figure (flow or WUE) was supplied')
  } else {
    waterDefinition = { kind: w.definition, scope: w.scope }
    if (w.kind === 'wue') {
      if (!valid(w.lPerKWh)) {
        water = unknown('L', 'WUE is not a valid number')
      } else if (!valid(itEnergy.value)) {
        water = unknown(
          'L',
          'WUE is per kWh of IT energy and the IT energy is unknown'
        )
      } else {
        water = {
          value: itEnergy.value * w.lPerKWh,
          unit: 'L',
          quality: weakestQuality(w.quality, itEnergy.quality),
          basis: `IT energy x provider-reported WUE ${w.lPerKWh} L/kWh${
            w.period ? ` (${w.period})` : ''
          }; an average, not this job's own water use`
        }
      }
    } else {
      const flows = intervals.map((i) => i.waterLPerHour ?? w.lPerHour)
      if (flows.some((q) => !valid(q))) {
        water = unknown(
          'L',
          'water flow (L/h) is missing for at least one interval'
        )
      } else {
        const value = intervals.reduce(
          (a, i, n) =>
            a + (flows[n] as number) * i.hours * (i.waterShare ?? i.share),
          0
        )
        water = {
          value,
          unit: 'L',
          // 割り振りは推定。実測の消費量とは呼ばない
          quality: weakestQuality(w.quality, 'portal-estimated'),
          basis:
            'water allocated by compute share (an accounting estimate, not measured consumption)'
        }
      }
    }
    if (w.definition === 'recirculating-flow') {
      notes.push(
        'The water figure is a recirculating flow. Recirculated water is not consumed, so this must not be read as consumption.'
      )
    }
    if (w.definition === 'unspecified' || w.scope === 'unspecified') {
      notes.push(
        'The provider did not say whether the water is withdrawal or consumption, or whether it is on-site or from electricity generation.'
      )
    }
  }

  // --- 炭素 ---
  let carbon: Quantity
  if (!input.grid) {
    carbon = unknown('gCO2e', 'no grid emission factor for this location')
  } else if (!valid(facilityEnergy.value)) {
    carbon = unknown(
      'gCO2e',
      facilityEnergy.reason ?? 'facility energy is unknown'
    )
  } else {
    carbon = {
      value: facilityEnergy.value * input.grid.gCO2ePerKWh,
      unit: 'gCO2e',
      quality: weakestQuality(facilityEnergy.quality, 'portal-estimated'),
      basis: `facility energy x grid factor ${input.grid.gCO2ePerKWh} gCO2e/kWh (location-based)`
    }
  }

  return {
    method: TRANSACTION_METHOD,
    allocation,
    intervals,
    averageShare,
    totalHours,
    itEnergy,
    facilityEnergy,
    water,
    carbon,
    waterDefinition,
    notes
  }
}

/** 区間が 1 つだけのときの簡便形 */
export function computeSingleInterval(
  interval: Interval,
  rest: Omit<TransactionInput, 'intervals'>
): TransactionFootprint {
  return computeTransaction({ ...rest, intervals: [interval] })
}

// ---------------------------------------------------------------------------
// 受領証 (transaction receipt)
// ---------------------------------------------------------------------------

/**
 * 計算に使った入力一式(ハッシュの対象)。
 * 事業者の識別子、場所、区間・電力・シェア・PUE・水・系統排出係数をすべて含む。
 * このオブジェクトを正規化した JSON(canonicalJson.ts)にして SHA-256 を取ったものが
 * 受領証の source.sha256。入力ファイルがあれば、誰でも同じ値を再計算できる。
 */
export interface TransactionSourceData {
  schema: 'clio-x-transaction-source/0.1'
  transactionId: string
  provider: string
  location: { name: string; jurisdiction: string }
  startedAtTime?: string
  endedAtTime?: string
  input: TransactionInput
}

export const SOURCE_SCHEMA = 'clio-x-transaction-source/0.1'
export const RECEIPT_SCHEMA = 'clio-x-transaction-receipt/0.2'
export const CANONICALIZATION = 'RFC 8785 (JCS)'

export function buildSourceData(params: {
  transactionId: string
  provider: string
  location: { name: string; jurisdiction: string }
  startedAtTime?: string
  endedAtTime?: string
  input: TransactionInput
}): TransactionSourceData {
  return {
    schema: SOURCE_SCHEMA,
    transactionId: params.transactionId,
    provider: params.provider,
    location: params.location,
    startedAtTime: params.startedAtTime,
    endedAtTime: params.endedAtTime,
    input: params.input
  }
}

/** 入力一式の SHA-256 (0x なしの 16 進 64 桁) */
export function sourceSha256(source: TransactionSourceData): string {
  return stripHexPrefix(canonicalSha256(source))
}

export interface TransactionReceipt {
  schema: typeof RECEIPT_SCHEMA
  transactionId: string
  parentTransactionId?: string
  provider: string
  location: { name: string; jurisdiction: string }
  startedAtTime?: string
  endedAtTime?: string
  allocation: {
    basis: AllocationBasis
    method: string
    averageShare?: number
    intervals: Interval[]
  }
  assumptions: {
    powerScope: PowerScope
    pue?: number
    pueQuality?: DataQuality
    powerQuality: DataQuality
    water?: {
      kind: WaterInput['kind']
      definition: WaterKind
      scope: WaterScope
      value?: number
      unit: string
    }
    gridIntensity?: GridIntensity
  }
  values: {
    itEnergy: Quantity
    facilityEnergy: Quantity
    water: Quantity
    carbon: Quantity
  }
  notes: string[]
  /** 元になったテレメトリ(事業者の計測系の識別子や URL)。無ければ空 */
  evidence: { ref: string; description: string }[]
  /** 計算に使った入力一式のハッシュ。入力ファイルから再計算できる */
  source: {
    schema: typeof SOURCE_SCHEMA
    sha256: string
    canonicalization: typeof CANONICALIZATION
  }
  /** 何を保証し、何を保証しないか。署名は別ファイル(署名付き受領証)に付く */
  integrity: {
    statement: string
  }
}

export function buildTransactionReceipt(params: {
  transactionId: string
  parentTransactionId?: string
  provider: string
  location: { name: string; jurisdiction: string }
  input: TransactionInput
  footprint: TransactionFootprint
  startedAtTime?: string
  endedAtTime?: string
  evidence?: { ref: string; description: string }[]
}): TransactionReceipt {
  const { input, footprint: f } = params
  const w = input.water
  return {
    schema: RECEIPT_SCHEMA,
    transactionId: params.transactionId,
    ...(params.parentTransactionId
      ? { parentTransactionId: params.parentTransactionId }
      : {}),
    provider: params.provider,
    location: params.location,
    startedAtTime: params.startedAtTime,
    endedAtTime: params.endedAtTime,
    allocation: {
      basis: f.allocation,
      method: TRANSACTION_METHOD_LABEL,
      averageShare: f.averageShare,
      intervals: f.intervals
    },
    assumptions: {
      powerScope: input.powerScope ?? 'it-only',
      pue: input.pue,
      pueQuality: input.pueQuality,
      powerQuality: input.powerQuality,
      water: w && {
        kind: w.kind,
        definition: w.definition,
        scope: w.scope,
        value: w.kind === 'wue' ? w.lPerKWh : w.lPerHour,
        unit: w.kind === 'wue' ? 'L/kWh' : 'L/h'
      },
      gridIntensity: input.grid
    },
    values: {
      itEnergy: f.itEnergy,
      facilityEnergy: f.facilityEnergy,
      water: f.water,
      carbon: f.carbon
    },
    notes: f.notes,
    evidence: params.evidence ?? [],
    source: {
      schema: SOURCE_SCHEMA,
      sha256: sourceSha256(buildSourceData(params)),
      canonicalization: CANONICALIZATION
    },
    integrity: {
      statement:
        'A signature over this receipt shows who issued it and that it was not altered afterwards. It does not show that the provider sensors or reported figures are accurate.'
    }
  }
}
