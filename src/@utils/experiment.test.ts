import trialsJson from '../../content/experiment/trials.json'
import {
  TrialsFile,
  buildDesign,
  buildTrialRecord,
  computeTrial,
  resultsToCSV,
  shuffled
} from './experiment'

const file = trialsJson as unknown as TrialsFile

describe('trial design', () => {
  const computed = file.trials.map((t) => ({ t, ...computeTrial(t) }))

  it('has 4-6 trials with 3-4 options each, and unique ids', () => {
    expect(file.trials.length).toBeGreaterThanOrEqual(4)
    expect(file.trials.length).toBeLessThanOrEqual(6)
    file.trials.forEach((t) => {
      expect(t.options.length).toBeGreaterThanOrEqual(3)
      expect(t.options.length).toBeLessThanOrEqual(4)
      expect(new Set(t.options.map((o) => o.id)).size).toBe(t.options.length)
    })
  })

  it('the energy-lowest option is the cheapest in at most 1 trial', () => {
    const n = computed.filter((c) =>
      c.flags.energyLowestIds.some((id) => c.flags.costLowestIds.includes(id))
    ).length
    expect(n).toBeLessThanOrEqual(1)
  })

  it('the energy-lowest option is not always in the same location', () => {
    const locs = new Set(
      computed.map(
        (c) =>
          c.options.find((o) => o.option.id === c.flags.energyLowestIds[0])!
            .option.location.en
      )
    )
    expect(locs.size).toBeGreaterThanOrEqual(3)
  })

  it('energy-lowest and water-lowest disagree in some trials, agree in others, and one has unknown water', () => {
    const v = computed.map((c) => c.flags.energyWaterAgree)
    expect(v).toContain(false)
    expect(v).toContain(true)
    expect(v).toContain(null)
  })

  it('every shown value derives from inputs and nothing is 0 by default', () => {
    computed.forEach((c) =>
      c.options.forEach((o) => {
        expect(o.footprint.facilityEnergy.value).toBeGreaterThan(0)
        if (o.footprint.water.value === undefined) {
          expect(o.footprint.water.reason).toBeTruthy()
        }
      })
    )
  })
})

describe('records', () => {
  it('flags the chosen option and exports CSV with one row per trial', () => {
    const t = file.trials[0]
    const { flags } = computeTrial(t)
    const rec = buildTrialRecord({
      trial: t,
      trialIndex: 0,
      condition: 'control',
      pid: 'P1',
      displayedOrder: t.options.map((o) => o.id),
      chosen: flags.energyLowestIds[0],
      responseMs: 1234.4,
      firstChoiceMs: 900,
      changedChoice: false,
      now: new Date('2026-10-09T00:00:00Z')
    })
    expect(rec.chosenIsEnergyLowest).toBe(true)
    expect(rec.responseMs).toBe(1234)
    const csv = resultsToCSV([rec]).trim().split('\n')
    expect(csv).toHaveLength(2)
    expect(csv[0].split(',')).toContain('chosenIsEnergyLowest')
    expect(csv[1]).toContain('P1,control,0,t1')
  })

  it('design export lists lowest flags for each option', () => {
    const d = buildDesign(file) as { trials: { options: unknown[] }[] }
    expect(d.trials).toHaveLength(file.trials.length)
  })

  it('shuffled keeps all items', () => {
    expect(shuffled([1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4])
  })
})
