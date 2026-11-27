import type {
  Bilingual,
  TrialOption
} from '@experiment/two-condition/lib/experiment'

// [prototype] 2026-11-27: pure helpers for the trial node's real environments
// (no file loading, so the Worker's reward checker can use them too).
// The data and the loading are in realEnvs.ts.

/** Inputs that can be marked dummy. */
export type DummyInput = 'power' | 'pue' | 'water' | 'grid'

export interface RealEnvEntry extends TrialOption {
  /** name of the environment in reward claims (e.g. 'mdx') */
  key: string
  match: string
  dummy: DummyInput[]
}

export interface RealEnvsFile {
  version: string
  notice: Bilingual
  options: RealEnvEntry[]
}

function normalize(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** The entry whose 'match' appears in the environment's description. The
 *  longest match wins, so a description that also mentions a shorter name
 *  (e.g. "mdx") still goes to the more specific entry. */
export function matchRealEnv(
  entries: RealEnvEntry[],
  env: { description?: string; desc?: string }
): RealEnvEntry | undefined {
  const text = normalize(env?.description || env?.desc || '')
  if (!text) return undefined
  return entries
    .filter((o) => text.includes(normalize(o.match)))
    .sort((a, b) => normalize(b.match).length - normalize(a.match).length)[0]
}

/**
 * The option for one job: the file's intervals are for 1 vCPU and 1 hour, so
 * power is multiplied by the vCPU count and the hours set from the duration.
 */
export function realOption(
  entry: RealEnvEntry,
  seconds: number,
  cpuCount = 1
): RealEnvEntry {
  const cpu = cpuCount > 0 ? cpuCount : 1
  return {
    ...entry,
    compute: {
      ...entry.compute,
      intervals: entry.compute.intervals.map((i) => ({
        ...i,
        powerKW: i.powerKW === undefined ? undefined : i.powerKW * cpu,
        hours: (i.hours * seconds) / 3600
      }))
    }
  }
}

/** Which shown figures rest on a dummy input. */
export function dummyFigures(dummy: DummyInput[] = []): {
  energy: boolean
  water: boolean
  carbon: boolean
  pue: boolean
  wue: boolean
} {
  const d = new Set(dummy)
  const energy = d.has('power') || d.has('pue')
  return {
    energy,
    water: d.has('power') || d.has('water'),
    carbon: energy || d.has('grid'),
    pue: d.has('pue'),
    wue: d.has('water')
  }
}

export function realReceiptHref(
  entry: RealEnvEntry,
  seconds: number,
  cpuCount = 1
): string {
  return `/experiment/two-condition?view=receipt&sample=real-${
    entry.id
  }&sec=${Math.round(seconds)}&cpu=${cpuCount}&steps=1`
}

/**
 * Carbon of one job in micrograms CO2e, without the rest of the accounting
 * module (the Worker uses this; realEnvs.test.ts checks it equals
 * optionFootprint().carbon). IT energy = Σ power × hours × share; facility =
 * IT × PUE (it-only power); carbon = facility × grid factor.
 * undefined when an input is missing.
 */
export function carbonUg(
  entry: RealEnvEntry,
  seconds: number,
  cpuCount = 1
): number | undefined {
  const o = realOption(entry, seconds, cpuCount)
  const c = o.compute
  if (c.intervals.some((i) => i.powerKW === undefined)) return undefined
  const it = c.intervals.reduce(
    (a, i) => a + (i.powerKW as number) * i.hours * i.share,
    0
  )
  const facility =
    c.powerScope === 'facility' ? it : c.pue != null ? it * c.pue : undefined
  if (facility === undefined) return undefined
  return facility * c.grid.gCO2ePerKWh * 1e6
}
