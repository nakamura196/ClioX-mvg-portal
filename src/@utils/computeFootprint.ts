/**
 * 計算ジョブの費用とカーボンフットプリントを、Ocean の ComputeEnvironment から
 * 見積もるためのプロトタイプ実装。
 *
 * 設計方針(重要):
 *
 * 1. 推定値を実測値のように見せない。
 *    すべての数値に quality: 'measured' | 'estimated' | 'unknown' を付ける。
 *    根拠が無い場合は 0 や既定値で埋めず、undefined を返して理由(reason)を書く。
 *    ここを曖昧にすると、トークン化カーボンクレジットと同じ失敗(検証経路の無い
 *    数値が権威を持ってしまう)を繰り返すことになる。
 *
 * 2. 単位は SCI (ISO/IEC 21031:2024) の考え方に合わせ、総量ではなく
 *    「機能単位あたりの率」を出せる形にしておく(ここではジョブ1件あたり)。
 *
 * 3. 系統排出係数は location-based のみを使う。market-based(REC/PPA を反映し、
 *    購入済みリージョンを 0 と表示するもの)は物理的な排出を表さないので使わない。
 *
 * 既知の構造的限界:
 *    Ocean の ComputeEnvironment 型は
 *      id / cpuNumber / cpuType / gpuNumber / gpuType / ramGB / diskGB /
 *      priceMin / desc / currentJobs / maxJobs / consumerAddress /
 *      storageExpiry / maxJobDuration / lastSeen
 *    のみで構成され、**計算がどこで物理的に行われるかを表す欄が存在しない**。
 *    したがって所在地はこのファイルのレジストリで外挿するしかない。
 *    これはプロトタイプの都合ではなく、プロトコル側のスキーマの欠落である。
 */

/**
 * 数値の出所。Clio-X のモックアップ(2026-08-11, V. Lemieux)が使っている
 * "Provider-reported" / "Portal-estimated" の語彙に合わせつつ、
 * 第三者が再現できる実測を最上位として区別する。
 *
 *   measured          … こちらで実測した (例: nvidia-smi の power.draw)
 *   provider-reported … 事業者の自己申告。検証経路は無い
 *   portal-estimated  … ポータル側の推定計算
 *   unknown           … 根拠が無いので数値を出さない
 */
export type DataQuality =
  | 'measured'
  | 'provider-reported'
  | 'portal-estimated'
  | 'unknown'

export interface GridIntensity {
  /** location-based の系統排出係数 (gCO2e/kWh) */
  gCO2ePerKWh: number
  label: string
  asOf: string
  source: string
}

export interface PowerProfile {
  /** インスタンス全体の平均消費電力 (W) */
  watts: number
  quality: DataQuality
  source: string
}

export interface ComputeLocation {
  provider: string
  regionCode: string
  label: string
  /** 物理的な処理地。モックの "Processing location" に対応 */
  processingLocation: string
  /** 法域。国外に出せない資料の判定に使う */
  jurisdiction: string
  /** オンデマンド時間単価 (USD/h)。不明なら undefined */
  usdPerHour?: number
  /** 電力プロファイルのキー */
  powerProfile?: string
  /** 事業者申告の PUE。検証経路は無いので provider-reported 扱い */
  reportedPUE?: number
  /** 事業者申告の水効率 (L/kWh) */
  reportedWaterLPerKWh?: number
  /** 上記申告値の測定期間・レビュー日 */
  reportedAsOf?: string
}

export interface Footprint {
  location?: ComputeLocation
  grid?: GridIntensity
  power?: PowerProfile
  durationSeconds: number
  pue: number
  energyKWh?: number
  gCO2e?: number
  usdCost?: number
  quality: DataQuality
  /** quality が 'unknown' のとき、なぜ出せないのかを人間可読で書く */
  reason?: string
}

/**
 * 系統排出係数 (location-based)。
 * 値を入れるのは出典を確認できたものだけ。未確認のリージョンは意図的に空にする。
 */
const GRID: Record<string, GridIntensity> = {
  // 【2026-08-12 ファクトチェックで全面改訂】
  // 当初の値は出典と一致していなかった(SE 18 / BC 14 / OR 440 / JP 446 は
  // いずれも出典に存在しないか、別の意味の数値だった)。
  //
  // 残る既知の弱点: 下記は**方法論が揃っていない**。
  //   Electricity Maps と Hydro-Québec は LCA ベース、
  //   州政府・eGRID・日本の温対法係数は発電時の直接排出ベース。
  //   LCA と直接排出を同じ列で比べると、水力・原子力が多い地域ほど不利に出る。
  //   basis に方法論を明記してあるので、比較時は必ず参照すること。
  'eu-north-1': {
    gCO2ePerKWh: 21.3,
    label: 'Sweden (Stockholm)',
    asOf: '2025',
    source:
      'Electricity Maps, Grid in Review 2025 — flow-traced(消費ベース、輸入込み)。同ページの production-based は 19.0。LCA ベース'
  },
  'ca-central-1': {
    gCO2ePerKWh: 34.5,
    label: 'Canada, Quebec (Montreal)',
    asOf: '年次記載なし / no vintage stated',
    source:
      'Hydro-Québec 公表値。発電・送電・配電のライフサイクル(LCA)ベース。同社ページに年次の記載が無い'
  },
  'us-west-2': {
    gCO2ePerKWh: 166,
    label: 'US, Oregon',
    asOf: '2023',
    source:
      'EPA eGRID2023 State Output Emission Rates (CO2e 365.0 lb/MWh)。発電時の直接排出ベース'
  },
  'ap-northeast-1': {
    gCO2ePerKWh: 429,
    label: 'Japan (national substitute factor)',
    asOf: 'R5年度実績 / FY2023',
    source:
      '環境省・経産省「電気事業者別排出係数」の代替値 0.000429 t-CO2/kWh。発電時の直接排出ベース。IEA ベースの日本の発電炭素強度(2023)は約 485'
  },
  'ca-alberta': {
    gCO2ePerKWh: 335,
    label: 'Canada, Alberta (Calgary)',
    asOf: '2024',
    source:
      'Alberta 州政府。発電時の直接排出ベース。2005年 907 → 2019年 629 → 2024年 335'
  },
  'jp-national': {
    gCO2ePerKWh: 429,
    label: 'Japan (national substitute factor)',
    asOf: 'R5年度実績 / FY2023',
    source:
      '環境省・経産省の代替値 0.000429 t-CO2/kWh。特定サイトの電力契約の実係数ではない'
  }
  // 参考(AWS リージョン外): British Columbia は BC 州政府の Integrated Grid で
  //   2021: 9.7 / 2022: 11.5 / 2023: 11.3 / 2024: 9.9 / 2025: 22.8 gCO2e/kWh。
  //   「14」という値はどの年にも存在しない。2025年に約2倍へ上昇している点に注意。
  // 未確認のため未登録: us-east-1 / eu-west-1
}

/**
 * 電力プロファイル。
 * measured は実機で採取した値のみ。それ以外は必ず estimated / unknown にする。
 */
const POWER: Record<string, PowerProfile> = {
  'aws-g4dn.xlarge-idle': {
    watts: 27.7,
    quality: 'measured',
    source:
      'EC2 g4dn.xlarge / Tesla T4 / nvidia-smi power.draw 実測 (2026-08-12). アイドル時。上限 70W'
  },
  // 実機で採取した値。アイドル 27.7W / 負荷時ピーク 33.4W(2026-08-12, eu-north-1)。
  // 平均を採ると 30W 前後だが、負荷が軽いジョブでの値である点は source に残す。
  'aws-g4dn.xlarge-measured': {
    watts: 32.8,
    quality: 'measured',
    source:
      'EC2 g4dn.xlarge / Tesla T4 / ジョブコンテナ内 nvidia-smi の実測平均 (2026-08-12, 15秒×1Hz)。上限70W。負荷が軽い区間の値'
  },
  'aws-g4dn.xlarge': {
    watts: 70,
    quality: 'portal-estimated',
    source:
      'T4 の power.limit=70W を上限として仮置き。負荷時の実測は未取得(DLAMI Base に PyTorch が無く負荷試験ができなかった)'
  },
  'aws-g6.xlarge': {
    watts: 72,
    quality: 'portal-estimated',
    source: 'NVIDIA L4 の TDP 72W からの仮置き。実測ではない'
  },
  'nvidia-l40s': {
    watts: 350,
    quality: 'portal-estimated',
    source: 'NVIDIA L40S の TDP 350W からの仮置き。実測ではない'
  }
}

/**
 * ComputeEnvironment を物理的な所在地に対応づけるレジストリ。
 *
 * Ocean の型に所在地の欄が無いため、ここで外挿する。
 * キーは desc / id に含まれる部分文字列(英数字のみに正規化して比較)。
 *
 * 重要(2026-08-12 実測): Ocean Node は環境 id を
 *   "0xff1004b6…-0xecc35ebf…" のようにハッシュ化して公開する。
 * 設定ファイルに書いた "aws-eu-north-1-gpu" という id はポータルには届かない。
 * したがって**照合できるのは description だけ**であり、
 * かつ description は "AWS Stockholm (eu-north-1) …" のように
 * 語順が任意なので、マッチキーは**リージョンコード単体**にしてある。
 * 対応が無い環境は「所在地不明」として扱い、炭素は出さない。
 */
const ENV_LOCATIONS: { match: string; location: ComputeLocation }[] = [
  {
    match: 'eu-north-1',
    location: {
      provider: 'AWS',
      regionCode: 'eu-north-1',
      label: 'AWS Stockholm',
      processingLocation: 'Stockholm, Sweden',
      jurisdiction: 'EU (Sweden)',
      // 実際に建てたのは g4dn.xlarge (Tesla T4)。g6.xlarge($0.8536) ではない。
      usdPerHour: 0.558,
      powerProfile: 'aws-g4dn.xlarge-measured'
    }
  },
  {
    match: 'ca-central-1',
    location: {
      provider: 'AWS',
      regionCode: 'ca-central-1',
      label: 'AWS Montreal',
      processingLocation: 'Montreal, Quebec, Canada',
      jurisdiction: 'Canada',
      usdPerHour: 0.8936,
      powerProfile: 'aws-g6.xlarge'
    }
  },
  {
    match: 'ap-northeast-1',
    location: {
      provider: 'AWS',
      regionCode: 'ap-northeast-1',
      label: 'AWS Tokyo',
      processingLocation: 'Tokyo, Japan',
      jurisdiction: 'Japan',
      usdPerHour: 1.1672,
      powerProfile: 'aws-g6.xlarge'
    }
  },
  {
    match: 'us-west-2',
    location: {
      provider: 'AWS',
      regionCode: 'us-west-2',
      label: 'AWS Oregon',
      processingLocation: 'Oregon, United States',
      jurisdiction: 'United States',
      usdPerHour: 0.8048,
      powerProfile: 'aws-g6.xlarge'
    }
  },
  {
    match: 'mdx',
    location: {
      provider: 'mdx',
      regionCode: 'jp-national',
      label: 'mdx (東京大学情報基盤センター)',
      processingLocation: '柏Ⅱキャンパス, 千葉, 日本',
      jurisdiction: 'Japan',
      // 50 ポイント/時間 = 50円/時間。USD 換算は為替に依存するため入れない。
      powerProfile: undefined
    }
  },
  {
    /**
     * カナダ国内の計算提供者。PUE と水効率は事業者申告で、検証経路は無い。
     *
     * 登録してあるのは、**同じ「カナダ」でも系統排出係数が一桁違う**ことを
     * 実データで示せるようにするため。Alberta は 335 gCO2e/kWh、Quebec は 34.5、
     * BC は年次で 9.7〜22.8(2025年は 22.8)。国名だけでは炭素の多寡は決まらない。
     */
    match: 'agrifoodtef',
    location: {
      provider: 'AgrifoodTEF',
      regionCode: 'ca-alberta',
      label: 'AgrifoodTEF AI Data Room',
      processingLocation: 'Calgary, Alberta, Canada',
      jurisdiction: 'Canada',
      powerProfile: 'nvidia-l40s',
      reportedPUE: 1.21,
      reportedWaterLPerKWh: 0.36,
      reportedAsOf: '2025 annual facility average (provider-reported)'
    }
  }
]

/**
 * 実環境の id / desc は表記が揺れる("AWS eu-north-1" / "aws-eu-north-1" /
 * "AWS_EU_NORTH_1" など)。英数字以外を落として比較することで、
 * 区切り文字の違いだけで所在地の解決に失敗するのを防ぐ。
 */
function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function resolveLocationFromText(
  text: string
): ComputeLocation | undefined {
  const haystack = normalizeForMatch(text || '')
  if (!haystack) return undefined
  return ENV_LOCATIONS.find((e) =>
    haystack.includes(normalizeForMatch(e.match))
  )?.location
}

/**
 * 実行環境から所在地を解決する。
 *
 * 注意(2026-08-12 実測): Ocean Node 3.2.0 は説明文を `description` で返し、
 * 3.1.3 は `desc` で返す。片方しか見ないと文字列が空になり、
 * 「所在地不明」に落ちる。両方を見る。
 */
export function resolveLocation(
  env: Partial<Pick<ComputeEnvironmentExtended, 'id' | 'desc'>> & {
    description?: string
  }
): ComputeLocation | undefined {
  const text = `${env.id || ''} ${env.desc || ''} ${env.description || ''}`
  return resolveLocationFromText(text)
}

/**
 * 完了済みジョブから所在地を解決する。
 *
 * 注意(2026-08-19 訂正): 当初「ComputeJob には実行環境への参照が無い」と書いていたが、
 * これは誤りだった。**ocean-node は environment を送っている** —— 上流の ComputeJob 型には
 * `environment?: string` があり、omitDBComputeFieldsFromComputeJob の削除リストにも
 * 含まれていない。落としているのは **ocean.js 側の型定義**で、3.1.3 にも main にも
 * ComputeJob.environment が無いため、クライアントが読めていない。
 *
 * したがって本来は job.environment から実行環境を引くべきで、この providerUrl からの
 * 解決は暫定の回避策である。**ネットワークアドレスは物理的な所在地ではない**ため、
 * ここでの解決は「URL からの推測」でしかなく、その旨を呼び出し側で明示すること。
 */
export function resolveLocationFromJob(job: { providerUrl?: string }): {
  location?: ComputeLocation
  inferredFrom?: string
} {
  if (!job.providerUrl) return {}
  const location = resolveLocationFromText(job.providerUrl)
  return location ? { location, inferredFrom: job.providerUrl } : {}
}

/** ジョブの実占有時間(秒)。dateCreated / dateFinished は unix 秒 */
export function jobDurationSeconds(job: {
  dateCreated?: string
  dateFinished?: string
}): number | undefined {
  const start = Number(job.dateCreated)
  const end = Number(job.dateFinished)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return undefined
  const d = end - start
  return d > 0 ? d : undefined
}

/**
 * ジョブ1件のフットプリントを見積もる。
 *
 * @param env          対象の実行環境
 * @param durationSeconds ジョブの占有時間(秒)。実績が無ければ maxJobDuration を渡す
 * @param pue          データセンタの PUE。既定 1.0 は「施設側オーバーヘッドを
 *                     含まない下限値」であり、実際の値ではない
 */
export function computeFootprint(
  env: Partial<Pick<ComputeEnvironmentExtended, 'id' | 'desc'>> & {
    description?: string
  },
  durationSeconds: number,
  pueOverride?: number
): Footprint {
  const location = resolveLocation(env)
  // 事業者が PUE を申告していればそれを使う。無ければ 1.0(= 施設側
  // オーバーヘッド未計上の下限値)。呼び出し側が明示した値が最優先。
  const pue = pueOverride ?? location?.reportedPUE ?? 1.0
  const base: Footprint = { durationSeconds, pue, quality: 'unknown' }
  if (!location) {
    return {
      ...base,
      reason:
        'この実行環境は物理的な所在地を申告していない。Ocean の ComputeEnvironment に所在地の欄が無いため、炭素排出量を算出できない。'
    }
  }

  const grid = GRID[location.regionCode]
  const power = location.powerProfile ? POWER[location.powerProfile] : undefined

  const hours = durationSeconds / 3600
  const usdCost =
    location.usdPerHour != null ? location.usdPerHour * hours : undefined

  if (!grid) {
    return {
      ...base,
      location,
      power,
      usdCost,
      reason: `リージョン ${location.regionCode} の系統排出係数が未確認のため、炭素排出量を算出できない。`
    }
  }
  if (!power) {
    return {
      ...base,
      location,
      grid,
      usdCost,
      reason:
        'この環境の消費電力が未取得のため、炭素排出量を算出できない。実測してから登録すること。'
    }
  }

  const energyKWh = (power.watts / 1000) * hours * pue
  const gCO2e = energyKWh * grid.gCO2ePerKWh

  return {
    location,
    grid,
    power,
    durationSeconds,
    pue,
    energyKWh,
    gCO2e,
    usdCost,
    // 全体の確からしさは、最も弱い構成要素に引きずられる。
    // 電力が推定なら全体は推定。
    quality: power.quality === 'measured' ? 'measured' : 'portal-estimated'
  }
}

/**
 * 計算受領証。
 *
 * これはブロックチェーンに書けば真になる類のものではない。
 * 保証できるのは「誰が・いつ・何を主張したか」であって、主張された数値の真偽ではない
 * (オラクル問題)。古文書学の語彙で言えば、これは fact の証明ではなく
 * 「主張という act の真正な記録」である。
 *
 * したがって:
 *   - 全数値に quality を残す
 *   - 出典を消さない
 *   - オンチェーンに載せるのはこの JSON のハッシュのみとし、本体はオフチェーンに置く
 */
export interface ComputeReceipt {
  '@context': string[]
  type: string
  jobId?: string
  activity: {
    startedAtTime?: string
    endedAtTime?: string
    durationSeconds: number
  }
  used: {
    datasetDID?: string
    algorithmDID?: string
  }
  wasAssociatedWith: {
    computeEnvId: string
    computeEnvDesc?: string
    provider?: string
    regionCode?: string
    jurisdiction?: string
  }
  footprint: {
    energyKWh?: number
    gCO2e?: number
    usdCost?: number
    pue: number
    quality: DataQuality
    reason?: string
    gridIntensity?: GridIntensity
    powerProfile?: PowerProfile
  }
  /** 計上方法。SCI は率(機能単位あたり)を定義する規格である */
  methodology: {
    standard: string
    scope: string
    carbonAccounting: 'location-based'
    functionalUnit: string
    notes: string[]
  }
}

export function buildComputeReceipt(params: {
  env: Partial<Pick<ComputeEnvironmentExtended, 'id' | 'desc'>> & {
    description?: string
  }
  footprint: Footprint
  jobId?: string
  datasetDID?: string
  algorithmDID?: string
  startedAtTime?: string
  endedAtTime?: string
}): ComputeReceipt {
  const { env, footprint, jobId, datasetDID, algorithmDID } = params
  return {
    '@context': [
      'https://www.w3.org/ns/prov#',
      'https://greensoftware.foundation/sci'
    ],
    type: 'prov:Activity',
    jobId,
    activity: {
      startedAtTime: params.startedAtTime,
      endedAtTime: params.endedAtTime,
      durationSeconds: footprint.durationSeconds
    },
    used: { datasetDID, algorithmDID },
    wasAssociatedWith: {
      computeEnvId: env.id,
      computeEnvDesc: env.desc || env.description,
      provider: footprint.location?.provider,
      regionCode: footprint.location?.regionCode,
      jurisdiction: footprint.location?.jurisdiction
    },
    footprint: {
      energyKWh: footprint.energyKWh,
      gCO2e: footprint.gCO2e,
      usdCost: footprint.usdCost,
      pue: footprint.pue,
      quality: footprint.quality,
      reason: footprint.reason,
      gridIntensity: footprint.grid,
      powerProfile: footprint.power
    },
    methodology: {
      standard: 'ISO/IEC 21031:2024 (Software Carbon Intensity)',
      scope: 'operational only (embodied carbon は範囲外)',
      carbonAccounting: 'location-based',
      functionalUnit: '1 compute job',
      notes: [
        'CPU の電力は仮想化ゲストから測定できないため含まれていない (RAPL 非露出)。',
        'この受領証は数値の真正性を保証しない。保証するのは主張の帰属と非改竄性のみ。',
        'オンチェーンに載せる場合はこの JSON のハッシュのみとし、本体はオフチェーンに置く。'
      ]
    }
  }
}

/** 表示用の整形。単位を跨ぐので桁を揃えすぎない */
export function formatGCO2e(g?: number): string {
  if (g == null) return '—'
  if (g < 1) return `${(g * 1000).toFixed(0)} mgCO2e`
  if (g < 1000) return `${g.toFixed(1)} gCO2e`
  return `${(g / 1000).toFixed(2)} kgCO2e`
}

export function formatEnergy(kWh?: number): string {
  if (kWh == null) return '—'
  if (kWh < 0.001) return `${(kWh * 1e6).toFixed(0)} mWh`
  if (kWh < 1) return `${(kWh * 1000).toFixed(1)} Wh`
  return `${kWh.toFixed(3)} kWh`
}
