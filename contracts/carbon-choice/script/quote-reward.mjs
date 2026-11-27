// Ask the real Ocean Node about one job and print a signed GreenReward claim (JSON).
// Usage: node script/quote-reward.mjs <jobId> <chainId> <contract>
// The checker key comes from the environment (GREEN_REWARD_CHECKER_KEY), never an argument.
import { readFileSync } from 'node:fs'
import { quoteReward } from '../../../worker/greenReward.ts'

const [jobId, chainId, contract] = process.argv.slice(2)
const entries = JSON.parse(
  readFileSync(
    new URL('../../../content/experiment/real-envs.json', import.meta.url)
  )
).options
const q = await quoteReward(jobId, {
  entries,
  nodeUrl: process.env.NODE_URL || 'https://cliox-node.ldas.jp',
  chainId: Number(chainId),
  contract,
  checkerKey: process.env.GREEN_REWARD_CHECKER_KEY,
  unitsPerMg: 1e6,
  capPerJob: 500e6
})
console.log(JSON.stringify(q))
