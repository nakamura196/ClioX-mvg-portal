import {
  buildChoiceRecord,
  choiceRecordToText,
  planChoice,
  toMg
} from './carbonChoice'

describe('planChoice', () => {
  it('ranks locations by estimated emissions and keeps unknown ones out of the ranking', () => {
    const plan = planChoice(40, 30)
    expect(plan.durationSeconds).toBe(40 * 30 * 60)
    const g = plan.ranked.map((o) => o.footprint.gCO2e)
    expect([...g].sort((a, b) => a - b)).toEqual(g)
    expect(plan.ranked[0].key).toBe('eu-north-1')
    expect(plan.unranked.map((o) => o.key)).toContain('mdx')
    plan.unranked.forEach((o) => expect(o.footprint.gCO2e).toBeUndefined())
  })

  it('treats bad input as zero work', () => {
    expect(planChoice(NaN, -3).durationSeconds).toBe(0)
  })
})

describe('buildChoiceRecord', () => {
  const plan = planChoice(40, 30)
  const now = new Date('2026-09-30T00:00:00Z')

  it('builds contract arguments that match the record', () => {
    const r = buildChoiceRecord({
      plan,
      chosenKey: 'eu-north-1',
      purpose: 'OCR',
      now
    })
    const highest = plan.ranked[plan.ranked.length - 1]
    expect(r.args.locationKey).toBe('eu-north-1')
    expect(r.args.chosenMgCO2e).toBe(toMg(plan.ranked[0].footprint.gCO2e))
    expect(r.args.highestMgCO2e).toBe(toMg(highest.footprint.gCO2e))
    expect(r.args.alternatives).toBe(plan.ranked.length)
    expect(r.args.chosenMgCO2e).toBeLessThanOrEqual(r.args.highestMgCO2e)
    expect(r.differenceG).toBeGreaterThan(0)
    expect(r.record).toMatchObject({
      type: 'cliox:CarbonChoiceRecord',
      'prov:generatedAtTime': '2026-09-30T00:00:00.000Z'
    })
  })

  it('choosing the highest option records a difference of zero', () => {
    const top = plan.ranked[plan.ranked.length - 1].key
    const r = buildChoiceRecord({ plan, chosenKey: top, purpose: '', now })
    expect(r.differenceG).toBe(0)
    expect(r.args.chosenMgCO2e).toBe(r.args.highestMgCO2e)
  })

  it('refuses a location whose emissions cannot be estimated', () => {
    expect(
      buildChoiceRecord({ plan, chosenKey: 'mdx', purpose: '', now })
    ).toBeUndefined()
  })

  it('never calls the difference a reduction', () => {
    const r = buildChoiceRecord({
      plan,
      chosenKey: 'eu-north-1',
      purpose: '',
      now
    })
    const text = choiceRecordToText(r.record)
    expect(text).toMatch(/not a certified emission reduction/)
    expect(text).toMatch(/not a reduction against a baseline/)
  })

  it('serialises the same record to the same text', () => {
    const a = buildChoiceRecord({
      plan,
      chosenKey: 'eu-north-1',
      purpose: 'x',
      now
    })
    const b = buildChoiceRecord({
      plan,
      chosenKey: 'eu-north-1',
      purpose: 'x',
      now
    })
    expect(choiceRecordToText(a.record)).toBe(choiceRecordToText(b.record))
  })
})
