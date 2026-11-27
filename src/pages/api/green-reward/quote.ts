// [local patch] Dev-only twin of the Worker's POST /api/green-reward/quote
// (worker/index.ts), so the reward button works under `next dev`. The static
// export (scripts/build-cf.mjs) drops src/pages/api, so production uses the
// Worker. The checker key comes from process.env.GREEN_REWARD_CHECKER_KEY
// (injected from 1Password when the dev server starts; never written to disk).
import type { NextApiRequest, NextApiResponse } from 'next'
import { handleQuoteBody } from '../../../../worker/greenReward'
import { realEnvEntries } from '@/experiment/footprint/lib/realEnvs'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST')
    return res.status(405).json({ ok: false, reason: 'POST only' })
  // process['env'] on purpose: this build replaces `process.env.NAME` at
  // compile time (it came out undefined in next dev, 2026-11-27).
  const env = process['env']
  const r = await handleQuoteBody(
    req.body,
    {
      checkerKey: env.GREEN_REWARD_CHECKER_KEY,
      contract: env.GREEN_REWARD_CONTRACT
    },
    realEnvEntries()
  )
  res.setHeader('Cache-Control', 'no-store')
  return res.status(r.status).json(r.body)
}
