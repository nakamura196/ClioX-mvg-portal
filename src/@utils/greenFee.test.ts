import {
  DEFAULT_RULES,
  FEE_OPTIONS,
  FeeLocation,
  NO_TYPES,
  simulatePool,
  optionRules,
  typesOn,
  attestationQuery,
  candidateUids,
  quoteFee,
  reasonFromCode
} from './greenFee'

// 値は Sepolia の GreenFeeDemo (0xa497…c932) の quote を 2026-10-01 に読んだもの
const stockholm: FeeLocation = {
  key: 'eu-north-1',
  microPerHour: 558000,
  mgPerHour: 699
}
const montreal: FeeLocation = {
  key: 'ca-central-1',
  microPerHour: 893600,
  mgPerHour: 2484
}
const tokyo: FeeLocation = {
  key: 'ap-northeast-1',
  microPerHour: 1167200,
  mgPerHour: 30888
}
const oregon: FeeLocation = {
  key: 'us-west-2',
  microPerHour: 804800,
  mgPerHour: 11952
}
const H20 = 20 * 3600
// 配布直後: 原資 4.6688（東京 1 件の上乗せ）、預け入れ 200
const funds = { pool: 4668800, deposit: 200000000 }

describe('quoteFee (same as GreenFeeDemo.quote)', () => {
  it('matches the chain for Stockholm and Montreal', () => {
    expect(quoteFee(stockholm, DEFAULT_RULES, funds, H20)).toEqual({
      base: 11160000,
      rebate: 0,
      portalFee: 0,
      feeWaived: 0,
      providerGets: 11160000,
      portalGets: 0,
      surcharge: 0,
      discount: 2232000,
      discountWanted: 2232000,
      subsidy: 4464000,
      payerPays: 4464000,
      mgCO2e: 13980,
      band: 'low'
    })
    const m = quoteFee(montreal, DEFAULT_RULES, funds, H20)
    expect(m.discount).toBe(3574400)
    expect(m.subsidy).toBe(5000000) // capped
    expect(m.payerPays).toBe(9297600)
  })

  it('surcharges high, leaves middle alone', () => {
    const t = quoteFee(tokyo, DEFAULT_RULES, funds, H20)
    expect(t.band).toBe('high')
    expect(t.surcharge).toBe(4668800)
    expect(t.payerPays).toBe(23344000 + 4668800)
    const o = quoteFee(oregon, DEFAULT_RULES, funds, H20)
    expect(o.band).toBe('middle')
    expect(o.payerPays).toBe(o.base)
  })

  it('pays no discount from an empty pool and no subsidy from an empty deposit', () => {
    const q = quoteFee(stockholm, DEFAULT_RULES, { pool: 0, deposit: 0 }, H20)
    expect(q.discountWanted).toBe(2232000)
    expect(q.discount).toBe(0)
    expect(q.subsidy).toBe(0)
    expect(q.payerPays).toBe(q.base)
  })
})

// 値は、DeployGreenFee.s.sol を Sepolia の写し（anvil）に配り、getPayment で読んだもの（2026-11-06）。
// 型 1 の割合は全場所 10 %。各選択肢で東京 1 件のあとにストックホルム 1 件を払う。
describe('quoteFee for each option (same as the chain)', () => {
  const opt = (id: string) => optionRules(FEE_OPTIONS.find((o) => o.id === id)!)
  const sto = { ...stockholm, rebateBps: 1000 }
  const tok = { ...tokyo, rebateBps: 1000 }
  const after = (id: string, deposit = 0) => {
    const t = quoteFee(tok, opt(id), { pool: 0, deposit }, H20)
    return {
      t,
      s: quoteFee(sto, opt(id), { pool: t.surcharge, deposit }, H20)
    }
  }
  it('1: the provider gives up 10 %', () => {
    const { t, s } = after('o1')
    expect(t.payerPays).toBe(23344000)
    expect(s.rebate).toBe(1116000)
    expect(s.providerGets).toBe(10044000)
    expect(s.payerPays).toBe(10044000)
  })
  it('2: everyone pays a 10 % fee, waived on low', () => {
    const { t, s } = after('o2')
    expect(t.payerPays).toBe(25678400)
    expect(t.portalGets).toBe(2334400)
    expect(s.feeWaived).toBe(1116000)
    expect(s.payerPays).toBe(11160000)
    expect(s.portalGets).toBe(0)
  })
  it('3: surcharge funds the discount', () => {
    const { t, s } = after('o3')
    expect(t.payerPays).toBe(28012800)
    expect(s.payerPays).toBe(8928000)
  })
  it('4: the deposit pays half, up to 5', () => {
    const { t, s } = after('o4', 100000000)
    expect(t.payerPays).toBe(23344000)
    expect(s.subsidy).toBe(5000000)
    expect(s.payerPays).toBe(6160000)
  })
  it('all four together', () => {
    const { t, s } = after('all', 100000000)
    expect(t.payerPays).toBe(30347200)
    expect(s.rebate).toBe(1116000)
    expect(s.discount).toBe(2232000)
    expect(s.subsidy).toBe(3906000)
    expect(s.payerPays).toBe(3906000)
  })
  it('the default rules are option 3 + 4', () => {
    expect(opt('o34')).toEqual(DEFAULT_RULES)
    expect(typesOn(opt('o2'))).toEqual({
      1: false,
      2: true,
      3: false,
      4: false
    })
  })
})

describe('quoteFee without a membership proof', () => {
  it('drops only the subsidy', () => {
    const q = quoteFee(stockholm, DEFAULT_RULES, funds, H20, false)
    expect(q.discount).toBe(2232000)
    expect(q.subsidy).toBe(0)
    expect(q.payerPays).toBe(11160000 - 2232000)
  })
})

describe('EAS helpers', () => {
  const uid = '0x' + 'ab'.repeat(32)
  it('asks easscan for unrevoked attestations of one schema, attester and recipient', () => {
    const q = attestationQuery('0xs', '0xa', '0xr')
    expect(q.variables).toEqual({
      s: { equals: '0xs' },
      a: { equals: '0xa' },
      r: { equals: '0xr' }
    })
    expect(q.query).toContain('revoked:{equals:false}')
  })
  it('keeps unexpired candidates in the given order', () => {
    const json = {
      data: {
        attestations: [
          { id: uid, expirationTime: 0 },
          { id: '0x' + 'cd'.repeat(32), expirationTime: 100 },
          { id: '0x' + 'ef'.repeat(32), expirationTime: 5000 },
          { id: 'junk', expirationTime: 0 }
        ]
      }
    }
    expect(candidateUids(json, 1000)).toEqual([
      { uid, expiresAt: 0 },
      { uid: '0x' + 'ef'.repeat(32), expiresAt: 5000 }
    ])
    expect(candidateUids({ errors: [] })).toEqual([])
    expect(candidateUids(null)).toEqual([])
  })
  it('maps the contract reason codes', () => {
    expect(reasonFromCode(0)).toBe('ok')
    expect(reasonFromCode(7)).toBe('revoked')
    expect(reasonFromCode(99)).toBe('notFound')
  })
})

describe('simulatePool (type 3 pool outlook)', () => {
  const r3 = optionRules(FEE_OPTIONS.find((o) => o.id === 'o3'))
  it('gives the break-even share of high-emission jobs', () => {
    // 20 時間: 東京の上乗せ 4.6688、ストックホルムの値引き 2.232 → 2.232 / 6.9008 = 32.35 %
    const o = simulatePool(stockholm, tokyo, r3, 0, H20, 2000, 10)
    expect(o.breakEvenBps).toBe(3235)
  })
  it('runs out below the break-even share', () => {
    // 割合 20 %: 5 件目と 10 件目が東京。原資 0 から始めると 1〜4 件目と 9 件目は値引きできない
    const o = simulatePool(stockholm, tokyo, r3, 0, H20, 2000, 10)
    expect(o.highJobs).toBe(2)
    expect(o.lowJobs).toBe(8)
    expect(o.firstShort).toBe(1)
    expect(o.noDiscounts).toBe(5)
    // 5 件目の上乗せ 4.6688 で 6・7 件目は満額、8 件目は残り 0.2048、9 件目は 0
    expect(o.fullDiscounts).toBe(2)
    expect(o.partialDiscounts).toBe(1)
    expect(o.poolEnd).toBe(4668800)
    expect(o.discountPaid).toBe(4668800)
  })
  it('lasts at or above the break-even share', () => {
    const o = simulatePool(stockholm, tokyo, r3, 4668800, H20, 4000, 100)
    expect(o.firstShort).toBeNull()
    expect(o.poolEnd).toBeGreaterThan(o.poolStart)
  })
  it('reports no discount when type 3 is off', () => {
    const o = simulatePool(stockholm, tokyo, NO_TYPES, 0, H20, 2000, 10)
    expect(o.breakEvenBps).toBe('none')
    expect(o.firstShort).toBeNull()
  })
})
