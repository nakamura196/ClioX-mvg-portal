import { ReactElement, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import useLocaleContent from '../../i18n/useLocaleContent'
import contentEn from '../../../content/carbonReport.json'
import contentJa from '../../../content/carbonReport.ja.json'
import {
  ComputeLocation,
  DataQuality,
  formatEnergy,
  formatGCO2e,
  listKnownLocations
} from '@utils/computeFootprint'
import {
  ReportLineInput,
  buildCarbonReport,
  carbonReportToCSV,
  carbonReportToJSON,
  reasonCode,
  sha256Hex
} from '@utils/carbonReport'
import styles from './index.module.css'

type Content = typeof contentEn

const KNOWN = listKnownLocations()
// 既定の例: 同じ仕事を 4 か所で比べる。1 つは消費電力が未測定で、
// 「算出不可」がどう見えるかも例に含める。
const DEFAULT_KEYS = ['eu-north-1', 'ap-northeast-1', 'agrifoodtef', 'mdx']

function defaultLines(c: Content): ReportLineInput[] {
  const labels = c.defaults.lineLabels as Record<string, string>
  return DEFAULT_KEYS.map((key, i) => ({
    id: `l${i}`,
    label: labels[key] ?? key,
    envKey: key,
    jobs: 40,
    minutesPerJob: 30
  }))
}

function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? ''))
}

function download(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function Badge({
  quality,
  c
}: {
  quality: DataQuality
  c: Content
}): ReactElement {
  const cls =
    quality === 'measured'
      ? styles.measured
      : quality === 'unknown'
      ? styles.unknown
      : styles.estimated
  return <span className={`${styles.badge} ${cls}`}>{c.quality[quality]}</span>
}

export default function CarbonReport(): ReactElement {
  const c = useLocaleContent(contentEn, contentJa)
  const { locale } = useRouter()
  const ja = locale === 'ja'

  const [title, setTitle] = useState(c.defaults.reportTitle)
  const [purpose, setPurpose] = useState(c.defaults.purpose)
  const [preparedBy, setPreparedBy] = useState('')
  const [lines, setLines] = useState<ReportLineInput[]>(() => defaultLines(c))
  const [edited, setEdited] = useState(false)
  const [alternatives, setAlternatives] = useState(true)

  // 言語を切り替えたとき、まだ手を入れていなければ例文もその言語にする。
  useEffect(() => {
    if (edited) return
    setTitle(c.defaults.reportTitle)
    setPurpose(c.defaults.purpose)
    setLines(defaultLines(c))
  }, [c, edited])

  const locName = (loc?: ComputeLocation) =>
    loc && (ja ? loc.label : loc.en?.label ?? loc.label)
  const locPlace = (loc?: ComputeLocation) =>
    loc &&
    (ja
      ? loc.processingLocation
      : loc.en?.processingLocation ?? loc.processingLocation)
  const src = (x?: { source: string; sourceEn?: string }) =>
    x && (ja ? x.source : x.sourceEn ?? x.source)

  // 作成日時は入力が変わった時点の時刻。サーバー描画と時刻がずれて
  // 表示が食い違わないよう、ブラウザ側で決まってから報告書を出す。
  const [now, setNow] = useState<Date>()
  useEffect(() => {
    setNow(new Date())
  }, [title, purpose, preparedBy, lines, alternatives])

  const report = useMemo(
    () =>
      buildCarbonReport({
        title,
        purpose,
        preparedBy,
        lines,
        mode: alternatives ? 'alternatives' : 'combined',
        now: now ?? new Date(0)
      }),
    [title, purpose, preparedBy, lines, alternatives, now]
  )
  const json = useMemo(
    () => JSON.stringify(carbonReportToJSON(report), null, 2) + '\n',
    [report]
  )
  const [hash, setHash] = useState<string>()
  useEffect(() => {
    let alive = true
    setHash(undefined)
    sha256Hex(json).then((h) => alive && setHash(h))
    return () => {
      alive = false
    }
  }, [json])

  const edit =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setEdited(true)
      setter(v)
    }
  const updateLine = (id: string, patch: Partial<ReportLineInput>) => {
    setEdited(true)
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }
  const addLine = () => {
    setEdited(true)
    setLines((ls) => [
      ...ls,
      {
        id: `l${Date.now()}`,
        label: '',
        envKey: KNOWN[0].key,
        jobs: ls[ls.length - 1]?.jobs ?? 1,
        minutesPerJob: ls[ls.length - 1]?.minutesPerJob ?? 30
      }
    ])
  }
  const reset = () => {
    setEdited(false)
    setAlternatives(true)
    setPreparedBy('')
  }

  const fileBase = `carbon-report-${report.generatedAt.slice(0, 10)}`
  const maxG = Math.max(0, ...report.lines.map((l) => l.footprint.gCO2e ?? 0))
  const t = report.totals
  // 代替案モード: 算出できた候補だけを排出量の少ない順に並べる
  const ranked = report.lines
    .filter((l) => l.footprint.gCO2e != null)
    .sort((a, b) => a.footprint.gCO2e - b.footprint.gCO2e)
  const lo = ranked[0]?.footprint.gCO2e
  const hi = ranked[ranked.length - 1]?.footprint.gCO2e
  const ratio =
    ranked.length > 1 && lo > 0
      ? hi / lo >= 10
        ? Math.round(hi / lo)
        : +(hi / lo).toFixed(1)
      : undefined
  const generated = new Date(report.generatedAt).toLocaleString(
    ja ? 'ja-JP' : 'en-CA',
    { dateStyle: 'long', timeStyle: 'short' }
  )

  // 出典は行ごとに繰り返さず、重複を除いて一度だけ載せる
  // 同じ係数（例: 日本の代替値）を複数の地域キーが使うので、係数の出典ごとにまとめ、
  // どの候補に当てはまるかを添える
  const gridGroups = new Map<
    string,
    { f: (typeof report.lines)[0]['footprint']; users: string[] }
  >()
  report.lines
    .filter((l) => l.footprint.grid)
    .forEach((l) => {
      const k = l.footprint.grid.source
      const g = gridGroups.get(k) ?? { f: l.footprint, users: [] }
      g.users.push(l.label || locName(l.footprint.location))
      gridGroups.set(k, g)
    })
  const gridSources = Array.from(gridGroups.values())
  const powerSources = Array.from(
    new Map(
      report.lines
        .filter((l) => l.footprint.power)
        .map((l) => [l.footprint.location.powerProfile, l.footprint])
    ).values()
  )
  const pueLines = Array.from(
    new Map(
      report.lines
        .filter((l) => l.footprint.location)
        .map((l) => [l.envKey, l.footprint])
    ).values()
  )

  return (
    <div className={styles.page}>
      <div className={`${styles.intro} ${styles.noPrint}`}>
        {c.intro.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>

      <section className={`${styles.panel} ${styles.noPrint}`}>
        <h2>{c.form.heading}</h2>
        <label className={styles.field}>
          <span>{c.form.reportTitle}</span>
          <input
            value={title}
            onChange={(e) => edit(setTitle)(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>{c.form.purpose}</span>
          <textarea
            rows={3}
            value={purpose}
            onChange={(e) => edit(setPurpose)(e.target.value)}
          />
          <small>{c.form.purposeHint}</small>
        </label>
        <label className={styles.field}>
          <span>{c.form.preparedBy}</span>
          <input
            value={preparedBy}
            onChange={(e) => edit(setPreparedBy)(e.target.value)}
          />
        </label>

        <h2>{c.form.linesHeading}</h2>
        <p className={styles.hint}>{c.form.linesHint}</p>
        <div className={styles.lines}>
          {lines.map((l) => (
            <div key={l.id} className={styles.lineRow}>
              <label className={styles.field}>
                <span>{c.form.lineLabel}</span>
                <input
                  value={l.label}
                  onChange={(e) => updateLine(l.id, { label: e.target.value })}
                />
              </label>
              <label className={styles.field}>
                <span>{c.form.environment}</span>
                <select
                  value={l.envKey}
                  onChange={(e) => updateLine(l.id, { envKey: e.target.value })}
                >
                  {KNOWN.map((k) => (
                    <option key={k.key} value={k.key}>
                      {`${locName(k.location)} — ${locPlace(k.location)}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className={`${styles.field} ${styles.num}`}>
                <span>{c.form.jobs}</span>
                <input
                  type="number"
                  min={0}
                  value={l.jobs}
                  onChange={(e) =>
                    updateLine(l.id, { jobs: Number(e.target.value) })
                  }
                />
              </label>
              <label className={`${styles.field} ${styles.num}`}>
                <span>{c.form.minutesPerJob}</span>
                <input
                  type="number"
                  min={0}
                  value={l.minutesPerJob}
                  onChange={(e) =>
                    updateLine(l.id, { minutesPerJob: Number(e.target.value) })
                  }
                />
              </label>
              <button
                type="button"
                className={styles.remove}
                onClick={() => {
                  setEdited(true)
                  setLines((ls) => ls.filter((x) => x.id !== l.id))
                }}
              >
                {c.form.removeLine}
              </button>
            </div>
          ))}
        </div>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={alternatives}
            onChange={(e) => {
              setEdited(true)
              setAlternatives(e.target.checked)
            }}
          />
          <span>
            {c.form.mode}
            <small>{c.form.modeHint}</small>
          </span>
        </label>
        <div className={styles.formActions}>
          <button type="button" onClick={addLine}>
            {c.form.addLine}
          </button>
          {edited && (
            <button type="button" className={styles.linkButton} onClick={reset}>
              {c.form.reset}
            </button>
          )}
        </div>
      </section>

      <h2 className={`${styles.reportHeading} ${styles.noPrint}`}>
        {c.report.heading}
      </h2>

      {now && (
        <article className={styles.report} aria-label={c.title}>
          <div className={styles.reportHeader}>
            <p className={styles.status}>{c.report.status}</p>
            <h1>{title || c.title}</h1>
            <dl className={styles.meta}>
              <dt>{c.report.generated}</dt>
              <dd>{generated}</dd>
              {preparedBy && (
                <>
                  <dt>{c.report.preparedBy}</dt>
                  <dd>{preparedBy}</dd>
                </>
              )}
              {purpose && (
                <>
                  <dt>{c.report.purpose}</dt>
                  <dd>{purpose}</dd>
                </>
              )}
            </dl>
          </div>

          {report.lines.length === 0 ? (
            <p>{c.report.empty}</p>
          ) : (
            <>
              {alternatives ? (
                <>
                  {ranked.length > 0 && (
                    <div className={styles.totals}>
                      <div>
                        <span>{c.report.lowest}</span>
                        <strong>
                          {formatGCO2e(ranked[0].footprint.gCO2e)}
                        </strong>
                        <small>
                          {ranked[0].label ||
                            locName(ranked[0].footprint.location)}
                        </small>
                      </div>
                      {ranked.length > 1 && (
                        <div>
                          <span>{c.report.highest}</span>
                          <strong>
                            {formatGCO2e(
                              ranked[ranked.length - 1].footprint.gCO2e
                            )}
                          </strong>
                          <small>
                            {ranked[ranked.length - 1].label ||
                              locName(
                                ranked[ranked.length - 1].footprint.location
                              )}
                          </small>
                        </div>
                      )}
                      {ratio != null && (
                        <div className={styles.ratio}>
                          <strong>{`×${ratio}`}</strong>
                          <small>{fill(c.report.ratio, { x: ratio })}</small>
                        </div>
                      )}
                    </div>
                  )}
                  <p className={styles.note}>
                    {fill(c.report.compareCounted, {
                      n: ranked.length,
                      total: t.lineCount
                    })}
                  </p>
                </>
              ) : (
                <>
                  <div className={styles.totals}>
                    <div>
                      <span>{c.report.totalEnergy}</span>
                      <strong>{formatEnergy(t.energyKWh)}</strong>
                      <small>
                        {fill(c.report.linesCounted, {
                          n: t.carbonLines,
                          total: t.lineCount
                        })}
                      </small>
                    </div>
                    <div>
                      <span>
                        {c.report.totalEmissions}
                        {t.carbonLines > 0 && (
                          <Badge quality={t.quality} c={c} />
                        )}
                      </span>
                      <strong>{formatGCO2e(t.gCO2e)}</strong>
                      <small>
                        {fill(c.report.linesCounted, {
                          n: t.carbonLines,
                          total: t.lineCount
                        })}
                      </small>
                    </div>
                    <div>
                      <span>{c.report.totalCost}</span>
                      <strong>
                        {t.usdCost != null ? `US$${t.usdCost.toFixed(2)}` : '—'}
                      </strong>
                      <small>
                        {fill(c.report.linesCounted, {
                          n: t.costLines,
                          total: t.lineCount
                        })}
                      </small>
                    </div>
                  </div>
                  <p className={styles.note}>
                    {(t.carbonLines < t.lineCount ||
                      t.costLines < t.lineCount) &&
                      `${c.report.lowerBound} `}
                    {c.report.totalsAreSum}
                  </p>
                </>
              )}

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{c.report.columns.option}</th>
                      <th>{c.report.columns.where}</th>
                      <th className={styles.right}>{c.report.columns.time}</th>
                      <th className={styles.right}>
                        {c.report.columns.energy}
                      </th>
                      <th>{c.report.columns.emissions}</th>
                      <th className={styles.right}>{c.report.columns.cost}</th>
                      <th>{c.report.columns.basis}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.lines.map((l) => {
                      const f = l.footprint
                      const code = reasonCode(f)
                      return (
                        <tr key={l.id}>
                          <td className={styles.option}>{l.label || '—'}</td>
                          <td>
                            {locName(f.location)}
                            <small>{locPlace(f.location)}</small>
                          </td>
                          <td className={styles.right}>
                            {`${l.jobs} × ${l.minutesPerJob}`}
                            <small>
                              {`${+(l.durationSeconds / 3600).toFixed(2)} ${
                                c.report.hours
                              }`}
                            </small>
                          </td>
                          <td className={styles.right}>
                            {formatEnergy(f.energyKWh)}
                          </td>
                          <td className={styles.emissions}>
                            {f.gCO2e != null ? (
                              <>
                                <span className={styles.figure}>
                                  {formatGCO2e(f.gCO2e)}
                                </span>
                                <span className={styles.bar} aria-hidden>
                                  <span
                                    style={{
                                      width: `${
                                        maxG ? (f.gCO2e / maxG) * 100 : 0
                                      }%`
                                    }}
                                  />
                                </span>
                              </>
                            ) : (
                              <span className={styles.figure}>—</span>
                            )}
                          </td>
                          <td className={styles.right}>
                            {f.usdCost != null ? (
                              `US$${f.usdCost.toFixed(2)}`
                            ) : (
                              <small>{c.report.costUnknown}</small>
                            )}
                          </td>
                          <td>
                            <Badge quality={f.quality} c={c} />
                            {code && (
                              <small className={styles.reason}>
                                {c.reasons[code]}
                              </small>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <section className={styles.legend}>
                <h3>{c.legend.heading}</h3>
                <dl>
                  {(
                    [
                      'measured',
                      'provider-reported',
                      'portal-estimated',
                      'unknown'
                    ] as DataQuality[]
                  ).map((q) => (
                    <div key={q}>
                      <dt>
                        <Badge quality={q} c={c} />
                      </dt>
                      <dd>{c.legend[q]}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <section className={styles.sources}>
                <h3>{c.sources.heading}</h3>
                <h4>{c.sources.grid}</h4>
                <ul>
                  {gridSources.map(({ f, users }) => (
                    <li key={f.grid.source}>
                      <strong>{`${f.grid.label}: ${f.grid.gCO2ePerKWh} gCO2e/kWh`}</strong>
                      {` (${f.grid.asOf}) — ${src(f.grid)}`}
                      <small className={styles.usedBy}>
                        {`${c.report.usedBy}: ${users.join(', ')}`}
                      </small>
                    </li>
                  ))}
                </ul>
                <h4>{c.sources.power}</h4>
                <ul>
                  {powerSources.map((f) => (
                    <li key={f.location.powerProfile}>
                      <strong>{`${f.power.watts} W`}</strong>{' '}
                      <Badge quality={f.power.quality} c={c} />
                      {` ${src(f.power)}`}
                    </li>
                  ))}
                </ul>
                <h4>{c.sources.pue}</h4>
                <ul>
                  {pueLines.map((f) => (
                    <li key={f.location.regionCode + f.location.provider}>
                      <strong>{locName(f.location)}</strong>
                      {': '}
                      {f.location.reportedPUE != null
                        ? fill(c.sources.pueReported, {
                            pue: f.location.reportedPUE
                          })
                        : c.sources.pueDefault}
                    </li>
                  ))}
                </ul>
              </section>

              <section className={styles.assumptions}>
                <h3>{c.assumptions.heading}</h3>
                <ul>
                  {c.assumptions.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>

              <div className={styles.fixity}>
                <span>{c.export.fixity}</span>
                <code>{hash ?? c.export.computing}</code>
                <small>{c.export.fixityHint}</small>
              </div>
            </>
          )}
        </article>
      )}

      {now && report.lines.length > 0 && (
        <section className={`${styles.exportBar} ${styles.noPrint}`}>
          <h2>{c.export.heading}</h2>
          <div className={styles.formActions}>
            <button
              type="button"
              onClick={() =>
                download(
                  `${fileBase}.csv`,
                  carbonReportToCSV(report, {
                    lang: ja ? 'ja' : 'en',
                    reasons: c.reasons
                  }),
                  'text/csv;charset=utf-8'
                )
              }
            >
              {c.export.csv}
            </button>
            <button
              type="button"
              onClick={() =>
                download(`${fileBase}.json`, json, 'application/json')
              }
            >
              {c.export.json}
            </button>
            <button type="button" onClick={() => window.print()}>
              {c.export.print}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
