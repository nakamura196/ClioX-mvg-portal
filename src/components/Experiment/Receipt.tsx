import { ReactElement, useMemo } from 'react'
import { useRouter } from 'next/router'
import trialsJson from '../../../content/experiment/trials.json'
import { TrialsFile, optionFootprint, optionInput } from '@utils/experiment'
import { receiptSha256 } from '@utils/receiptAttestation'
import { stripHexPrefix } from '@utils/canonicalJson'
import { receiptSteps } from '@utils/receiptSteps'
import {
  Quantity,
  buildSourceData,
  buildTransactionReceipt
} from '@utils/transactionFootprint'
import Sign from './Sign'
import Verify from './Verify'
import { QualityBadge, download, num, pick } from './shared'
import styles from './index.module.css'

const TRIALS = trialsJson as unknown as TrialsFile

// 見本のジョブ: 課題 t5 の選択肢 d(2 区間・流量方式の水)。時刻は固定。
const SAMPLE_TRIAL = 't5'
const SAMPLE_OPTION = 'd'

export default function ExperimentReceipt({
  c,
  ja
}: {
  c: typeof import('../../../content/experiment.json')
  ja: boolean
}): ReactElement {
  const r = c.receipt
  const router = useRouter()
  // 計算の過程の表示は ?steps=1 で持つ。リンクを渡せば開いた状態で見せられる
  const showSteps = router.query.steps === '1'
  function toggleSteps(on: boolean) {
    const query = { ...router.query }
    if (on) query.steps = '1'
    else delete query.steps
    router.replace({ pathname: router.pathname, query }, undefined, {
      shallow: true,
      scroll: false
    })
  }
  const option = TRIALS.trials
    .find((t) => t.id === SAMPLE_TRIAL)!
    .options.find((o) => o.id === SAMPLE_OPTION)!
  const { receipt, source } = useMemo(() => {
    const input = optionInput(option)
    const footprint = optionFootprint(option)
    const common = {
      transactionId: 'demo-2026-10-09-0001',
      provider: option.provider,
      location: {
        name: option.location.en,
        jurisdiction: option.jurisdiction.en
      },
      input,
      startedAtTime: '2026-10-09T09:00:00Z',
      endedAtTime: '2026-10-09T10:00:00Z'
    }
    const receipt = buildTransactionReceipt({
      ...common,
      footprint,
      evidence: [
        {
          ref: 'demo://telemetry/pool-power/2026-10-09T09:00Z-10:00Z',
          description: 'Pool power samples (demo placeholder, no real source)'
        },
        {
          ref: 'demo://telemetry/water-flow/2026-10-09T09:00Z-10:00Z',
          description: 'Cooling water flow samples (demo placeholder)'
        }
      ]
    })
    return { receipt, source: buildSourceData(common) }
  }, [option])

  const text = useMemo(() => JSON.stringify(receipt, null, 2) + '\n', [receipt])
  const sourceText = useMemo(
    () => JSON.stringify(source, null, 2) + '\n',
    [source]
  )
  const hash = stripHexPrefix(receiptSha256(receipt))
  const steps = useMemo(() => receiptSteps(receipt, source), [receipt, source])

  const rows: [string, Quantity][] = [
    [r.itEnergy, receipt.values.itEnergy],
    [r.facilityEnergy, receipt.values.facilityEnergy],
    [r.water, receipt.values.water],
    [r.carbon, receipt.values.carbon]
  ]
  const a = receipt.assumptions

  return (
    <div className={styles.page}>
      <section className={styles.panel}>
        <h2>{r.heading}</h2>
        <p>{r.intro}</p>
        <p className={styles.demo}>{r.sampleNote}</p>
        <dl className={styles.rows}>
          <div>
            <dt>{r.transaction}</dt>
            <dd className={styles.mono}>{receipt.transactionId}</dd>
          </div>
          <div>
            <dt>{r.provider}</dt>
            <dd>{receipt.provider}</dd>
          </div>
          <div>
            <dt>{r.location}</dt>
            <dd>
              {pick(option.location, ja)} / {pick(option.jurisdiction, ja)}
            </dd>
          </div>
          <div>
            <dt>{r.period}</dt>
            <dd className={styles.mono}>
              {receipt.startedAtTime} / {receipt.endedAtTime}
            </dd>
          </div>
          <div>
            <dt>{r.allocation}</dt>
            <dd>{r.allocationValues[receipt.allocation.basis]}</dd>
          </div>
          <div>
            <dt>{r.method}</dt>
            <dd className={styles.mono}>{receipt.allocation.method}</dd>
          </div>
        </dl>
      </section>

      <section className={styles.panel}>
        <h2>{r.intervals}</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{r.colInterval}</th>
                <th>{r.colPower}</th>
                <th>{r.colHours}</th>
                <th>{r.colShare}</th>
                <th>{r.colWaterFlow}</th>
              </tr>
            </thead>
            <tbody>
              {receipt.allocation.intervals.map((iv, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{num(iv.powerKW, c.missing)}</td>
                  <td>{num(iv.hours)}</td>
                  <td>{num(iv.share)}</td>
                  <td>{num(iv.waterLPerHour ?? a.water?.value, c.missing)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.panel}>
        <h2>{r.totals}</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th></th>
                <th>{r.value}</th>
                <th>{r.quality}</th>
                <th>{r.basis}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, q]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td>
                    {q.value !== undefined
                      ? `${num(q.value)} ${q.unit}`
                      : c.quality.unknown}
                  </td>
                  <td>
                    <QualityBadge
                      quality={q.quality}
                      label={c.quality[q.quality as keyof typeof c.quality]}
                    />
                  </td>
                  <td>{q.value !== undefined ? q.basis : q.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {receipt.notes.map((n) => (
          <p className={styles.note} key={n}>
            {r.notes}: {n}
          </p>
        ))}
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={showSteps}
            onChange={(e) => toggleSteps(e.target.checked)}
            data-testid="steps-toggle"
          />
          {r.stepsToggle}
        </label>
      </section>

      {showSteps && (
        <section className={styles.panel} data-testid="receipt-steps">
          <h2>{r.stepsHeading}</h2>
          <p className={styles.note}>{r.stepsIntro}</p>
          {steps.map((s) => (
            <div className={styles.step} key={s.key}>
              <h3>
                {r[s.key]}
                <QualityBadge
                  quality={s.quantity.quality}
                  label={
                    c.quality[s.quantity.quality as keyof typeof c.quality]
                  }
                />
              </h3>
              {s.kind === 'unknown' ? (
                <p>
                  {r.stepsUnknown} {s.quantity.reason}
                </p>
              ) : (
                <>
                  <p>{r.stepsKinds[s.kind]}</p>
                  <ol className={styles.formula}>
                    {s.terms.map((t, i) => (
                      <li key={i}>
                        <span className={styles.stepLabel}>
                          {r.colInterval} {i + 1}
                        </span>
                        {t}
                      </li>
                    ))}
                    <li className={s.terms.length ? styles.sep : undefined}>
                      <strong>{s.total}</strong>
                    </li>
                  </ol>
                  <p className={styles.note}>
                    {r.stepsQuality}{' '}
                    {s.qualityInputs
                      .map(
                        (q) =>
                          `${r.stepsInputs[q.input]} = ${
                            c.quality[q.quality as keyof typeof c.quality]
                          }`
                      )
                      .join(ja ? '、' : ', ')}
                  </p>
                </>
              )}
            </div>
          ))}
        </section>
      )}

      <section className={styles.panel}>
        <h2>{r.assumptions}</h2>
        <dl className={styles.rows}>
          <div>
            <dt>{r.powerScope}</dt>
            <dd>{r.powerScopeValues[a.powerScope]}</dd>
          </div>
          <div>
            <dt>{r.pue}</dt>
            <dd>
              {num(a.pue, c.missing)}
              {a.pueQuality && (
                <QualityBadge
                  quality={a.pueQuality}
                  label={c.quality[a.pueQuality as keyof typeof c.quality]}
                />
              )}
            </dd>
          </div>
          {a.water && (
            <div>
              <dt>{r.waterDef}</dt>
              <dd>
                {a.water.kind === 'wue' ? 'WUE' : 'flow'} {a.water.value}{' '}
                {a.water.unit}; {a.water.definition}; {a.water.scope}
              </dd>
            </div>
          )}
          {a.gridIntensity && (
            <div>
              <dt>{r.grid}</dt>
              <dd>
                {a.gridIntensity.gCO2ePerKWh} gCO2e/kWh (
                {a.gridIntensity.source})
              </dd>
            </div>
          )}
          <div>
            <dt>{r.evidence}</dt>
            <dd>
              {receipt.evidence.map((e) => (
                <div key={e.ref}>
                  <span className={styles.mono}>{e.ref}</span> {e.description}
                </div>
              ))}
            </dd>
          </div>
        </dl>
      </section>

      <section className={styles.panel}>
        <h2>{r.integrity}</h2>
        <dl className={styles.rows}>
          <div>
            <dt>{r.hash}</dt>
            <dd className={styles.mono} data-testid="receipt-hash">
              {hash}
            </dd>
          </div>
          <div>
            <dt>{r.sourceHash}</dt>
            <dd className={styles.mono} data-testid="source-hash">
              {receipt.source.sha256}
            </dd>
          </div>
        </dl>
        <p className={styles.note}>{r.hashNote}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.button}
            onClick={() =>
              download(
                `receipt-${receipt.transactionId}.json`,
                text,
                'application/json'
              )
            }
          >
            {r.downloadUnsigned}
          </button>
          <button
            type="button"
            className={`${styles.button} ${styles.secondary}`}
            onClick={() =>
              download(
                `source-${receipt.transactionId}.json`,
                sourceText,
                'application/json'
              )
            }
          >
            {r.downloadSource}
          </button>
        </div>
      </section>

      <Sign r={r} receipt={receipt} />
      <Verify r={r} />
    </div>
  )
}
