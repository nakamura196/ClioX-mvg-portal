import { optionFootprint } from '@experiment/two-condition/lib/experiment'
import {
  carbonUg,
  dummyFigures,
  findRealEnv,
  realEnvEntries,
  realOption
} from './realEnvs'

describe('real environments of the trial node (dummy values)', () => {
  const mdx = { description: 'mdx (Univ. Tokyo) / CPU only' }
  const b = {
    description:
      'Provisional place B (values set by Clio-X for testing the choice; not a real site) / CPU only'
  }

  it('matches by description; place B does not fall to mdx', () => {
    expect(findRealEnv(mdx)?.id).toBe('a')
    expect(findRealEnv(b)?.id).toBe('b')
    expect(findRealEnv({ description: 'something else' })).toBeUndefined()
  })

  it('scales the 1 vCPU · 1 hour interval by job length and vCPUs', () => {
    const a = realOption(findRealEnv(mdx)!, 900, 2)
    const f = optionFootprint(a)
    // 0.00711 kW × 2 × 0.25 h = 0.003555 kWh IT; × PUE 1.3
    expect(f.itEnergy.value).toBeCloseTo(0.003555, 6)
    expect(f.facilityEnergy.value).toBeCloseTo(0.003555 * 1.3, 6)
    expect(f.water.value).toBeCloseTo(0.003555 * 1.8, 6)
    expect(f.carbon.value).toBeCloseTo(0.003555 * 1.3 * 429, 4)
  })

  it('B is lower than A for the same job', () => {
    const fa = optionFootprint(realOption(findRealEnv(mdx)!, 900))
    const fb = optionFootprint(realOption(findRealEnv(b)!, 900))
    expect(fb.carbon.value!).toBeLessThan(fa.carbon.value!)
    expect(fb.water.value!).toBeLessThan(fa.water.value!)
  })

  it('marks figures that rest on a dummy input', () => {
    expect(dummyFigures(['pue', 'water'])).toEqual({
      energy: true,
      water: true,
      carbon: true,
      pue: true,
      wue: true
    })
    expect(dummyFigures(['grid']).energy).toBe(false)
    expect(dummyFigures(['grid']).carbon).toBe(true)
  })

  it('carbonUg (used by the reward checker) equals the accounting module', () => {
    for (const e of realEnvEntries()) {
      for (const [sec, cpu] of [
        [97.627, 1],
        [900, 2]
      ]) {
        const f = optionFootprint(realOption(e, sec, cpu))
        expect(carbonUg(e, sec, cpu)! / 1e6).toBeCloseTo(f.carbon.value!, 9)
      }
    }
  })
})
