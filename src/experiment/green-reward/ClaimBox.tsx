// [prototype] Green reward for a finished compute job (2026-11-27).
// 1. Ask the portal's checker for a signed quote (POST /api/green-reward/quote:
//    the Worker reads the job from the Ocean Node and estimates its carbon at
//    every real environment, content/experiment/real-envs.json).
// 2. Read the amount and "already received" from the GreenReward contract.
// 3. Send the claim from the connected wallet. The contract always pays the job
//    owner (from the node), whoever sends it.
// Figures are estimates (dummy values on the trial site), not measured emissions.
import { ReactElement, useState } from 'react'
import { ethers } from 'ethers'
import { useAccount, useNetwork, useSigner, useSwitchNetwork } from 'wagmi'
import { useModal } from 'connectkit'
import useActiveLocale from '../../i18n/useActiveLocale'
import { getOceanConfig } from '@utils/ocean'
import { realEnvEntries } from '@/experiment/footprint/lib/realEnvs'
import styles from './ClaimBox.module.css'

const CHAIN_ID = 11155111
const EXPLORER = 'https://eth-sepolia.blockscout.com'
const ABI = [
  'function claim(bytes32 jobIdHash, address recipient, string chosenKey, string highestKey, uint64 chosenUg, uint64 highestUg, uint64 expiry, bytes signature) returns (uint256)',
  'function claimed(bytes32) view returns (bool)',
  'function rewardFor(uint64 chosenUg, uint64 highestUg) view returns (uint256)',
  'function token() view returns (address)',
  'error AlreadyClaimed()',
  'error Expired()',
  'error BadSignature()',
  'error NothingToReward()',
  'error PoolEmpty()'
]
const TOKEN_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)'
]

interface QuoteOk {
  ok: true
  claim: {
    jobIdHash: string
    recipient: string
    chosenKey: string
    highestKey: string
    chosenUg: number
    highestUg: number
    expiry: number
  }
  signature: string
  contract: string
  chainId: number
  runSeconds: number
  cpu: number
  options: { key: string; ug: number; chosen: boolean }[]
}

interface Loaded {
  quote: QuoteOk
  amount: ethers.BigNumber
  claimed: boolean
  symbol: string
  decimals: number
  poolShort: boolean
}

type Status =
  | { kind: 'busy'; text: string }
  | { kind: 'error'; text: string }
  | { kind: 'done'; tx: string; text: string }

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
const mg = (ug: number) => (ug / 1000).toFixed(2)

function envName(key: string): string {
  const e = realEnvEntries().find((x) => x.key === key)
  return e?.provider || key
}

const TEXT = {
  en: {
    title: 'Green reward',
    intro:
      'If the estimated carbon of this job is lower than at the highest-estimate place on this node, its owner can receive PLAY (a Sepolia test token with no value) for the difference.',
    check: 'Check the reward for this job',
    checking: 'Asking the checker…',
    chosen: 'ran here',
    diff: 'Difference',
    amount: 'Reward',
    to: 'Paid to the job owner',
    notYou:
      'The connected wallet is not the job owner. You can still send it; the reward goes to the owner.',
    receive: 'Receive the reward',
    connect: 'Connect a wallet to receive',
    switchNet: 'Switch to Sepolia',
    sending: 'Waiting for the wallet and the chain…',
    done: 'Received',
    already: 'Already received for this job.',
    nothing:
      'Nothing to receive: this job ran at the place with the highest estimate.',
    pool: 'The reward pool does not have enough PLAY left for this job.',
    errors: {
      AlreadyClaimed: 'Already received for this job.',
      Expired: 'The quote expired. Press the button again.',
      BadSignature: 'The checker signature was not accepted.',
      NothingToReward: 'Nothing to receive for this job.',
      PoolEmpty: 'The reward pool does not have enough PLAY left.'
    } as Record<string, string>,
    note: 'Estimates from the values the portal holds for each place, not measured emissions. On the trial site both places are the same mdx machine and place B is dummy data.',
    run: (s: number, c: number) => `Run time ${s.toFixed(1)} s, ${c} vCPU`,
    viewTx: 'View the transaction'
  },
  ja: {
    title: '環境リワード',
    intro:
      'このジョブの排出の見積もりが、このノードでいちばん見積もりの多い場所より少ない場合、その差に応じて、ジョブを頼んだ人が PLAY（Sepolia の試験用トークン。価値はありません）を受け取れます。',
    check: 'このジョブのリワードを確かめる',
    checking: '確認係に問い合わせています…',
    chosen: 'ここで実行',
    diff: '差',
    amount: 'リワード',
    to: '受け取る人（ジョブを頼んだ人）',
    notYou:
      'つないでいる財布は、ジョブを頼んだ人ではありません。送ることはできますが、リワードはジョブを頼んだ人に届きます。',
    receive: 'リワードを受け取る',
    connect: '受け取るには財布をつなぐ',
    switchNet: 'Sepolia に切り替える',
    sending: '財布とチェーンの応答を待っています…',
    done: '受け取りました',
    already: 'このジョブのリワードは受け取り済みです。',
    nothing:
      '受け取れる分はありません（いちばん見積もりの多い場所で動いたため）。',
    pool: 'リワードの原資（預けてある PLAY）が、このジョブの分に足りません。',
    errors: {
      AlreadyClaimed: 'このジョブのリワードは受け取り済みです。',
      Expired: '見積もりの有効期限が切れました。もう一度押してください。',
      BadSignature: '確認係の署名が受け付けられませんでした。',
      NothingToReward: 'このジョブで受け取れる分はありません。',
      PoolEmpty: 'リワードの原資（預けてある PLAY）が足りません。'
    } as Record<string, string>,
    note: '場所ごとにポータルが持つ値からの見積もりで、実測の排出量ではありません。試験サイトでは、どちらの場所も実際は mdx の同じ機械で、場所 B の値はダミーです。',
    run: (s: number, c: number) => `実行時間 ${s.toFixed(1)} 秒、${c} vCPU`,
    viewTx: '取引を見る'
  }
}

function readContract(address: string) {
  return new ethers.Contract(
    address,
    ABI,
    new ethers.providers.JsonRpcProvider(getOceanConfig(CHAIN_ID).nodeUri)
  )
}

export default function GreenReward({
  jobId
}: {
  jobId: string
}): ReactElement {
  const t = TEXT[useActiveLocale() === 'ja' ? 'ja' : 'en']
  const { address } = useAccount()
  const { chain } = useNetwork()
  const { switchNetwork } = useSwitchNetwork({ chainId: CHAIN_ID })
  const { data: signer } = useSigner()
  const { setOpen } = useModal()
  const [loaded, setLoaded] = useState<Loaded>()
  const [status, setStatus] = useState<Status>()

  async function fetchQuote(): Promise<Loaded> {
    const r = await fetch('/api/green-reward/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId })
    })
    const q = await r.json()
    if (!q.ok) throw new Error(q.reason || `HTTP ${r.status}`)
    const c = readContract(q.contract)
    const [amount, claimed, tokenAddr] = await Promise.all([
      c.rewardFor(q.claim.chosenUg, q.claim.highestUg),
      c.claimed(q.claim.jobIdHash),
      c.token()
    ])
    const token = new ethers.Contract(tokenAddr, TOKEN_ABI, c.provider)
    const [symbol, decimals, pool] = await Promise.all([
      token.symbol(),
      token.decimals(),
      token.balanceOf(q.contract)
    ])
    return {
      quote: q,
      amount,
      claimed,
      symbol,
      decimals,
      poolShort: pool.lt(amount)
    }
  }

  async function load() {
    setStatus({ kind: 'busy', text: t.checking })
    try {
      setLoaded(await fetchQuote())
      setStatus(undefined)
    } catch (e) {
      setStatus({ kind: 'error', text: (e as Error).message })
    }
  }

  async function receive() {
    if (!loaded || !signer) return
    setStatus({ kind: 'busy', text: t.sending })
    try {
      // The quote expires after an hour; ask again so the signature is fresh.
      let current = loaded
      if (current.quote.claim.expiry * 1000 < Date.now() + 60_000) {
        current = await fetchQuote()
        setLoaded(current)
      }
      const q = current.quote
      const c = new ethers.Contract(q.contract, ABI, signer)
      const tx = await c.claim(
        q.claim.jobIdHash,
        q.claim.recipient,
        q.claim.chosenKey,
        q.claim.highestKey,
        q.claim.chosenUg,
        q.claim.highestUg,
        q.claim.expiry,
        q.signature
      )
      const receipt = await tx.wait()
      setLoaded({ ...current, claimed: true })
      setStatus({ kind: 'done', tx: receipt.transactionHash, text: t.done })
    } catch (e) {
      setStatus({ kind: 'error', text: errorText(e) })
    }
  }

  function errorText(e: unknown): string {
    const err = e as {
      reason?: string
      message?: string
      errorName?: string
      error?: { data?: string }
      data?: string
    }
    let name = err.errorName
    const data = err.data || err.error?.data
    if (!name && typeof data === 'string') {
      try {
        name = new ethers.utils.Interface(ABI).parseError(data).name
      } catch {}
    }
    if (!name && err.reason)
      name = Object.keys(t.errors).find((k) => err.reason.includes(k))
    if (name && t.errors[name]) return t.errors[name]
    return err.reason ?? err.message?.split('\n')[0] ?? String(e)
  }

  const q = loaded?.quote
  const decimals = loaded?.decimals ?? 6
  const amountText = loaded
    ? `${ethers.utils.formatUnits(loaded.amount, decimals)} ${loaded.symbol}`
    : ''
  const notOwner =
    q && address && address.toLowerCase() !== q.claim.recipient.toLowerCase()

  return (
    <section className={styles.box}>
      <h4 className={styles.title}>{t.title}</h4>
      <p className={styles.intro}>{t.intro}</p>

      {!q && (
        <button
          type="button"
          className={styles.button}
          onClick={load}
          disabled={status?.kind === 'busy'}
        >
          {t.check}
        </button>
      )}

      {q && (
        <>
          <table className={styles.table}>
            <tbody>
              {[...q.options]
                .sort((a, b) => b.ug - a.ug)
                .map((o) => (
                  <tr key={o.key} className={o.chosen ? styles.chosen : ''}>
                    <td>
                      {envName(o.key)}
                      {o.chosen && (
                        <span className={styles.tag}>{t.chosen}</span>
                      )}
                    </td>
                    <td className={styles.num}>{mg(o.ug)} mg CO₂e</td>
                  </tr>
                ))}
              <tr>
                <td>{t.diff}</td>
                <td className={styles.num}>
                  {mg(Math.max(0, q.claim.highestUg - q.claim.chosenUg))} mg
                </td>
              </tr>
              <tr>
                <td>
                  <strong>{t.amount}</strong>
                </td>
                <td className={styles.num}>
                  <strong>{amountText}</strong>
                </td>
              </tr>
              <tr>
                <td>{t.to}</td>
                <td className={styles.num}>
                  <code>{short(q.claim.recipient)}</code>
                </td>
              </tr>
            </tbody>
          </table>
          <p className={styles.small}>
            {t.run(q.runSeconds, q.cpu)}. {t.note}
          </p>

          {loaded.claimed && status?.kind !== 'done' ? (
            <p className={styles.small}>{t.already}</p>
          ) : loaded.amount.isZero() ? (
            <p className={styles.small}>{t.nothing}</p>
          ) : loaded.poolShort && status?.kind !== 'done' ? (
            <p className={styles.error}>{t.pool}</p>
          ) : status?.kind === 'done' ? null : !address ? (
            <button
              type="button"
              className={styles.button}
              onClick={() => setOpen(true)}
            >
              {t.connect}
            </button>
          ) : chain?.id !== CHAIN_ID ? (
            <button
              type="button"
              className={styles.button}
              onClick={() => switchNetwork?.()}
            >
              {t.switchNet}
            </button>
          ) : (
            <>
              {notOwner && <p className={styles.small}>{t.notYou}</p>}
              <button
                type="button"
                className={styles.button}
                onClick={receive}
                disabled={status?.kind === 'busy'}
              >
                {t.receive}
              </button>
            </>
          )}
        </>
      )}

      {status?.kind === 'busy' && <p className={styles.small}>{status.text}</p>}
      {status?.kind === 'error' && (
        <p className={styles.error}>{status.text}</p>
      )}
      {status?.kind === 'done' && (
        <p className={styles.done}>
          {status.text}: {amountText}.{' '}
          <a
            href={`${EXPLORER}/tx/${status.tx}`}
            target="_blank"
            rel="noreferrer"
          >
            {t.viewTx}
          </a>
        </p>
      )}
    </section>
  )
}
