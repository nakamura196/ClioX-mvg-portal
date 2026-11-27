import realJson from '../../../../content/experiment/real-envs.json'
import type { Bilingual } from '@experiment/two-condition/lib/experiment'
import { RealEnvEntry, RealEnvsFile, matchRealEnv } from './realEnvsCore'

// [prototype] 2026-11-27: the trial node's two real compute environments (mdx and
// "Provisional place B") described with the same fields as the demo options in
// trials.json, so the real comparison table shows the same items as the paper's
// Fig. 1 (location, jurisdiction, Indigenous data, certifications, cost,
// electricity, water, carbon, labels, "View the calculation").
// Values are dummy where 'dummy' says so; the calculation is the real one.
// Helpers without the file: realEnvsCore.ts (also used by worker/greenReward.ts).

export * from './realEnvsCore'

const FILE = realJson as unknown as RealEnvsFile

export const REAL_ENVS_NOTICE: Bilingual = FILE.notice

export function findRealEnv(env: {
  description?: string
  desc?: string
}): RealEnvEntry | undefined {
  return matchRealEnv(FILE.options, env)
}

export function findRealEnvById(id: string): RealEnvEntry | undefined {
  return FILE.options.find((o) => o.id === id)
}

/** All entries (the checker compares the job against every real environment). */
export function realEnvEntries(): RealEnvEntry[] {
  return FILE.options
}
