import {
  computeFootprint,
  resolveLocation,
  buildComputeReceipt,
  formatGCO2e,
  formatEnergy
} from './computeFootprint'

const env = (id: string, desc = '') => ({ id, desc })

describe('resolveLocation', () => {
  it('環境 id から所在地を解決する', () => {
    expect(resolveLocation(env('aws-ap-northeast-1-gpu'))?.regionCode).toBe(
      'ap-northeast-1'
    )
  })

  it('desc からも解決する', () => {
    expect(
      resolveLocation(env('env-01', 'AWS eu-north-1 GPU'))?.regionCode
    ).toBe('eu-north-1')
  })

  it('実機の description(2026-08-12 実測)を解決できる', () => {
    // Ocean Node が実際に返した文字列。id はハッシュ化されるので desc しか使えない。
    const real = {
      id: '0xff1004b67de08fc505fbf0a2089010d0f23015338c7def8557697513c4a39935-0xecc35ebf50612e7235b70b7d0c69ea761090059f5ad07f73d7858255532deef2',
      desc: 'AWS Stockholm (eu-north-1) g4dn.xlarge / NVIDIA T4'
    }
    const loc = resolveLocation(real)
    expect(loc?.regionCode).toBe('eu-north-1')
    expect(loc?.processingLocation).toBe('Stockholm, Sweden')
  })

  it('3.2.0 の description フィールドでも解決できる', () => {
    // Ocean Node 3.2.0 は desc ではなく description を返す。
    // 片方しか見ないと所在地不明に落ちる(実測で踏んだ)。
    const loc = resolveLocation({
      id: '0xabc-0xdef',
      description: 'AWS Stockholm (eu-north-1) g4dn.xlarge / NVIDIA T4'
    })
    expect(loc?.regionCode).toBe('eu-north-1')
  })

  it('対応が無ければ undefined を返す', () => {
    expect(
      resolveLocation(env('some-ocean-node', 'GPU cluster'))
    ).toBeUndefined()
  })
})

describe('computeFootprint', () => {
  it('所在地が未申告なら数値を出さず、理由を返す', () => {
    const fp = computeFootprint(env('unknown-node', 'GPU cluster'), 3600)
    expect(fp.quality).toBe('unknown')
    expect(fp.gCO2e).toBeUndefined()
    expect(fp.energyKWh).toBeUndefined()
    // 「所在地の欄が無い」という構造的欠落を理由として明示していること
    expect(fp.reason).toContain('所在地')
  })

  it('東京: 1時間 72W PUE1.0 → 0.072 kWh / 429 g/kWh ≒ 30.9 gCO2e', () => {
    const fp = computeFootprint(env('aws-ap-northeast-1'), 3600)
    expect(fp.energyKWh).toBeCloseTo(0.072, 4)
    expect(fp.gCO2e).toBeCloseTo(0.072 * 429, 2)
    expect(fp.usdCost).toBeCloseTo(1.1672, 4)
    // 電力が推定なので全体も推定に落ちること
    expect(fp.quality).toBe('portal-estimated')
  })

  it('系統の比は 429 / 21.3 ≒ 20.1 倍（ハードとは独立の量）', () => {
    // 2026-08-12 のファクトチェックで係数を全面改訂した。
    // 旧値(SE 18 / JP 446)は出典に存在しない値だった。
    const tokyo = computeFootprint(env('aws-ap-northeast-1'), 3600)
    const stockholm = computeFootprint(env('aws-eu-north-1'), 3600)
    expect(tokyo.grid.gCO2ePerKWh / stockholm.grid.gCO2ePerKWh).toBeCloseTo(
      429 / 21.3,
      1
    )
  })

  it('係数には方法論(LCA / 直接排出)が出典に書かれている', () => {
    // LCA ベースと直接排出ベースを同じ列で比べると、水力・原子力が多い地域ほど
    // 不利に出る。混在させる以上、出典に方法論を残しておく必要がある。
    const se = computeFootprint(env('aws-eu-north-1'), 3600)
    const jp = computeFootprint(env('aws-ap-northeast-1'), 3600)
    expect(se.grid.source).toMatch(/LCA|ライフサイクル/)
    expect(jp.grid.source).toMatch(/直接排出/)
  })

  it('総排出はストックホルムが大幅に小さい（系統とハードの両方が効く）', () => {
    const tokyo = computeFootprint(env('aws-ap-northeast-1'), 3600)
    const stockholm = computeFootprint(env('aws-eu-north-1'), 3600)
    expect(stockholm.gCO2e).toBeLessThan(tokyo.gCO2e)
    // 東京は L4 72W(推定) / ストックホルムは T4 32.8W(実測) なので
    // 系統比 20.1 倍より更に開く。桁で押さえる。
    expect(tokyo.gCO2e / stockholm.gCO2e).toBeGreaterThan(15)
  })

  it('ストックホルムの電力は実測値を使っている', () => {
    const fp = computeFootprint(env('aws-eu-north-1'), 3600)
    expect(fp.power?.quality).toBe('measured')
    expect(fp.quality).toBe('measured')
  })

  it('ストックホルムは東京より費用も安い(価格と炭素が同方向に動く例)', () => {
    const tokyo = computeFootprint(env('aws-ap-northeast-1'), 3600)
    const stockholm = computeFootprint(env('aws-eu-north-1'), 3600)
    expect(stockholm.usdCost).toBeLessThan(tokyo.usdCost)
  })

  it('PUE は線形に効く', () => {
    const a = computeFootprint(env('aws-eu-north-1'), 3600, 1.0)
    const b = computeFootprint(env('aws-eu-north-1'), 3600, 1.5)
    expect(b.gCO2e / a.gCO2e).toBeCloseTo(1.5, 5)
  })

  it('mdx は電力プロファイルが無いので炭素を出さない', () => {
    const fp = computeFootprint(env('mdx-gpu-pack'), 3600)
    expect(fp.location?.jurisdiction).toBe('Japan')
    expect(fp.grid).toBeDefined()
    expect(fp.gCO2e).toBeUndefined()
    expect(fp.quality).toBe('unknown')
    expect(fp.reason).toContain('消費電力')
  })

  it('モックの「カナダ = 低炭素」という誤読を、実データで反証できる', () => {
    // Clio-X モックの事業者は Calgary, Alberta。
    // モックは "Canadian sovereign compute = Verified" と PUE 1.21 を並べるが、
    // Alberta の系統は 335 g/kWh で、同じカナダの Montreal (34.5) の約10倍。
    const calgary = computeFootprint(env('agrifoodtef-ai-data-room'), 3600)
    const montreal = computeFootprint(env('aws-ca-central-1'), 3600)

    expect(calgary.location?.jurisdiction).toBe('Canada')
    expect(montreal.location?.jurisdiction).toBe('Canada')
    // 同じ「カナダ」でも系統は約10倍違う
    expect(calgary.grid.gCO2ePerKWh / montreal.grid.gCO2ePerKWh).toBeCloseTo(
      335 / 34.5,
      1
    )
    // ただし Alberta は直接排出ベース、Quebec は LCA ベース。
    // 方法論が違うものを割っている点は、比較時に必ず断ること。
    // 事業者申告の PUE が既定値として効いていること
    expect(calgary.pue).toBe(1.21)
    expect(calgary.location?.reportedWaterLPerKWh).toBe(0.36)
  })

  it('系統排出係数が未登録のリージョンでは炭素を出さないが費用は出す', () => {
    const fp = computeFootprint(env('aws-us-west-2'), 3600)
    // us-west-2 は係数登録済みなので、ここでは費用と炭素の両方が出る
    expect(fp.usdCost).toBeCloseTo(0.8048, 4)
    expect(fp.gCO2e).toBeGreaterThan(0)
    // Oregon は eGRID2023 の州係数 166。以前の 440 は
    // 「州内ハイパースケールDCへ供給する balancing authority ベースの帰属排出強度」
    // であって州の系統係数ではなかった(約2.7倍の過大)。
    expect(fp.grid.gCO2ePerKWh).toBe(166)
  })
})

describe('buildComputeReceipt', () => {
  it('quality と出典を落とさずに受領証を組み立てる', () => {
    const e = env('aws-ap-northeast-1')
    const fp = computeFootprint(e, 3600)
    const receipt = buildComputeReceipt({
      env: e,
      footprint: fp,
      jobId: 'job-123',
      datasetDID: 'did:op:dataset',
      algorithmDID: 'did:op:algo'
    })

    expect(receipt.type).toBe('prov:Activity')
    expect(receipt.wasAssociatedWith.jurisdiction).toBe('Japan')
    expect(receipt.footprint.quality).toBe('portal-estimated')
    expect(receipt.footprint.gridIntensity?.source).toBeTruthy()
    expect(receipt.methodology.carbonAccounting).toBe('location-based')
    // CPU 非計測であることが受領証に残っていること
    expect(receipt.methodology.notes.join(' ')).toContain('CPU')
    // 「真正性は保証しない」という但し書きが消えていないこと
    expect(receipt.methodology.notes.join(' ')).toContain('真正性を保証しない')
  })

  it('算出不可のときも理由を receipt に残す', () => {
    const e = env('unknown-node')
    const fp = computeFootprint(e, 3600)
    const receipt = buildComputeReceipt({ env: e, footprint: fp })
    expect(receipt.footprint.quality).toBe('unknown')
    expect(receipt.footprint.gCO2e).toBeUndefined()
    expect(receipt.footprint.reason).toBeTruthy()
  })
})

describe('formatters', () => {
  it('gCO2e の単位を桁で切り替える', () => {
    expect(formatGCO2e(undefined)).toBe('—')
    expect(formatGCO2e(0.5)).toBe('500 mgCO2e')
    expect(formatGCO2e(32.1)).toBe('32.1 gCO2e')
    expect(formatGCO2e(2700)).toBe('2.70 kgCO2e')
  })

  it('エネルギーの単位を桁で切り替える', () => {
    expect(formatEnergy(undefined)).toBe('—')
    expect(formatEnergy(0.072)).toBe('72.0 Wh')
    expect(formatEnergy(5)).toBe('5.000 kWh')
  })
})
