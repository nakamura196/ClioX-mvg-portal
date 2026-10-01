import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { ethers } from 'ethers'
import { useAccount, useNetwork, useSigner, useSwitchNetwork } from 'wagmi'
import { useModal } from 'connectkit'
import contentEn from '../../../content/carbonChoice.json'
import { getOceanConfig } from '@utils/ocean'
import { CARBON_CHOICE_CHAIN_ID } from '@utils/carbonChoice'
import {
  Band,
  DEFAULT_RULES,
  DEFAULT_SCHEME_ID,
  FeeLocation,
  FeeQuote,
  FeeRules,
  GREEN_FEE_ABI,
  GREEN_FEE_ADDRESS,
  GREEN_FEE_DEPLOY_BLOCK,
  MICRO,
  bandFromCode,
  formatPlay,
  gToMg,
  mgToG,
  quoteFee,
  sameRules
} from '@utils/greenFee'
import styles from './index.module.css'

type Content = typeof contentEn
type Fee = Content['fee']

const EXPLORER = 'https://sepolia.etherscan.io'
/** 既定の仕組みを作った試用ウォレット（1Password "Clio-X Sepolia trial wallet"） */
const TRIAL_WALLET = '0xedAa08237554bBafC218f0EaA86704e1aDe9262E'
const LEDGER_ROWS = 20

function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? ''))
}
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
const num = (b: ethers.BigNumberish) => ethers.BigNumber.from(b).toNumber()

function readContract() {
  return new ethers.Contract(
    GREEN_FEE_ADDRESS,
    GREEN_FEE_ABI,
    new ethers.providers.JsonRpcProvider(
      getOceanConfig(CARBON_CHOICE_CHAIN_ID).nodeUri
    )
  )
}

interface SchemeView {
  id: number
  owner: string
  label: string
  rules: FeeRules
  pool: number
  deposit: number
  surchargesIn: number
  discountsOut: number
  subsidiesOut: number
  payments: number
}

interface PaymentView {
  id: number
  payer: string
  paidAt: Date
  locationKey: string
  base: number
  surcharge: number
  discount: number
  subsidy: number
  payerPays: number
  band: Band
  tx?: string
}

interface DepositView {
  from: string
  amount: number
  block: number
  tx: string
}

function toRules(r: ethers.utils.Result): FeeRules {
  return {
    surchargeBps: num(r.surchargeBps),
    discountBps: num(r.discountBps),
    lowUpToMgPerHour: num(r.lowUpToMgPerHour),
    highFromMgPerHour: num(r.highFromMgPerHour),
    subsidyBps: num(r.subsidyBps),
    subsidyCapMicro: num(r.subsidyCapMicro)
  }
}

async function loadScheme(c: ethers.Contract, id: number): Promise<SchemeView> {
  const s = await c.getScheme(id)
  return {
    id,
    owner: s.owner,
    label: s.label,
    rules: toRules(s.rules),
    pool: num(s.pool),
    deposit: num(s.deposit),
    surchargesIn: num(s.surchargesIn),
    discountsOut: num(s.discountsOut),
    subsidiesOut: num(s.subsidiesOut),
    payments: s.payments
  }
}

async function loadLedger(
  c: ethers.Contract,
  schemeId: number
): Promise<PaymentView[]> {
  const ids: ethers.BigNumber[] = await c.paymentsOf(schemeId)
  const recent = ids.slice(-LEDGER_ROWS).reverse()
  const topic = c.interface.getEventTopic('Paid')
  return Promise.all(
    recent.map(async (bid) => {
      const p = await c.getPayment(bid)
      const block = num(p.blockNumber)
      const logs = await c.provider
        .getLogs({
          address: GREEN_FEE_ADDRESS,
          topics: [topic, ethers.utils.hexZeroPad(bid.toHexString(), 32)],
          fromBlock: block,
          toBlock: block
        })
        .catch((): ethers.providers.Log[] => [])
      return {
        id: bid.toNumber(),
        payer: p.payer,
        paidAt: new Date(Number(p.paidAt) * 1000),
        locationKey: p.locationKey,
        base: num(p.base),
        surcharge: num(p.surcharge),
        discount: num(p.discount),
        subsidy: num(p.subsidy),
        payerPays: num(p.payerPays),
        band: bandFromCode(p.band),
        tx: logs[0]?.transactionHash
      }
    })
  )
}

async function loadDeposits(
  c: ethers.Contract,
  schemeId: number
): Promise<DepositView[]> {
  const logs = await c.provider.getLogs({
    address: GREEN_FEE_ADDRESS,
    topics: [
      c.interface.getEventTopic('Deposited'),
      ethers.utils.hexZeroPad(ethers.utils.hexlify(schemeId), 32)
    ],
    fromBlock: GREEN_FEE_DEPLOY_BLOCK,
    toBlock: 'latest'
  })
  return logs
    .map((l) => {
      const e = c.interface.parseLog(l)
      return {
        from: e.args.from as string,
        amount: num(e.args.amount),
        block: l.blockNumber,
        tx: l.transactionHash
      }
    })
    .reverse()
}

/** 料金の状態。CarbonChoice が各候補の行に支払額を出すために使う */
export function useGreenFee(durationSeconds: number) {
  const router = useRouter()
  const [locations, setLocations] = useState<Record<string, FeeLocation>>()
  const [schemes, setSchemes] = useState<SchemeView[]>()
  const [loadError, setLoadError] = useState(false)
  const [schemeId, setSchemeId] = useState(DEFAULT_SCHEME_ID)
  const [draft, setDraft] = useState<FeeRules>(DEFAULT_RULES)
  const [use3, setUse3] = useState(true)
  const [use4, setUse4] = useState(true)
  const [ledger, setLedger] = useState<PaymentView[]>()
  const [deposits, setDeposits] = useState<DepositView[]>()

  useEffect(() => {
    const q = Number(router.query.scheme)
    if (Number.isInteger(q) && q > 0) setSchemeId(q)
  }, [router.query.scheme])

  const refresh = useCallback(async () => {
    const c = readContract()
    try {
      const keys: string[] = await c.locationKeys()
      const locs = await Promise.all(
        keys.map(async (key) => {
          const l = await c.locations(key)
          return {
            key,
            microPerHour: num(l.microPerHour),
            mgPerHour: num(l.mgPerHour)
          }
        })
      )
      setLocations(Object.fromEntries(locs.map((l) => [l.key, l])))
      const count = num(await c.schemeCount())
      const ids = Array.from({ length: count }, (_, i) => i + 1)
      setSchemes(await Promise.all(ids.map((id) => loadScheme(c, id))))
      setLoadError(false)
    } catch {
      setLoadError(true)
    }
  }, [])
  useEffect(() => {
    refresh()
  }, [refresh])

  const scheme = schemes?.find((s) => s.id === schemeId)

  // 仕組みを選び直したら、画面の設定をその仕組みの設定に戻す
  const resetDraft = useCallback(() => {
    if (!scheme) return
    setDraft(scheme.rules)
    setUse3(scheme.rules.surchargeBps > 0 || scheme.rules.discountBps > 0)
    setUse4(scheme.rules.subsidyBps > 0)
  }, [scheme])
  const schemeKey = scheme ? `${scheme.id}:${JSON.stringify(scheme.rules)}` : ''
  useEffect(resetDraft, [schemeKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const refreshLedger = useCallback(() => {
    const c = readContract()
    setLedger(undefined)
    loadLedger(c, schemeId)
      .then(setLedger)
      .catch(() => setLedger([]))
    loadDeposits(c, schemeId)
      .then(setDeposits)
      .catch(() => setDeposits(undefined))
  }, [schemeId])
  useEffect(refreshLedger, [refreshLedger])

  const rules: FeeRules = useMemo(
    () => ({
      ...draft,
      surchargeBps: use3 ? draft.surchargeBps : 0,
      discountBps: use3 ? draft.discountBps : 0,
      subsidyBps: use4 ? draft.subsidyBps : 0
    }),
    [draft, use3, use4]
  )
  const isDraft = !!scheme && !sameRules(rules, scheme.rules)
  const funds = { pool: scheme?.pool ?? 0, deposit: scheme?.deposit ?? 0 }
  const seconds = Math.min(
    Math.max(0, Math.round(durationSeconds)),
    2 ** 32 - 1
  )

  const quoteFor = (key: string): FeeQuote | undefined =>
    locations?.[key] && scheme
      ? quoteFee(locations[key], rules, funds, seconds)
      : undefined

  return {
    locations,
    schemes,
    scheme,
    schemeId,
    setSchemeId,
    loadError,
    draft,
    setDraft,
    use3,
    setUse3,
    use4,
    setUse4,
    rules,
    isDraft,
    resetDraft,
    seconds,
    quoteFor,
    ledger,
    deposits,
    refresh: async () => {
      await refresh()
      refreshLedger()
    }
  }
}

export type GreenFee = ReturnType<typeof useGreenFee>

/** 候補の行に出す支払額 */
export function FeeLine({
  q,
  f,
  priced
}: {
  q?: FeeQuote
  f: Fee
  priced: boolean
}): ReactElement {
  if (!priced) return <small className={styles.feeNone}>{f.notPriced}</small>
  if (!q) return null
  const parts = [
    q.surcharge > 0 && fill(f.plus, { v: formatPlay(q.surcharge) }),
    q.discount > 0 && fill(f.minusDiscount, { v: formatPlay(q.discount) }),
    q.subsidy > 0 && fill(f.minusSubsidy, { v: formatPlay(q.subsidy) })
  ].filter(Boolean)
  return (
    <span className={styles.feeLine}>
      <span className={`${styles.bandTag} ${styles[`band_${q.band}`]}`}>
        {f.band[q.band]}
      </span>
      <span>{fill(f.list, { base: formatPlay(q.base) })}</span>
      {parts.map((p) => (
        <span key={p as string}>{p}</span>
      ))}
      <strong>{fill(f.youPay, { pay: formatPlay(q.payerPays) })}</strong>
      {q.discount < q.discountWanted && (
        <small className={styles.feeShort}>
          {fill(f.short, {
            v: formatPlay(q.discount),
            w: formatPlay(q.discountWanted)
          })}
        </small>
      )}
    </span>
  )
}

function NumberField({
  text,
  value,
  onChange,
  step = 1,
  disabled
}: {
  text: string
  value: number
  onChange: (v: number) => void
  step?: number
  disabled?: boolean
}): ReactElement {
  return (
    <label className={`${styles.field} ${styles.num}`}>
      <span>{text}</span>
      <input
        type="number"
        min={0}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}

type Status =
  | { kind: 'busy' }
  | { kind: 'done'; tx: string; text: string }
  | { kind: 'error'; message: string }

/** 手順 3 のパネル: 仕組みの設定、残高、支払い、台帳 */
export default function GreenFeePanel({
  fee,
  f,
  chosenKey,
  placeName,
  refHash
}: {
  fee: GreenFee
  f: Fee
  chosenKey?: string
  placeName: (key: string) => string
  refHash?: string
}): ReactElement {
  const router = useRouter()
  const ja = router.locale === 'ja'
  const { address } = useAccount()
  const { chain } = useNetwork()
  const { switchNetwork } = useSwitchNetwork({
    chainId: CARBON_CHOICE_CHAIN_ID
  })
  const { data: signer } = useSigner()
  const { setOpen } = useModal()
  const [status, setStatus] = useState<Status>()
  const [balance, setBalance] = useState<number>()
  const [depositPlay, setDepositPlay] = useState(100)
  const [label, setLabel] = useState<string>()

  const { scheme, schemes, draft, setDraft, rules } = fee

  const refreshBalance = useCallback(() => {
    if (!address) return setBalance(undefined)
    readContract()
      .balanceOf(address)
      .then((b: ethers.BigNumber) => setBalance(b.toNumber()))
      .catch(() => setBalance(undefined))
  }, [address])
  useEffect(refreshBalance, [refreshBalance])

  useEffect(() => {
    if (!address) setStatus((s) => (s?.kind === 'busy' ? undefined : s))
  }, [address])

  const ownerName = (owner: string) =>
    address && owner.toLowerCase() === address.toLowerCase()
      ? f.you
      : owner.toLowerCase() === TRIAL_WALLET.toLowerCase()
      ? f.schemeDefault
      : short(owner)

  const send = async (
    run: (c: ethers.Contract) => Promise<ethers.ContractTransaction>,
    after?: (
      receipt: ethers.ContractReceipt,
      iface: ethers.utils.Interface
    ) => string | void
  ) => {
    if (!signer) return
    setStatus({ kind: 'busy' })
    try {
      const c = new ethers.Contract(GREEN_FEE_ADDRESS, GREEN_FEE_ABI, signer)
      const tx = await run(c)
      const receipt = await tx.wait()
      const text = after?.(receipt, c.interface) || f.done
      setStatus({ kind: 'done', tx: receipt.transactionHash, text })
      refreshBalance()
      await fee.refresh()
    } catch (e) {
      const err = e as { reason?: string; message?: string }
      setStatus({
        kind: 'error',
        message: err.reason ?? err.message?.split('\n')[0] ?? String(e)
      })
    }
  }

  const findEvent = (
    receipt: ethers.ContractReceipt,
    iface: ethers.utils.Interface,
    name: string
  ) =>
    receipt.logs
      .map((l) => {
        try {
          return iface.parseLog(l)
        } catch {
          return undefined
        }
      })
      .find((e) => e?.name === name)

  const isOwner =
    !!address &&
    !!scheme &&
    scheme.owner.toLowerCase() === address.toLowerCase()
  const chosenQuote = chosenKey ? fee.quoteFor(chosenKey) : undefined
  const chosenPriced = !!chosenKey && !!fee.locations?.[chosenKey]

  const pct = (bps: number) => bps / 100
  const setBps = (k: keyof FeeRules) => (v: number) =>
    setDraft({ ...draft, [k]: Math.round(Math.min(100, Math.max(0, v)) * 100) })

  const bandList = fee.locations
    ? Object.values(fee.locations)
        .sort((a, b) => a.mgPerHour - b.mgPerHour)
        .map((l) => {
          const { band } = quoteFee(l, rules, { pool: 0, deposit: 0 }, 3600)
          const g = mgToG(l.mgPerHour).toFixed(1)
          return ja
            ? `${placeName(l.key)}（${g} g）${f.band[band]}`
            : `${placeName(l.key)} (${g} g): ${f.band[band]}`
        })
        .join(ja ? '、' : '; ')
    : ''

  const dateFmt = (d: Date) =>
    d.toLocaleString(ja ? 'ja-JP' : 'en-CA', {
      dateStyle: 'medium',
      timeStyle: 'short'
    })

  return (
    <section className={styles.panel}>
      <h2>{f.heading}</h2>
      <p>{f.intro}</p>

      {fee.loadError ? (
        <p className={styles.error}>{f.loadError}</p>
      ) : !schemes || !scheme ? (
        <p>{f.loading}</p>
      ) : (
        <>
          <label className={styles.field}>
            <span>{f.scheme}</span>
            <select
              className={styles.select}
              value={fee.schemeId}
              onChange={(e) => fee.setSchemeId(Number(e.target.value))}
            >
              {schemes.map((s) => (
                <option key={s.id} value={s.id}>
                  {fill(f.schemeOption, {
                    id: s.id,
                    label: s.label,
                    owner: ownerName(s.owner)
                  })}
                </option>
              ))}
            </select>
          </label>

          <div className={styles.feeTypes}>
            <fieldset className={styles.feeType}>
              <legend>
                <label>
                  <input
                    type="checkbox"
                    checked={fee.use3}
                    onChange={(e) => fee.setUse3(e.target.checked)}
                  />{' '}
                  {f.type3}
                </label>
              </legend>
              <p className={styles.hint}>{f.type3Hint}</p>
              <div className={styles.row}>
                <NumberField
                  text={f.surcharge}
                  value={pct(draft.surchargeBps)}
                  onChange={setBps('surchargeBps')}
                  disabled={!fee.use3}
                />
                <NumberField
                  text={f.discount}
                  value={pct(draft.discountBps)}
                  onChange={setBps('discountBps')}
                  disabled={!fee.use3}
                />
              </div>
              <p className={styles.fund}>
                {f.pool}: <strong>{formatPlay(scheme.pool)} PLAY</strong>
              </p>
            </fieldset>

            <fieldset className={styles.feeType}>
              <legend>
                <label>
                  <input
                    type="checkbox"
                    checked={fee.use4}
                    onChange={(e) => fee.setUse4(e.target.checked)}
                  />{' '}
                  {f.type4}
                </label>
              </legend>
              <p className={styles.hint}>{f.type4Hint}</p>
              <div className={styles.row}>
                <NumberField
                  text={f.share}
                  value={pct(draft.subsidyBps)}
                  onChange={setBps('subsidyBps')}
                  disabled={!fee.use4}
                />
                <NumberField
                  text={f.cap}
                  value={draft.subsidyCapMicro / MICRO}
                  onChange={(v) =>
                    setDraft({
                      ...draft,
                      subsidyCapMicro: Math.round(Math.max(0, v) * MICRO)
                    })
                  }
                  step={0.5}
                  disabled={!fee.use4}
                />
              </div>
              <p className={styles.fund}>
                {f.deposit}: <strong>{formatPlay(scheme.deposit)} PLAY</strong>
              </p>
            </fieldset>
          </div>

          <div className={styles.row}>
            <NumberField
              text={f.low}
              value={mgToG(draft.lowUpToMgPerHour)}
              onChange={(v) =>
                setDraft({ ...draft, lowUpToMgPerHour: gToMg(Math.max(0, v)) })
              }
              step={0.5}
            />
            <NumberField
              text={f.high}
              value={mgToG(draft.highFromMgPerHour)}
              onChange={(v) =>
                setDraft({ ...draft, highFromMgPerHour: gToMg(Math.max(0, v)) })
              }
              step={0.5}
            />
          </div>
          <p className={styles.hint}>{fill(f.bands, { list: bandList })}</p>
          <p className={styles.hint}>
            {fill(f.totals, {
              n: scheme.payments,
              in: formatPlay(scheme.surchargesIn),
              out: formatPlay(scheme.discountsOut),
              sub: formatPlay(scheme.subsidiesOut)
            })}
          </p>

          {fee.isDraft && (
            <div className={styles.draft}>
              <p>{fill(f.draft, { id: scheme.id })}</p>
              <div className={styles.actions}>
                <button type="button" onClick={fee.resetDraft}>
                  {fill(f.reset, { id: scheme.id })}
                </button>
                {address && chain?.id === CARBON_CHOICE_CHAIN_ID && (
                  <>
                    {isOwner && (
                      <button
                        type="button"
                        disabled={status?.kind === 'busy'}
                        onClick={() =>
                          send((c) => c.setRules(scheme.id, rules))
                        }
                      >
                        {fill(f.saveRules, { id: scheme.id })}
                      </button>
                    )}
                    <input
                      className={styles.labelInput}
                      value={label ?? f.labelDefault}
                      maxLength={80}
                      onChange={(e) => setLabel(e.target.value)}
                      aria-label="label"
                    />
                    <button
                      type="button"
                      disabled={status?.kind === 'busy'}
                      onClick={() =>
                        send(
                          (c) => c.createScheme(label ?? f.labelDefault, rules),
                          (receipt, iface) => {
                            const ev = findEvent(
                              receipt,
                              iface,
                              'SchemeCreated'
                            )
                            if (ev) fee.setSchemeId(ev.args.schemeId.toNumber())
                          }
                        )
                      }
                    >
                      {f.createScheme}
                    </button>
                  </>
                )}
              </div>
              <p className={styles.hint}>{f.createHint}</p>
            </div>
          )}

          <h3>
            {fill(f.wallet, { v: balance != null ? formatPlay(balance) : '—' })}
          </h3>
          {!address ? (
            <div className={styles.actions}>
              <button type="button" onClick={() => setOpen(true)}>
                {f.connect}
              </button>
            </div>
          ) : chain?.id !== CARBON_CHOICE_CHAIN_ID ? (
            <div className={styles.actions}>
              <button type="button" onClick={() => switchNetwork?.()}>
                Sepolia
              </button>
            </div>
          ) : (
            <>
              <div className={styles.actions}>
                <button
                  type="button"
                  disabled={status?.kind === 'busy'}
                  onClick={() => send((c) => c.faucet())}
                >
                  {f.faucet}
                </button>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={
                    status?.kind === 'busy' || !chosenQuote || !chosenPriced
                  }
                  onClick={() =>
                    chosenKey &&
                    send(
                      (c) =>
                        c.pay(
                          scheme.id,
                          chosenKey,
                          fee.seconds,
                          refHash ? '0x' + refHash : ethers.constants.HashZero
                        ),
                      (receipt, iface) => {
                        const ev = findEvent(receipt, iface, 'Paid')
                        return ev
                          ? fill(f.paid, { id: ev.args.paymentId.toNumber() })
                          : undefined
                      }
                    )
                  }
                >
                  {chosenKey && chosenQuote
                    ? fill(f.payButton, {
                        place: placeName(chosenKey),
                        // 実際に払うのは Sepolia 上の設定
                        pay: formatPlay(
                          quoteFee(
                            fee.locations[chosenKey],
                            scheme.rules,
                            scheme,
                            fee.seconds
                          ).payerPays
                        )
                      })
                    : f.payNotPriced}
                </button>
              </div>
              <p className={styles.hint}>
                {chosenPriced ? f.payHint : f.payNotPriced}
              </p>
              <div className={styles.actions}>
                <NumberField
                  text={f.depositAmount}
                  value={depositPlay}
                  onChange={setDepositPlay}
                />
                <button
                  type="button"
                  disabled={status?.kind === 'busy' || !(depositPlay > 0)}
                  onClick={() =>
                    send((c) =>
                      c.deposit(scheme.id, Math.round(depositPlay * MICRO))
                    )
                  }
                >
                  {fill(f.depositButton, { id: scheme.id })}
                </button>
                {isOwner && scheme.deposit > 0 && (
                  <button
                    type="button"
                    disabled={status?.kind === 'busy'}
                    onClick={() =>
                      send((c) => c.withdraw(scheme.id, scheme.deposit))
                    }
                  >
                    {f.withdrawButton}
                  </button>
                )}
              </div>
            </>
          )}
          {status?.kind === 'busy' && <p>{f.busy}</p>}
          {status?.kind === 'done' && (
            <p className={styles.ok}>
              {status.text}{' '}
              <a
                href={`${EXPLORER}/tx/${status.tx}`}
                target="_blank"
                rel="noreferrer"
              >
                {f.tx}
              </a>
            </p>
          )}
          {status?.kind === 'error' && (
            <p className={styles.error}>
              {fill(f.error, { message: status.message })}
            </p>
          )}

          <h3>{fill(f.ledger, { id: scheme.id })}</h3>
          <p className={styles.hint}>{f.ledgerHint}</p>
          {!fee.ledger ? (
            <p>{f.loading}</p>
          ) : fee.ledger.length === 0 ? (
            <p>{f.ledgerNone}</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{f.col.id}</th>
                    <th>{f.col.date}</th>
                    <th>{f.col.payer}</th>
                    <th>{f.col.place}</th>
                    <th>{f.col.base}</th>
                    <th>{f.col.surcharge}</th>
                    <th>{f.col.discount}</th>
                    <th>{f.col.subsidy}</th>
                    <th>{f.col.pays}</th>
                    <th>{f.col.tx}</th>
                  </tr>
                </thead>
                <tbody>
                  {fee.ledger.map((p) => (
                    <tr key={p.id}>
                      <td>{`#${p.id}`}</td>
                      <td>{dateFmt(p.paidAt)}</td>
                      <td>{ownerName(p.payer)}</td>
                      <td>{placeName(p.locationKey)}</td>
                      <td>{formatPlay(p.base)}</td>
                      <td>
                        {p.surcharge ? `+${formatPlay(p.surcharge)}` : ''}
                      </td>
                      <td>{p.discount ? `−${formatPlay(p.discount)}` : ''}</td>
                      <td>{p.subsidy ? `−${formatPlay(p.subsidy)}` : ''}</td>
                      <td>
                        <strong>{formatPlay(p.payerPays)}</strong>
                      </td>
                      <td>
                        {p.tx && (
                          <a
                            href={`${EXPLORER}/tx/${p.tx}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {short(p.tx)}
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {fee.deposits && fee.deposits.length > 0 && (
            <>
              <h3>{f.deposits}</h3>
              <ul className={styles.depositList}>
                {fee.deposits.map((d) => (
                  <li key={d.tx}>
                    <a
                      href={`${EXPLORER}/tx/${d.tx}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {fill(f.depositRow, {
                        from: ownerName(d.from),
                        v: formatPlay(d.amount)
                      })}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className={styles.caution}>{f.caution}</p>
          <p className={styles.footnote}>
            {f.contract.split('{address}')[0]}
            <a
              href={`${EXPLORER}/address/${GREEN_FEE_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
            >
              <code>{short(GREEN_FEE_ADDRESS)}</code>
            </a>
            {f.contract.split('{address}')[1]}
          </p>
        </>
      )}
    </section>
  )
}
