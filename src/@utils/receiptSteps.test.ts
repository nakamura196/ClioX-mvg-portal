import { fmt, receiptSteps } from './receiptSteps'
import {
  TransactionInput,
  buildSourceData,
  buildTransactionReceipt,
  computeTransaction
} from './transactionFootprint'

function stepsFor(input: TransactionInput) {
  const common = {
    transactionId: 't',
    provider: 'p',
    location: { name: 'n', jurisdiction: 'j' },
    input
  }
  const receipt = buildTransactionReceipt({
    ...common,
    footprint: computeTransaction(input)
  })
  return receiptSteps(receipt, buildSourceData(common))
}

const grid = {
  gCO2ePerKWh: 429,
  label: 'Tokyo',
  asOf: '2023',
  source: 'test'
}

// 受領証の見本と同じ: 2 区間・流量方式の水
const sample: TransactionInput = {
  intervals: [
    { powerKW: 0.45, hours: 0.2, share: 0.25 },
    { powerKW: 0.25, hours: 0.8, share: 0.25 }
  ],
  allocation: 'reserved-share',
  powerQuality: 'provider-reported',
  powerScope: 'it-only',
  pue: 1.3,
  pueQuality: 'provider-reported',
  water: {
    kind: 'flow',
    lPerHour: 2.5,
    quality: 'provider-reported',
    definition: 'consumption',
    scope: 'on-site'
  },
  grid
}

describe('receiptSteps', () => {
  it('shows each interval and the sum for the sample receipt', () => {
    const [it, facility, water, carbon] = stepsFor(sample)
    expect(it.kind).toBe('itShare')
    expect(it.terms).toEqual([
      '0.45 kW × 0.2 h × 0.25 = 0.0225 kWh',
      '0.25 kW × 0.8 h × 0.25 = 0.05 kWh'
    ])
    expect(it.total).toBe('0.0225 + 0.05 = 0.0725 kWh')
    expect(it.qualityInputs.map((q) => q.input)).toEqual([
      'power',
      'allocation'
    ])
    expect(facility.total).toBe('0.0725 kWh × 1.3 = 0.09425 kWh')
    expect(water.kind).toBe('waterFlow')
    expect(water.total).toBe('0.125 + 0.5 = 0.625 L')
    expect(carbon.total).toBe('0.09425 kWh × 429 gCO2e/kWh = 40.43 gCO2e')
  })

  it('the sum in the steps equals the value in the receipt', () => {
    const steps = stepsFor(sample)
    for (const s of steps) {
      const last = (s.total as string).split(' = ').pop() as string
      expect(last).toBe(`${fmt(s.quantity.value as number)} ${s.quantity.unit}`)
    }
  })

  it('WUE: water = IT energy × WUE', () => {
    const [, , water] = stepsFor({
      ...sample,
      water: {
        kind: 'wue',
        lPerKWh: 0.36,
        quality: 'provider-reported',
        definition: 'consumption',
        scope: 'on-site'
      }
    })
    expect(water.kind).toBe('waterWue')
    expect(water.total).toBe('0.0725 kWh × 0.36 L/kWh = 0.0261 L')
  })

  it('power includes cooling: facility from intervals, IT = facility ÷ PUE', () => {
    const [it, facility] = stepsFor({ ...sample, powerScope: 'facility' })
    expect(facility.kind).toBe('facilityGiven')
    expect(facility.total).toBe('0.0225 + 0.05 = 0.0725 kWh')
    expect(it.kind).toBe('itFromFacility')
    expect(it.total).toBe('0.0725 kWh ÷ 1.3 = 0.05577 kWh')
  })

  it('a missing input gives an unknown step with the reason', () => {
    const [, facility, , carbon] = stepsFor({ ...sample, pue: undefined })
    expect(facility.kind).toBe('unknown')
    expect(facility.quantity.reason).toMatch(/no valid PUE/)
    expect(carbon.kind).toBe('unknown')
  })
})
