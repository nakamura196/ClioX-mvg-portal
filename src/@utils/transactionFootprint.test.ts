import {
  buildTransactionReceipt,
  computeSingleInterval,
  computeTransaction,
  TransactionInput,
  TRANSACTION_METHOD_LABEL
} from './transactionFootprint'

// 参照用の計算例: 90 s (0.025 h), シェア 25%, 4 kW, 12 L/h
const worked: TransactionInput = {
  intervals: [{ powerKW: 4, hours: 0.025, share: 0.25 }],
  allocation: 'reserved-share',
  powerQuality: 'provider-reported',
  pue: 1,
  pueQuality: 'provider-reported',
  water: {
    kind: 'flow',
    lPerHour: 12,
    quality: 'provider-reported',
    definition: 'consumption',
    scope: 'on-site'
  }
}

describe('computeTransaction: worked example', () => {
  it('E = 0.025 kWh, W = 0.075 L', () => {
    const f = computeTransaction(worked)
    expect(f.itEnergy.value).toBeCloseTo(0.025, 10)
    expect(f.water.value).toBeCloseTo(0.075, 10)
    expect(f.water.basis).toMatch(/allocated by compute share/)
    expect(f.water.basis).toMatch(/not measured consumption/)
    expect(f.method.id).toBe('clio-x-transaction-allocation')
    expect(f.method.version).toBe('0.1')
  })

  it('water is never labelled measured', () => {
    const f = computeTransaction({
      ...worked,
      water: { ...(worked.water as object), quality: 'measured' } as never
    })
    expect(f.water.quality).toBe('portal-estimated')
  })
})

describe('PUE', () => {
  it('multiplies IT-only power into facility energy', () => {
    const f = computeTransaction({ ...worked, pue: 1.2 })
    expect(f.itEnergy.value).toBeCloseTo(0.025)
    expect(f.facilityEnergy.value).toBeCloseTo(0.03)
  })
  it('no PUE with IT-only power -> facility energy unknown, not IT energy', () => {
    const f = computeTransaction({ ...worked, pue: undefined })
    expect(f.facilityEnergy.value).toBeUndefined()
    expect(f.facilityEnergy.quality).toBe('unknown')
    expect(f.facilityEnergy.reason).toMatch(/PUE/)
    expect(f.carbon.value).toBeUndefined()
  })
  it('power that includes cooling is taken as facility energy', () => {
    const f = computeTransaction({
      ...worked,
      powerScope: 'facility',
      pue: 1.25
    })
    expect(f.facilityEnergy.value).toBeCloseTo(0.025)
    expect(f.itEnergy.value).toBeCloseTo(0.02)
  })
})

describe('WUE path', () => {
  const wue: TransactionInput = {
    ...worked,
    pue: 1.21,
    water: {
      kind: 'wue',
      lPerKWh: 0.36,
      quality: 'provider-reported',
      definition: 'consumption',
      scope: 'on-site',
      period: 'annual average'
    }
  }
  it('W = IT energy x WUE (not facility energy)', () => {
    const f = computeTransaction(wue)
    expect(f.water.value).toBeCloseTo(0.025 * 0.36, 10)
    // 25% のシェアで割り振った IT 電力量を使うので、推定扱いになる
    expect(f.water.quality).toBe('portal-estimated')
    expect(f.water.basis).toMatch(/WUE 0.36/)
    expect(f.water.basis).toMatch(/annual average/)
  })
  it('dedicated machine + provider WUE stays provider-reported', () => {
    const f = computeTransaction({
      ...wue,
      allocation: 'dedicated',
      intervals: [{ powerKW: 1, hours: 1, share: 1 }]
    })
    expect(f.water.quality).toBe('provider-reported')
  })
  it('unknown IT energy -> unknown water', () => {
    const f = computeTransaction({
      ...wue,
      intervals: [{ hours: 0.025, share: 0.25 }]
    })
    expect(f.water.value).toBeUndefined()
  })
})

describe('missing inputs are unknown, never 0', () => {
  it('no water input', () => {
    const f = computeTransaction({ ...worked, water: undefined })
    expect(f.water.value).toBeUndefined()
    expect(f.water.quality).toBe('unknown')
    expect(f.water.reason).toBeTruthy()
    expect(f.itEnergy.value).toBeCloseTo(0.025)
  })
  it('no power', () => {
    const f = computeTransaction({
      ...worked,
      intervals: [{ hours: 0.025, share: 0.25 }]
    })
    expect(f.itEnergy.value).toBeUndefined()
    expect(f.facilityEnergy.value).toBeUndefined()
  })
  it('missing flow in one interval', () => {
    const f = computeTransaction({
      ...worked,
      intervals: [
        { powerKW: 4, hours: 0.01, share: 0.25, waterLPerHour: 10 },
        { powerKW: 4, hours: 0.01, share: 0.25 }
      ],
      water: { ...(worked.water as object), lPerHour: undefined } as never
    })
    expect(f.water.value).toBeUndefined()
    expect(f.itEnergy.value).toBeDefined()
  })
  it('no grid factor -> carbon unknown', () => {
    expect(computeTransaction(worked).carbon.value).toBeUndefined()
  })
})

describe('carbon, intervals, allocation', () => {
  it('carbon = facility energy x grid factor', () => {
    const f = computeTransaction({
      ...worked,
      pue: 1.2,
      grid: { gCO2ePerKWh: 100, label: 'x', asOf: '2025', source: 's' }
    })
    expect(f.carbon.value).toBeCloseTo(3)
  })
  it('sums several intervals with their own shares and flows', () => {
    const f = computeTransaction({
      ...worked,
      intervals: [
        { powerKW: 4, hours: 0.5, share: 0.25, waterLPerHour: 12 },
        { powerKW: 6, hours: 0.25, share: 0.5, waterLPerHour: 8 }
      ]
    })
    expect(f.itEnergy.value).toBeCloseTo(4 * 0.5 * 0.25 + 6 * 0.25 * 0.5)
    expect(f.water.value).toBeCloseTo(12 * 0.5 * 0.25 + 8 * 0.25 * 0.5)
    expect(f.totalHours).toBeCloseTo(0.75)
    expect(f.averageShare).toBeCloseTo((0.25 * 0.5 + 0.5 * 0.25) / 0.75)
  })
  it('water share r can differ from compute share', () => {
    const f = computeTransaction({
      ...worked,
      intervals: [{ powerKW: 4, hours: 0.025, share: 0.25, waterShare: 0.5 }]
    })
    expect(f.water.value).toBeCloseTo(0.15)
  })
  it('dedicated machine keeps the power quality; shared allocation makes it an estimate', () => {
    const own = computeTransaction({
      ...worked,
      allocation: 'dedicated',
      powerQuality: 'measured',
      intervals: [{ powerKW: 1, hours: 1, share: 1 }]
    })
    expect(own.itEnergy.quality).toBe('measured')
    const shared = computeTransaction({ ...worked, powerQuality: 'measured' })
    expect(shared.itEnergy.quality).toBe('portal-estimated')
  })
  it('measured-per-job uses the measured energy as is', () => {
    const f = computeTransaction({
      ...worked,
      allocation: 'measured-per-job',
      measuredITEnergyKWh: 0.04
    })
    expect(f.itEnergy.value).toBe(0.04)
    expect(f.itEnergy.quality).toBe('measured')
    const none = computeTransaction({
      ...worked,
      allocation: 'measured-per-job'
    })
    expect(none.itEnergy.value).toBeUndefined()
  })
  it('recirculating flow gets a warning note', () => {
    const f = computeTransaction({
      ...worked,
      water: {
        ...(worked.water as object),
        definition: 'recirculating-flow'
      } as never
    })
    expect(f.notes.join(' ')).toMatch(/not consumed/)
  })
})

describe('buildTransactionReceipt', () => {
  it('carries share, intervals, values, allocation, method version, source hash', () => {
    const f = computeSingleInterval(worked.intervals[0], worked)
    const r = buildTransactionReceipt({
      transactionId: 'tx-1',
      provider: 'Demo',
      location: { name: 'Nowhere', jurisdiction: 'XX' },
      input: worked,
      footprint: f
    })
    expect(r.allocation.basis).toBe('reserved-share')
    expect(r.allocation.method).toBe(TRANSACTION_METHOD_LABEL)
    expect(r.allocation.intervals[0].share).toBe(0.25)
    expect(r.values.water.value).toBeCloseTo(0.075)
    expect(r.values.water.quality).toBe('portal-estimated')
    expect(r.source.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.parse(JSON.stringify(r)).values.itEnergy.unit).toBe('kWh')
  })
})
