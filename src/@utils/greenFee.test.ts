import { DEFAULT_RULES, FeeLocation, quoteFee } from './greenFee'

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
