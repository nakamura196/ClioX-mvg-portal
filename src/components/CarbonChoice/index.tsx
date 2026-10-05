import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { ethers } from 'ethers'
import { useAccount, useNetwork, useSigner, useSwitchNetwork } from 'wagmi'
import { useModal } from 'connectkit'
import useLocaleContent from '../../i18n/useLocaleContent'
import contentEn from '../../../content/carbonChoice.json'
import contentJa from '../../../content/carbonChoice.ja.json'
import {
  ComputeLocation,
  DataQuality,
  formatGCO2e
} from '@utils/computeFootprint'
import { sha256Hex } from '@utils/carbonReport'
import {
  CARBON_CHOICE_ABI,
  CARBON_CHOICE_ADDRESS,
  CARBON_CHOICE_CHAIN_ID,
  QUALITY_FROM_CODE,
  buildChoiceRecord,
  choiceRecordToText,
  planChoice
} from '@utils/carbonChoice'
import { getOceanConfig } from '@utils/ocean'
import GreenFeePanel, { FeeLine, useGreenFee } from './GreenFee'
import Help from './Help'
import styles from './index.module.css'

type Content = typeof contentEn

const EXPLORER = 'https://sepolia.etherscan.io'

interface OnChainRecord {
  id: number
  recordHash: string
  locationKey: string
  chosenMgCO2e: number
  highestMgCO2e: number
  alternatives: number
  quality: DataQuality
  issuedAt: Date
}

function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? ''))
}

function shortAddress(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

function Badge({ quality, c }: { quality: DataQuality; c: Content }) {
  const cls =
    quality === 'measured'
      ? styles.measured
      : quality === 'unknown'
      ? styles.unknown
      : styles.estimated
  return <span className={`${styles.badge} ${cls}`}>{c.quality[quality]}</span>
}

function readProvider() {
  return new ethers.providers.JsonRpcProvider(
    getOceanConfig(CARBON_CHOICE_CHAIN_ID).nodeUri
  )
}

async function loadRecords(holder: string): Promise<OnChainRecord[]> {
  const contract = new ethers.Contract(
    CARBON_CHOICE_ADDRESS,
    CARBON_CHOICE_ABI,
    readProvider()
  )
  const ids: ethers.BigNumber[] = await contract.tokensOf(holder)
  const records = await Promise.all(
    ids.map(async (id) => {
      const r = await contract.getRecord(id)
      return {
        id: id.toNumber(),
        recordHash: (r.recordHash as string).replace(/^0x/, ''),
        locationKey: r.locationKey,
        chosenMgCO2e: Number(r.chosenMgCO2e),
        highestMgCO2e: Number(r.highestMgCO2e),
        alternatives: Number(r.alternatives),
        quality: QUALITY_FROM_CODE[r.quality] ?? 'unknown',
        issuedAt: new Date(Number(r.issuedAt) * 1000)
      }
    })
  )
  return records.reverse()
}

export default function CarbonChoice(): ReactElement {
  const c = useLocaleContent(contentEn, contentJa)
  const router = useRouter()
  const ja = router.locale === 'ja'

  const locName = (loc?: ComputeLocation) =>
    loc && (ja ? loc.label : loc.en?.label ?? loc.label)
  const locPlace = (loc?: ComputeLocation) =>
    loc &&
    (ja
      ? loc.processingLocation
      : loc.en?.processingLocation ?? loc.processingLocation)

  // ---- 1. 仕事 ----
  const [purpose, setPurpose] = useState<string>()
  const [jobs, setJobs] = useState(40)
  const [minutes, setMinutes] = useState(30)
  const purposeText = purpose ?? c.work.purposeDefault
  const plan = useMemo(() => planChoice(jobs, minutes), [jobs, minutes])

  // ---- 2. 選択 ----
  const [chosenKey, setChosenKey] = useState<string>()
  const key = chosenKey ?? plan.ranked[0]?.key
  const highest = plan.ranked[plan.ranked.length - 1]
  const maxG = highest?.footprint.gCO2e ?? 0
  const nameOf = (k: string) =>
    locName(plan.ranked.find((o) => o.key === k)?.footprint.location) ?? k

  // ---- ジョブ ID（Compute の詳細から来たとき）----
  const jobId =
    typeof router.query.job === 'string' && router.query.job
      ? router.query.job.slice(0, 200)
      : undefined
  const [jobHash, setJobHash] = useState<string>()
  useEffect(() => {
    let alive = true
    setJobHash(undefined)
    if (jobId) sha256Hex(jobId).then((h) => alive && setJobHash(h))
    return () => {
      alive = false
    }
  }, [jobId])

  // ---- 3. 利用料 ----
  const fee = useGreenFee(plan.durationSeconds)

  // ---- 3. 記録 ----
  // 作成時刻は入力が変わった時点で決める。サーバー描画とずれないようブラウザで決める
  const [now, setNow] = useState<Date>()
  useEffect(() => {
    setNow(new Date())
  }, [purposeText, jobs, minutes, key])
  const built = useMemo(
    () =>
      now && key
        ? buildChoiceRecord({ plan, chosenKey: key, purpose: purposeText, now })
        : undefined,
    [plan, key, purposeText, now]
  )
  const text = useMemo(
    () => (built ? choiceRecordToText(built.record) : undefined),
    [built]
  )
  const [hash, setHash] = useState<string>()
  const [downloaded, setDownloaded] = useState(false)
  useEffect(() => {
    let alive = true
    setHash(undefined)
    setDownloaded(false)
    if (text) sha256Hex(text).then((h) => alive && setHash(h))
    return () => {
      alive = false
    }
  }, [text])

  const download = () => {
    if (!text || !hash) return
    const url = URL.createObjectURL(
      new Blob([text], { type: 'application/json' })
    )
    const a = document.createElement('a')
    a.href = url
    a.download = `carbon-choice-${hash.slice(0, 12)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    setDownloaded(true)
  }

  // ---- ウォレット ----
  const { address } = useAccount()
  const { chain } = useNetwork()
  const { switchNetwork } = useSwitchNetwork({
    chainId: CARBON_CHOICE_CHAIN_ID
  })
  const { data: signer } = useSigner()
  const { setOpen } = useModal()
  const [status, setStatus] = useState<
    | { kind: 'busy' }
    | { kind: 'done'; id: number; tx: string }
    | { kind: 'error'; message: string }
  >()

  // ---- 4. 一覧 ----
  const queryHolder =
    typeof router.query.holder === 'string' &&
    ethers.utils.isAddress(router.query.holder)
      ? router.query.holder
      : undefined
  const holder = queryHolder ?? address
  const [records, setRecords] = useState<OnChainRecord[]>()
  const refresh = useCallback(() => {
    if (!holder) return
    setRecords(undefined)
    loadRecords(holder)
      .then(setRecords)
      .catch(() => setRecords([]))
  }, [holder])
  useEffect(refresh, [refresh])

  const record = async () => {
    if (!signer || !built || !hash) return
    setStatus({ kind: 'busy' })
    try {
      const contract = new ethers.Contract(
        CARBON_CHOICE_ADDRESS,
        CARBON_CHOICE_ABI,
        signer
      )
      const a = built.args
      const tx = await contract.record(
        '0x' + hash,
        a.locationKey,
        a.chosenMgCO2e,
        a.highestMgCO2e,
        a.alternatives,
        a.quality
      )
      const receipt = await tx.wait()
      const iface = new ethers.utils.Interface(CARBON_CHOICE_ABI)
      const ev = receipt.logs
        .map((l: ethers.providers.Log) => {
          try {
            return iface.parseLog(l)
          } catch {
            return undefined
          }
        })
        .find((e) => e?.name === 'ChoiceRecorded')
      setStatus({
        kind: 'done',
        id: ev ? ev.args.tokenId.toNumber() : 0,
        tx: receipt.transactionHash
      })
      refresh()
    } catch (e) {
      const err = e as { reason?: string; message?: string }
      setStatus({
        kind: 'error',
        message: err.reason ?? err.message?.split('\n')[0] ?? String(e)
      })
    }
  }

  // If the wallet disconnects or locks while a request is pending, the
  // request never answers; don't leave "waiting…" on screen.
  useEffect(() => {
    if (!address) setStatus((s) => (s?.kind === 'busy' ? undefined : s))
  }, [address])

  const [checkResult, setCheckResult] = useState<{
    ok: boolean
    text: string
  }>()
  const checkFile = async (file?: File) => {
    if (!file) return
    const h = await sha256Hex(await file.text())
    const hit = records?.find((r) => r.recordHash === h)
    setCheckResult(
      hit
        ? { ok: true, text: fill(c.mine.match, { id: hit.id }) }
        : { ok: false, text: c.mine.noMatch }
    )
  }

  const dateFmt = (d: Date) =>
    d.toLocaleString(ja ? 'ja-JP' : 'en-CA', {
      dateStyle: 'medium',
      timeStyle: 'short'
    })
  const chosen = plan.ranked.find((o) => o.key === key)

  return (
    <div className={styles.page}>
      <div className={styles.intro}>
        {c.intro.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>

      <section className={styles.panel}>
        <h2>{c.work.heading}</h2>
        <label className={styles.field}>
          <span>{c.work.purpose}</span>
          <input
            value={purposeText}
            onChange={(e) => setPurpose(e.target.value)}
          />
        </label>
        <div className={styles.row}>
          <label className={`${styles.field} ${styles.num}`}>
            <span>{c.work.jobs}</span>
            <input
              type="number"
              min={0}
              value={jobs}
              onChange={(e) => setJobs(Number(e.target.value))}
            />
          </label>
          <label className={`${styles.field} ${styles.num}`}>
            <span>{c.work.minutes}</span>
            <input
              type="number"
              min={0}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            />
          </label>
        </div>
        <p className={styles.hint}>{c.work.hint}</p>
      </section>

      <section className={styles.panel}>
        <h2>{c.options.heading}</h2>
        <p className={styles.hint}>
          gCO2e
          <Help label={c.fee.helpLabel} text={c.fee.helpGco2e} />
        </p>
        <ul className={styles.options}>
          {plan.ranked.map((o, i) => {
            const f = o.footprint
            const pct = maxG > 0 ? (f.gCO2e / maxG) * 100 : 0
            return (
              <li key={o.key}>
                <label
                  className={`${styles.option} ${
                    o.key === key ? styles.selected : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="location"
                    checked={o.key === key}
                    onChange={() => setChosenKey(o.key)}
                  />
                  <span className={styles.optName}>
                    <strong>{locName(f.location)}</strong>
                    <small>{locPlace(f.location)}</small>
                  </span>
                  <span className={styles.optBar} aria-hidden>
                    <span style={{ width: `${Math.max(pct, 0.5)}%` }} />
                  </span>
                  <span className={styles.optValue}>
                    <strong>{formatGCO2e(f.gCO2e)}</strong>
                    {i === 0 && (
                      <span className={styles.lowest}>{c.options.lowest}</span>
                    )}
                    <Badge quality={f.quality} c={c} />
                    {fee.locations ? (
                      <FeeLine
                        q={fee.quoteFor(o.key)}
                        f={c.fee}
                        priced={!!fee.locations[o.key]}
                      />
                    ) : (
                      f.usdCost != null && (
                        <small>{`${c.options.cost} $${f.usdCost.toFixed(
                          2
                        )}`}</small>
                      )
                    )}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>

        {plan.unranked.length > 0 && (
          <div className={styles.unranked}>
            <h3>{c.options.notComparable}</h3>
            <p className={styles.hint}>{c.options.notComparableHint}</p>
            <ul>
              {plan.unranked.map((o) => (
                <li key={o.key}>
                  {`${locName(o.footprint.location) ?? o.key} — ${
                    locPlace(o.footprint.location) ?? ''
                  }`}{' '}
                  <Badge quality="unknown" c={c} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {chosen && built && highest && (
          <div className={styles.summary}>
            <p>
              {fill(c.options.chosenLine, {
                chosen: nameOf(chosen.key),
                g: formatGCO2e(chosen.footprint.gCO2e)
              })}{' '}
              {built.differenceG > 0
                ? fill(c.options.difference, {
                    highest: nameOf(highest.key),
                    hg: formatGCO2e(highest.footprint.gCO2e),
                    d: formatGCO2e(built.differenceG)
                  })
                : c.options.differenceZero}
            </p>
            <p className={styles.caution}>{c.options.caution}</p>
          </div>
        )}
      </section>

      <GreenFeePanel
        fee={fee}
        f={c.fee}
        chosenKey={key}
        placeName={nameOf}
        refHash={hash}
        jobId={jobId}
        jobHash={jobHash}
      />

      <section className={styles.panel}>
        <h2>{c.record.heading}</h2>
        <p>{c.record.what}</p>
        <dl className={styles.hash}>
          <dt>{c.record.fingerprint}</dt>
          <dd>
            <code>{hash ?? '…'}</code>
          </dd>
        </dl>
        <div className={styles.actions}>
          <button type="button" onClick={download} disabled={!hash}>
            {c.record.download}
          </button>
          {!address ? (
            <>
              <button type="button" onClick={() => setOpen(true)}>
                {c.record.connectButton}
              </button>
              <p className={styles.hint}>{c.record.connect}</p>
            </>
          ) : chain?.id !== CARBON_CHOICE_CHAIN_ID ? (
            <button type="button" onClick={() => switchNetwork?.()}>
              {c.record.switch}
            </button>
          ) : (
            <button
              type="button"
              className={styles.primary}
              onClick={record}
              disabled={!downloaded || !signer || status?.kind === 'busy'}
              title={downloaded ? undefined : c.record.downloadFirst}
            >
              {c.record.button}
            </button>
          )}
        </div>
        {address && !downloaded && (
          <p className={styles.hint}>{c.record.downloadFirst}</p>
        )}
        {status?.kind === 'busy' && <p>{c.record.busy}</p>}
        {status?.kind === 'done' && (
          <p className={styles.ok}>
            {fill(c.record.done, { id: status.id })}{' '}
            <a
              href={`${EXPLORER}/tx/${status.tx}`}
              target="_blank"
              rel="noreferrer"
            >
              {c.record.tx}
            </a>
          </p>
        )}
        {status?.kind === 'error' && (
          <p className={styles.error}>
            {fill(c.record.error, { message: status.message })}
          </p>
        )}
      </section>

      {holder && (
        <section className={styles.panel}>
          <h2>{c.mine.heading}</h2>
          <p className={styles.hint}>
            {fill(c.mine.of, { address: shortAddress(holder) })}{' '}
            <a href={`${router.asPath.split('?')[0]}?holder=${holder}`}>
              {c.mine.share}
            </a>
          </p>
          {!records ? (
            <p>{c.mine.loading}</p>
          ) : records.length === 0 ? (
            <p>{c.mine.none}</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{c.mine.token}</th>
                    <th>{c.mine.location}</th>
                    <th>{c.mine.chosen}</th>
                    <th>{c.mine.highest}</th>
                    <th>{c.mine.options}</th>
                    <th>{c.mine.quality}</th>
                    <th>{c.mine.date}</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <a
                          href={`${EXPLORER}/nft/${CARBON_CHOICE_ADDRESS}/${r.id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {`#${r.id}`}
                        </a>
                      </td>
                      <td>{nameOf(r.locationKey)}</td>
                      <td>{formatGCO2e(r.chosenMgCO2e / 1000)}</td>
                      <td>{formatGCO2e(r.highestMgCO2e / 1000)}</td>
                      <td>{r.alternatives}</td>
                      <td>
                        <Badge quality={r.quality} c={c} />
                      </td>
                      <td>{dateFmt(r.issuedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {records && records.length > 0 && (
            <label className={styles.field}>
              <span>{c.mine.check}</span>
              <input
                type="file"
                accept="application/json,.json"
                onChange={(e) => checkFile(e.target.files?.[0])}
              />
              <small>{c.mine.checkHint}</small>
            </label>
          )}
          {checkResult && (
            <p className={checkResult.ok ? styles.ok : styles.error}>
              {checkResult.text}
            </p>
          )}
        </section>
      )}

      <p className={styles.footnote}>
        {c.footnote.split('{address}')[0]}
        <a
          href={`${EXPLORER}/address/${CARBON_CHOICE_ADDRESS}`}
          target="_blank"
          rel="noreferrer"
        >
          <code>{shortAddress(CARBON_CHOICE_ADDRESS)}</code>
        </a>
        {c.footnote.split('{address}')[1]}
      </p>
    </div>
  )
}
