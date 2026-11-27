import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { secp256k1 } from '@noble/curves/secp256k1'
import { keccak_256 as keccak256 } from '@noble/hashes/sha3'
import { checkerAddress, claimDigest, quoteReward } from './greenReward.ts'

const entries = JSON.parse(
  readFileSync(new URL('../content/experiment/real-envs.json', import.meta.url))
).options
const KEY = '0x' + '11'.repeat(32)
const ENV_B = '0xnode-0xb'
const ENV_A = '0xnode-0xa'
// the real job on place B, 2026-11-27 (fields as the node returned them)
const job = {
  jobId: 'cddbb725',
  owner: '0x05f174c45840f431d58dA24E7aCE6D107Da1C085',
  status: 70,
  environment: ENV_B,
  resources: [{ id: 'cpu', amount: 1 }],
  algoStartTimestamp: '1795808196.345',
  algoStopTimestamp: '1795808293.972',
  terminationDetails: { exitCode: 0 },
  jobIdHash:
    '0x181208fcb9f84df29d22c1f506ec7ebbca616daa275bd84496afe1b34ad4179e'
}
const envs = [
  {
    id: ENV_A,
    description:
      'mdx (University of Tokyo, Kashiwa, Japan) mdx-kashiwa / CPU only'
  },
  {
    id: ENV_B,
    description:
      'Provisional place B (values set by Clio-X for testing the choice; not a real site) / CPU only'
  }
]
const fakeFetch = (j) => async (url) =>
  new Response(JSON.stringify(url.includes('computeEnvironments') ? envs : [j]))
const opts = (j) => ({
  entries,
  nodeUrl: 'https://node',
  chainId: 11155111,
  contract: '0x' + '22'.repeat(20),
  checkerKey: KEY,
  unitsPerMg: 1e6,
  capPerJob: 500e6,
  now: 0,
  fetchFn: fakeFetch(j)
})

test('quote for the real place-B job pays the owner the difference to mdx', async () => {
  const q = await quoteReward('cddbb725', opts(job))
  assert.equal(q.ok, true)
  assert.equal(q.claim.recipient, job.owner)
  assert.equal(q.claim.chosenKey, 'provisional-place-b')
  assert.equal(q.claim.highestKey, 'mdx')
  assert.ok(Math.abs(q.runSeconds - 97.627) < 1e-6)
  assert.ok(q.claim.highestUg > q.claim.chosenUg)
  assert.equal(
    q.expectedUnits,
    Math.floor(((q.claim.highestUg - q.claim.chosenUg) * 1e6) / 1000)
  )
  // signature recovers to the checker
  const d = claimDigest(11155111, opts(job).contract, q.claim)
  const prefix = new TextEncoder().encode('\x19Ethereum Signed Message:\n32')
  const h = keccak256(new Uint8Array([...prefix, ...d]))
  const sig = Buffer.from(q.signature.slice(2), 'hex')
  const s = secp256k1.Signature.fromCompact(sig.subarray(0, 64)).addRecoveryBit(
    sig[64] - 27
  )
  const pub = s.recoverPublicKey(h).toRawBytes(false)
  const addr =
    '0x' + Buffer.from(keccak256(pub.slice(1)).slice(12)).toString('hex')
  assert.equal(addr, checkerAddress(KEY))
})

test('picks the matching job from a list (the node ignores unknown ids)', async () => {
  const other = { ...job, jobId: 'ded789e1', environment: ENV_A }
  const f = async (url) =>
    new Response(
      JSON.stringify(url.includes('computeEnvironments') ? envs : [other, job])
    )
  const q = await quoteReward('0xabcdef12-cddbb725', {
    ...opts(job),
    fetchFn: f
  })
  assert.equal(q.claim.chosenKey, 'provisional-place-b')
  const none = await quoteReward('99999999', { ...opts(job), fetchFn: f })
  assert.equal(none.ok, false)
})

test('refuses unfinished, failed, or unregistered jobs', async () => {
  assert.equal(
    (await quoteReward('cddbb725', opts({ ...job, status: 40 }))).ok,
    false
  )
  assert.equal(
    (
      await quoteReward(
        'cddbb725',
        opts({ ...job, terminationDetails: { exitCode: 1 } })
      )
    ).ok,
    false
  )
  assert.equal(
    (await quoteReward('cddbb725', opts({ ...job, environment: 'other' }))).ok,
    false
  )
  assert.equal((await quoteReward('bad id!', opts(job))).ok, false)
})

test('a job at the highest environment gets a zero difference', async () => {
  const q = await quoteReward('cddbb725', opts({ ...job, environment: ENV_A }))
  assert.equal(q.ok, true)
  assert.equal(q.claim.chosenUg, q.claim.highestUg)
  assert.equal(q.expectedUnits, 0)
})

// Same vector as test_digestFixedVector in contracts/carbon-choice/test/GreenReward.t.sol
test('claimDigest matches the contract (fixed vector)', () => {
  const d = claimDigest(
    11155111,
    '0x428745BC1aa9B5465A211742f5Dde111340CD3A0',
    {
      jobIdHash:
        '0x181208fcb9f84df29d22c1f506ec7ebbca616daa275bd84496afe1b34ad4179e',
      recipient: '0x05f174c45840f431d58dA24E7aCE6D107Da1C085',
      chosenKey: 'provisional-place-b',
      highestKey: 'mdx',
      chosenUg: 6360,
      highestUg: 107400,
      expiry: 1800000000
    }
  )
  assert.equal(
    '0x' + Buffer.from(d).toString('hex'),
    '0xd0cb6d5f8d6131d3c1d4b4a4a7971b2bf6ef7c52d38fbe4afa09b6c06e9a788c'
  )
})
