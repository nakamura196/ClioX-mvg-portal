/**
 * 実行場所を選び、その選択を記録する試作 (a)+(b)。
 *
 * (a) 同じ仕事を登録済みのすべての場所で見積もり、排出の少ない順に並べる。
 * (b) 選んだ場所と、そのとき比べた候補を JSON の記録にまとめる。
 *     その SHA-256 を、移転できないトークン (CarbonChoiceRecord, ERC-5192) として
 *     Sepolia に書く。コントラクトは contracts/carbon-choice/。
 *
 * 記録は「誰が・いつ・何を選んだと主張したか」の証拠であって、
 * 排出を減らしたことの証明ではない。値はポータルの見積もりで、誰も検証していない。
 * そのため「削減量」という言葉は使わず、「最も多い候補との差」とだけ書く。
 */
import {
  DataQuality,
  Footprint,
  computeFootprintForKey,
  listKnownLocations
} from './computeFootprint'

/** Sepolia に配った CarbonChoiceRecord (2026-09-30, tx 0x547d3a09…) */
export const CARBON_CHOICE_ADDRESS =
  process.env.NEXT_PUBLIC_CARBON_CHOICE_ADDRESS ||
  '0x5919f54c6b36f3543eEe5f94133Ec8c58637F258'
export const CARBON_CHOICE_CHAIN_ID = 11155111

export const CARBON_CHOICE_ABI = [
  'function record(bytes32 recordHash, string locationKey, uint64 chosenMgCO2e, uint64 highestMgCO2e, uint32 alternatives, uint8 quality) returns (uint256)',
  'function tokensOf(address holder) view returns (uint256[])',
  'function getRecord(uint256 tokenId) view returns (tuple(bytes32 recordHash, uint64 chosenMgCO2e, uint64 highestMgCO2e, uint32 alternatives, uint8 quality, uint40 issuedAt, string locationKey))',
  'event ChoiceRecorded(uint256 indexed tokenId, address indexed holder, bytes32 indexed recordHash, string locationKey, uint64 chosenMgCO2e, uint64 highestMgCO2e)'
]

export interface ChoiceOption {
  key: string
  footprint: Footprint
}

export interface ChoicePlan {
  jobs: number
  minutesPerJob: number
  durationSeconds: number
  /** 排出を見積もれた候補。少ない順 */
  ranked: ChoiceOption[]
  /** 見積もれない候補。順位に入れない */
  unranked: ChoiceOption[]
}

export function planChoice(jobs: number, minutesPerJob: number): ChoicePlan {
  const j = Number.isFinite(jobs) ? Math.max(0, jobs) : 0
  const m = Number.isFinite(minutesPerJob) ? Math.max(0, minutesPerJob) : 0
  const durationSeconds = j * m * 60
  const all = listKnownLocations().map((k) => ({
    key: k.key,
    footprint: computeFootprintForKey(k.key, durationSeconds)
  }))
  return {
    jobs: j,
    minutesPerJob: m,
    durationSeconds,
    ranked: all
      .filter((o) => o.footprint.gCO2e != null)
      .sort((a, b) => a.footprint.gCO2e - b.footprint.gCO2e),
    unranked: all.filter((o) => o.footprint.gCO2e == null)
  }
}

/** コントラクトの品質コード。'unknown' は記録できない */
export const QUALITY_CODE: Partial<Record<DataQuality, number>> = {
  measured: 0,
  'provider-reported': 1,
  'portal-estimated': 2
}
export const QUALITY_FROM_CODE: DataQuality[] = [
  'measured',
  'provider-reported',
  'portal-estimated'
]

export function toMg(g: number): number {
  return Math.round(g * 1000)
}

export interface ChoiceRecordArgs {
  locationKey: string
  chosenMgCO2e: number
  highestMgCO2e: number
  alternatives: number
  quality: number
}

/**
 * 選択の記録 (JSON) とコントラクトへの引数を作る。
 * 選べるのは排出を見積もれた候補だけ。そうでなければ undefined。
 */
export function buildChoiceRecord(params: {
  plan: ChoicePlan
  chosenKey: string
  purpose: string
  now?: Date
}):
  | { record: object; args: ChoiceRecordArgs; differenceG: number }
  | undefined {
  const { plan, chosenKey } = params
  const chosen = plan.ranked.find((o) => o.key === chosenKey)
  if (!chosen) return undefined
  const highest = plan.ranked[plan.ranked.length - 1]
  const quality = QUALITY_CODE[chosen.footprint.quality]
  if (quality == null) return undefined

  const option = (o: ChoiceOption) => ({
    key: o.key,
    provider: o.footprint.location?.provider,
    regionCode: o.footprint.location?.regionCode,
    processingLocation:
      o.footprint.location?.en?.processingLocation ??
      o.footprint.location?.processingLocation,
    energyKWh: o.footprint.energyKWh ?? null,
    gCO2e: o.footprint.gCO2e ?? null,
    usdCost: o.footprint.usdCost ?? null,
    quality: o.footprint.quality,
    gridSource: o.footprint.grid?.sourceEn ?? o.footprint.grid?.source ?? null,
    powerSource:
      o.footprint.power?.sourceEn ?? o.footprint.power?.source ?? null,
    reason: o.footprint.reason ?? null
  })

  const record = {
    '@context': {
      prov: 'http://www.w3.org/ns/prov#',
      cliox: 'https://cliox-docs.ldas.jp/ns/carbon-choice#'
    },
    type: 'cliox:CarbonChoiceRecord',
    version: 1,
    statement:
      'The holder chose where to run the analysis. Figures are the portal’s planning estimates from published grid factors and power profiles. They are not measured for this job, not verified by anyone, and not a certified emission reduction.',
    'prov:generatedAtTime': (params.now ?? new Date()).toISOString(),
    purpose: params.purpose,
    workload: {
      jobs: plan.jobs,
      minutesPerJob: plan.minutesPerJob,
      durationSeconds: plan.durationSeconds,
      assumption: 'Same run time assumed on every machine; real GPUs differ.'
    },
    method:
      'energy = power × duration × PUE; emissions = energy × location-based grid factor. Unit follows ISO/IEC 21031 (SCI); offsets are not counted.',
    chosen: option(chosen),
    comparedWith: plan.ranked.map(option),
    notComparable: plan.unranked.map(option),
    differenceFromHighest: {
      gCO2e: highest.footprint.gCO2e - chosen.footprint.gCO2e,
      highestKey: highest.key,
      note: 'A difference between estimates, not a reduction against a baseline.'
    }
  }

  return {
    record,
    differenceG: highest.footprint.gCO2e - chosen.footprint.gCO2e,
    args: {
      locationKey: chosen.key,
      chosenMgCO2e: toMg(chosen.footprint.gCO2e),
      highestMgCO2e: toMg(highest.footprint.gCO2e),
      alternatives: plan.ranked.length,
      quality
    }
  }
}

/** 記録の JSON 文字列。ハッシュはこの文字列に対して取る */
export function choiceRecordToText(record: object): string {
  return JSON.stringify(record, null, 2) + '\n'
}
