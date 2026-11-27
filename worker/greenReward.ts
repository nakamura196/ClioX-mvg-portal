// [local patch] Reward checker for the green-choice prototype (2026-11-27).
/**
 * Reads one finished compute job from the Ocean Node, estimates its carbon at
 * every real environment of that node (values: content/experiment/real-envs.json,
 * dummy on the trial site), and signs a claim for the GreenReward contract
 * (contracts/carbon-choice/src/GreenReward.sol).
 *
 * The figures come from the node, not from the person asking: owner (the
 * reward goes there), environment, algorithm start/stop, vCPUs. The node's
 * status endpoint needs no signature (checked 2026-11-27), so anyone can ask
 * for a quote; only the job owner can receive the reward.
 *
 * Signature: EIP-191 personal_sign over
 *   keccak256(abi.encode(TAG, chainId, contract, jobIdHash, recipient,
 *     keccak256(chosenKey), keccak256(highestKey), chosenUg, highestUg, expiry))
 * Every word is 32 bytes, so the encoding is done by hand (no ethers in the Worker).
 */
import { secp256k1 } from '@noble/curves/secp256k1'
import { keccak_256 as keccak256 } from '@noble/hashes/sha3'
import {
  type RealEnvEntry,
  carbonUg,
  matchRealEnv
} from '../src/experiment/footprint/lib/realEnvsCore.ts'

const enc = new TextEncoder()
const TAG = keccak256(enc.encode('clio-x-green-reward/1'))

function hexToBytes(h: string): Uint8Array {
  const s = h.replace(/^0x/, '')
  if (!/^[0-9a-fA-F]*$/.test(s) || s.length % 2) throw new Error('bad hex')
  const out = new Uint8Array(s.length / 2)
  for (let i = 0; i < out.length; i++)
    out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16)
  return out
}

function bytesToHex(b: Uint8Array): string {
  return '0x' + Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
}

function word(v: bigint | Uint8Array): Uint8Array {
  const w = new Uint8Array(32)
  if (v instanceof Uint8Array) {
    w.set(v, 32 - v.length)
  } else {
    let n = v
    for (let i = 31; i >= 0 && n > BigInt(0); i--) {
      w[i] = Number(n & BigInt(255))
      n >>= BigInt(8)
    }
  }
  return w
}

export interface ClaimFields {
  jobIdHash: string
  recipient: string
  chosenKey: string
  highestKey: string
  chosenUg: number
  highestUg: number
  expiry: number
}

export function claimDigest(
  chainId: number,
  contract: string,
  c: ClaimFields
): Uint8Array {
  const parts = [
    TAG,
    word(BigInt(chainId)),
    word(hexToBytes(contract)),
    word(hexToBytes(c.jobIdHash)),
    word(hexToBytes(c.recipient)),
    keccak256(enc.encode(c.chosenKey)),
    keccak256(enc.encode(c.highestKey)),
    word(BigInt(c.chosenUg)),
    word(BigInt(c.highestUg)),
    word(BigInt(c.expiry))
  ]
  const buf = new Uint8Array(32 * parts.length)
  parts.forEach((p, i) => buf.set(p, i * 32))
  return keccak256(buf)
}

export function signDigest(digest: Uint8Array, privateKeyHex: string): string {
  const prefix = enc.encode('\x19Ethereum Signed Message:\n32')
  const msg = new Uint8Array(prefix.length + 32)
  msg.set(prefix)
  msg.set(digest, prefix.length)
  const sig = secp256k1.sign(keccak256(msg), hexToBytes(privateKeyHex))
  const out = new Uint8Array(65)
  out.set(word(sig.r), 0)
  out.set(word(sig.s), 32)
  out[64] = 27 + sig.recovery
  return bytesToHex(out)
}

export function checkerAddress(privateKeyHex: string): string {
  const pub = secp256k1.getPublicKey(hexToBytes(privateKeyHex), false)
  return bytesToHex(keccak256(pub.slice(1)).slice(12))
}

export interface QuoteOptions {
  /** content/experiment/real-envs.json options */
  entries: RealEnvEntry[]
  nodeUrl: string
  chainId: number
  contract: string
  checkerKey: string
  /** token units per mg and cap, to show the expected amount (the contract decides) */
  unitsPerMg?: number
  capPerJob?: number
  now?: number
  fetchFn?: typeof fetch
}

export type Quote =
  | {
      ok: true
      claim: ClaimFields
      signature: string
      contract: string
      chainId: number
      runSeconds: number
      cpu: number
      options: { key: string; ug: number; chosen: boolean }[]
      expectedUnits?: number
      note: string
    }
  | { ok: false; reason: string }

export async function quoteReward(
  jobId: string,
  o: QuoteOptions
): Promise<Quote> {
  const f = o.fetchFn || fetch
  if (!/^[0-9a-fA-Fx-]{8,200}$/.test(jobId))
    return { ok: false, reason: 'bad job id' }
  const jr = await f(
    `${o.nodeUrl}/api/services/compute?jobId=${encodeURIComponent(jobId)}`
  )
  if (!jr.ok) return { ok: false, reason: `node answered ${jr.status}` }
  const list = await jr.json()
  // The node ignores a jobId it does not know and returns a list of jobs
  // (checked 2026-11-27), so pick the one whose id matches exactly.
  // Ids are given either as '<nodeHash>-<jobId>' or as the jobId alone.
  const shortId = jobId.includes('-') ? jobId.split('-').pop() : jobId
  const job = Array.isArray(list)
    ? list.find((j: { jobId?: string }) => j?.jobId === shortId)
    : undefined
  if (!job) return { ok: false, reason: 'job not found on the node' }
  if (job.status !== 70) return { ok: false, reason: 'job has not finished' }
  const td = job.terminationDetails
  if (!td || td.exitCode !== 0 || td.OOMKilled === true)
    return { ok: false, reason: 'job did not finish successfully' }
  if (!/^0x[0-9a-fA-F]{64}$/.test(job.jobIdHash || ''))
    return { ok: false, reason: 'node gave no jobIdHash' }
  if (!/^0x[0-9a-fA-F]{40}$/.test(job.owner || ''))
    return { ok: false, reason: 'node gave no owner' }
  const start = Number(job.algoStartTimestamp)
  const stop = Number(job.algoStopTimestamp)
  const runSeconds = stop - start
  if (!(start > 0) || !(runSeconds > 0))
    return { ok: false, reason: 'node gave no run time' }
  const cpu = Number(
    (job.resources || []).find((r: { id: string }) => r.id === 'cpu')?.amount
  )
  if (!(cpu > 0)) return { ok: false, reason: 'node gave no vCPU count' }

  const er = await f(`${o.nodeUrl}/api/services/computeEnvironments`)
  if (!er.ok) return { ok: false, reason: `node answered ${er.status}` }
  const envs: { id: string; description?: string }[] = await er.json()
  const chosenEnv = envs.find((e) => e.id === job.environment)
  const chosenEntry = chosenEnv && matchRealEnv(o.entries, chosenEnv)
  if (!chosenEntry)
    return { ok: false, reason: 'no values registered for the job environment' }

  const options: { key: string; ug: number; chosen: boolean }[] = []
  for (const e of envs) {
    const entry = matchRealEnv(o.entries, e)
    if (!entry || options.some((x) => x.key === entry.key)) continue
    const ug = carbonUg(entry, runSeconds, cpu)
    if (ug === undefined) continue
    options.push({
      key: entry.key,
      ug: Math.round(ug),
      chosen: entry.key === chosenEntry.key
    })
  }
  const chosen = options.find((x) => x.chosen)
  if (!chosen) return { ok: false, reason: 'cannot estimate the job' }
  const highest = options.reduce((a, b) => (b.ug > a.ug ? b : a))

  const claim: ClaimFields = {
    jobIdHash: job.jobIdHash,
    recipient: job.owner,
    chosenKey: chosen.key,
    highestKey: highest.key,
    chosenUg: chosen.ug,
    highestUg: highest.ug,
    expiry: Math.floor((o.now ?? Date.now()) / 1000) + 3600
  }
  const signature = signDigest(
    claimDigest(o.chainId, o.contract, claim),
    o.checkerKey
  )
  let expectedUnits: number | undefined
  if (o.unitsPerMg !== undefined) {
    const diff = Math.max(0, claim.highestUg - claim.chosenUg)
    expectedUnits = Math.floor((diff * o.unitsPerMg) / 1000)
    if (o.capPerJob !== undefined)
      expectedUnits = Math.min(expectedUnits, o.capPerJob)
  }
  return {
    ok: true,
    claim,
    signature,
    contract: o.contract,
    chainId: o.chainId,
    runSeconds,
    cpu,
    options,
    expectedUnits,
    note: 'Estimates from content/experiment/real-envs.json (dummy values on the trial site), not measured emissions.'
  }
}

/** Settings the portal reads from its environment (Worker vars/secrets, or
 *  process.env under `next dev`). The node URL is fixed here, never taken from
 *  the request, so the endpoint cannot be pointed at another host. */
export interface QuoteConfig {
  checkerKey?: string
  contract?: string
  nodeUrl?: string
  chainId?: number
}

export const GREEN_REWARD_DEFAULTS = {
  nodeUrl: 'https://cliox-node.ldas.jp',
  chainId: 11155111,
  // GreenReward on Sepolia, redeployed (hardened) 2026-11-27 by the trial
  // wallet (operator), block 12225869. The first one (0x4287…D3A0) is emptied.
  contract: '0x5e80A701fc5Cb3Bd1c3aC77fD510D0B2B202fD40'
}

/** POST body {jobId} → {status, body}. Shared by the Worker and the dev API route. */
export async function handleQuoteBody(
  body: unknown,
  cfg: QuoteConfig,
  entries: RealEnvEntry[],
  fetchFn?: typeof fetch
): Promise<{ status: number; body: unknown }> {
  const key = (cfg.checkerKey || '').trim()
  if (!/^(0x)?[0-9a-fA-F]{64}$/.test(key))
    return {
      status: 503,
      body: { ok: false, reason: 'checker not configured' }
    }
  const contract = cfg.contract || GREEN_REWARD_DEFAULTS.contract
  if (!/^0x[0-9a-fA-F]{40}$/.test(contract))
    return {
      status: 503,
      body: { ok: false, reason: 'contract not configured' }
    }
  const jobId =
    body && typeof body === 'object'
      ? String((body as { jobId?: unknown }).jobId ?? '')
      : ''
  try {
    const q = await quoteReward(jobId, {
      entries,
      nodeUrl: cfg.nodeUrl || GREEN_REWARD_DEFAULTS.nodeUrl,
      chainId: cfg.chainId || GREEN_REWARD_DEFAULTS.chainId,
      contract,
      checkerKey: key,
      fetchFn
    })
    return { status: q.ok ? 200 : 422, body: q }
  } catch {
    return {
      status: 502,
      body: { ok: false, reason: 'could not read the node' }
    }
  }
}
