import { ReactElement, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import useLocaleContent from '../../i18n/useLocaleContent'
import contentEn from '../../../content/experiment.json'
import contentJa from '../../../content/experiment.ja.json'
import trialsJson from '../../../content/experiment/trials.json'
import {
  Condition,
  ResultsFile,
  TrialRecord,
  TrialsFile,
  buildTrialRecord,
  computeTrial,
  parseCondition,
  randomCondition,
  resultsToCSV,
  shuffled
} from '@utils/experiment'
import type { Quantity } from '@utils/transactionFootprint'
import ExperimentDesign from './Design'
import ExperimentReceipt from './Receipt'
import { QualityBadge, download, fill, num, pick } from './shared'
import styles from './index.module.css'

type Content = typeof contentEn

const TRIALS = trialsJson as unknown as TrialsFile
const K_COND = 'cliox-exp-condition'
const K_PID = 'cliox-exp-pid'

function readStore(key: string): string | undefined {
  try {
    return window.sessionStorage.getItem(key) ?? undefined
  } catch {
    return undefined
  }
}
function writeStore(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value)
  } catch {
    /* sessionStorage が使えなくても実験は続けられる */
  }
}

function QuantityRow({
  label,
  q,
  unit,
  c
}: {
  label: string
  q: Quantity
  unit: string
  c: Content
}): ReactElement {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {q.value !== undefined && (
          <>
            {num(q.value)} {unit}
          </>
        )}
        <QualityBadge
          quality={q.quality}
          label={c.quality[q.quality as keyof Content['quality']]}
        />
        {q.value === undefined && q.reason && (
          <span className={styles.reason}>{q.reason}</span>
        )}
      </dd>
    </div>
  )
}

export default function Experiment(): ReactElement {
  const c = useLocaleContent(contentEn, contentJa)
  const router = useRouter()
  const ja = router.locale === 'ja'
  const view = typeof router.query.view === 'string' ? router.query.view : ''

  const [ready, setReady] = useState(false)
  const [condition, setCondition] = useState<Condition>('control')
  const [pid, setPid] = useState('')
  const [phase, setPhase] = useState<'start' | 'trial' | 'done'>('start')
  const [index, setIndex] = useState(0)
  const [order, setOrder] = useState<string[]>([])
  const [selected, setSelected] = useState<string>()
  const [records, setRecords] = useState<TrialRecord[]>([])
  const [startedAt, setStartedAt] = useState('')
  const [finishedAt, setFinishedAt] = useState('')
  const shownAt = useRef(0)
  const firstChoiceAt = useRef<number>()
  const changed = useRef(false)

  // 条件の割り当て: ?condition= があればそれ、無ければ sessionStorage、
  // 無ければ最初の表示でランダム。サーバー描画では決めない。
  useEffect(() => {
    if (!router.isReady) return
    const fromQuery = parseCondition(router.query.condition)
    const stored = parseCondition(readStore(K_COND))
    const cond = fromQuery ?? stored ?? randomCondition()
    writeStore(K_COND, cond)
    setCondition(cond)
    const q = router.query.pid
    const p = (typeof q === 'string' ? q : undefined) ?? readStore(K_PID) ?? ''
    setPid(p.slice(0, 40))
    setReady(true)
  }, [router.isReady, router.query.condition, router.query.pid])

  const trial = TRIALS.trials[index]
  const computed = useMemo(
    () => (trial ? computeTrial(trial) : undefined),
    [trial]
  )

  function showTrial(i: number) {
    setIndex(i)
    setOrder(shuffled(TRIALS.trials[i].options.map((o) => o.id)))
    setSelected(undefined)
    firstChoiceAt.current = undefined
    changed.current = false
    shownAt.current = performance.now()
  }

  function begin() {
    writeStore(K_PID, pid)
    setStartedAt(new Date().toISOString())
    setRecords([])
    showTrial(0)
    setPhase('trial')
  }

  function choose(id: string) {
    const now = performance.now()
    if (firstChoiceAt.current === undefined) firstChoiceAt.current = now
    else if (selected !== id) changed.current = true
    setSelected(id)
  }

  function confirm() {
    if (!selected || !trial) return
    const now = performance.now()
    const rec = buildTrialRecord({
      trial,
      trialIndex: index,
      condition,
      pid,
      displayedOrder: order,
      chosen: selected,
      responseMs: now - shownAt.current,
      firstChoiceMs: (firstChoiceAt.current ?? now) - shownAt.current,
      changedChoice: changed.current,
      now: new Date()
    })
    const next = [...records, rec]
    setRecords(next)
    if (index + 1 < TRIALS.trials.length) {
      showTrial(index + 1)
      window.scrollTo?.(0, 0)
    } else {
      setFinishedAt(new Date().toISOString())
      setPhase('done')
    }
  }

  function resultsFile(): ResultsFile {
    return {
      schema: 'clio-x-sustainability-experiment-results/0.1',
      trialsVersion: TRIALS.version,
      condition,
      pid,
      startedAt,
      finishedAt,
      records
    }
  }

  if (view === 'design') return <ExperimentDesign c={c} ja={ja} />
  if (view === 'receipt') return <ExperimentReceipt c={c} ja={ja} />
  if (!ready) return <div className={styles.page} />

  const total = TRIALS.trials.length

  if (phase === 'start') {
    return (
      <div className={styles.page}>
        <section className={styles.panel}>
          <h2>{c.start.heading}</h2>
          {c.start.intro.map((p) => (
            <p key={p}>{fill(p, { count: total })}</p>
          ))}
          <h2>{c.start.priorityHeading}</h2>
          <p className={styles.priority}>
            {pick(TRIALS.priorityStatement, ja)}
          </p>
          <p className={styles.demo}>{pick(TRIALS.demoNotice, ja)}</p>
          <label className={styles.field}>
            <span>{c.start.pidLabel}</span>
            <input
              value={pid}
              maxLength={40}
              onChange={(e) => setPid(e.target.value)}
              autoComplete="off"
            />
            <small>{c.start.pidHint}</small>
          </label>
          <div className={styles.actions}>
            <button type="button" className={styles.button} onClick={begin}>
              {c.start.begin}
            </button>
          </div>
        </section>
      </div>
    )
  }

  if (phase === 'done') {
    const file = resultsFile()
    const name = `experiment-results${pid ? '-' + pid : ''}`
    return (
      <div className={styles.page}>
        <section className={styles.panel}>
          <h2>{c.done.heading}</h2>
          {c.done.body.map((p) => (
            <p key={p}>{p}</p>
          ))}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.button}
              onClick={() =>
                download(
                  `${name}.json`,
                  JSON.stringify(file, null, 2) + '\n',
                  'application/json'
                )
              }
            >
              {c.done.downloadJson}
            </button>
            <button
              type="button"
              className={`${styles.button} ${styles.secondary}`}
              onClick={() =>
                download(`${name}.csv`, resultsToCSV(file.records), 'text/csv')
              }
            >
              {c.done.downloadCsv}
            </button>
          </div>
        </section>
      </div>
    )
  }

  const byId = new Map(computed!.options.map((o) => [o.option.id, o]))
  const last = index + 1 === total

  return (
    <div className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.progress}>
          {fill(c.trial.progress, { n: index + 1, total })}
        </div>
        <p className={styles.priority}>{pick(TRIALS.priorityStatement, ja)}</p>
        <p className={styles.job}>
          <strong>{c.trial.job}:</strong> {pick(trial.job, ja)}
        </p>
        <p className={styles.demo}>{pick(TRIALS.demoNotice, ja)}</p>
        <p>{c.trial.choose}</p>
        <div className={styles.cards} role="radiogroup">
          {order.map((id) => {
            const { option: o, footprint: f } = byId.get(id)!
            const isSel = selected === id
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={isSel}
                className={`${styles.card} ${isSel ? styles.cardSelected : ''}`}
                onClick={() => choose(id)}
              >
                <span className={styles.cardTitle}>{o.provider}</span>
                <dl className={styles.rows}>
                  <div>
                    <dt>{c.card.cost}</dt>
                    <dd>USD {o.costUSD.toFixed(2)}</dd>
                  </div>
                  <div>
                    <dt>{c.card.location}</dt>
                    <dd>{pick(o.location, ja)}</dd>
                  </div>
                  <div>
                    <dt>{c.card.jurisdiction}</dt>
                    <dd>{pick(o.jurisdiction, ja)}</dd>
                  </div>
                  <div>
                    <dt>{c.card.indigenous}</dt>
                    <dd>{c.card.suitability[o.governance.indigenousData]}</dd>
                  </div>
                  <div>
                    <dt>{c.card.certifications}</dt>
                    <dd>
                      {o.certifications.length
                        ? o.certifications.join(', ')
                        : c.card.none}
                    </dd>
                  </div>
                  {condition === 'treatment' && (
                    <>
                      <div className={styles.sep}>
                        <dt>{c.trial.perTransaction}</dt>
                      </div>
                      <QuantityRow
                        label={c.card.energy}
                        q={f.facilityEnergy}
                        unit="kWh"
                        c={c}
                      />
                      <QuantityRow
                        label={c.card.water}
                        q={f.water}
                        unit="L"
                        c={c}
                      />
                      <QuantityRow
                        label={c.card.carbon}
                        q={f.carbon}
                        unit="gCO2e"
                        c={c}
                      />
                    </>
                  )}
                </dl>
                <span className={styles.pick}>
                  {isSel ? c.trial.selected : c.trial.select}
                </span>
              </button>
            )
          })}
        </div>
        {condition === 'treatment' && (
          <p className={styles.note}>{c.card.estimatesNote}</p>
        )}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.button}
            disabled={!selected}
            onClick={confirm}
          >
            {last ? c.trial.confirmLast : c.trial.confirmNext}
          </button>
          {!selected && (
            <span className={styles.note}>{c.trial.needChoice}</span>
          )}
        </div>
      </section>
    </div>
  )
}
