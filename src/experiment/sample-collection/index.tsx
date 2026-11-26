import { ReactElement, useMemo, useState } from 'react'
import useLocaleContent from '../../i18n/useLocaleContent'
import contentEn from '../../../content/sampleCollection.json'
import contentJa from '../../../content/sampleCollection.ja.json'
// 由来の違う値はファイルごと分けてある。
//   collection.json … 国立国会図書館のマニフェストの写し＋取得した画像の事実（大きさ・ハッシュ）
//   run.json        … 手元で OCR を 1 回実行した記録（チェーンにも NDL にも無い）
import collection from '../../../public/sample-collection/saitan/collection.json'
import run from '../../../public/sample-collection/saitan-ocr-run/run.json'
import styles from './index.module.css'

type Content = typeof contentEn
type Item = (typeof collection.items)[number]
type Analysis = 'fixity' | 'ocr'

const RUN_BASE = '/sample-collection/saitan-ocr-run'
const RETRIEVED = collection.source.retrieved
const RUN_DATE = run.started.slice(0, 10)
// 表に出す書誌項目の順番（値はマニフェストのまま、ラベルだけ画面の言葉）
const FIELDS = [
  'Title',
  'Creator',
  'Publisher',
  'Publication Date',
  'Call Number',
  'DOI',
  'Access Restrictions'
]

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

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function stem(file: string): string {
  return file.replace(/\.[^.]+$/, '')
}

// ---- 固定性チェック（ブラウザの中で実際に計算する） ----

interface FixityRow {
  file: string
  bytes: number
  width: number
  height: number
  sha256: string
  ms: number
}

async function fixityOf(item: Item): Promise<FixityRow> {
  const t0 = performance.now()
  const res = await fetch(item.path, { cache: 'no-store' })
  if (!res.ok) throw new Error(`${item.file}: HTTP ${res.status}`)
  const blob = await res.blob()
  const buf = await blob.arrayBuffer()
  const sha256 = hex(await crypto.subtle.digest('SHA-256', buf))
  const bmp = await createImageBitmap(blob)
  const row = {
    file: item.file,
    bytes: buf.byteLength,
    width: bmp.width,
    height: bmp.height,
    sha256,
    ms: Math.round(performance.now() - t0)
  }
  bmp.close()
  return row
}

function fixityCSV(rows: FixityRow[]): string {
  const head = 'file,bytes,width,height,sha256'
  return [
    head,
    ...rows.map((r) => [r.file, r.bytes, r.width, r.height, r.sha256].join(','))
  ].join('\n')
}

// ---- OCR（記録した実行を再生する） ----

interface OcrLine {
  id: number
  text: string
  confidence?: number
  box: { x: number; y: number; w: number; h: number }
}

interface OcrPage {
  file: string
  ok: boolean
  lines: OcrLine[]
  characters: number
  seconds: number
  width: number
  height: number
}

interface OcrRawLine {
  id: number
  text: string
  confidence?: number
  boundingBox: number[][]
}

function toLine(raw: OcrRawLine): OcrLine {
  const xs = raw.boundingBox.map((p) => p[0])
  const ys = raw.boundingBox.map((p) => p[1])
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return {
    id: raw.id,
    text: raw.text,
    confidence: raw.confidence,
    box: { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
  }
}

interface OcrSummary {
  perFile: {
    file: string
    ok: boolean
    lines: number
    characters: number
    seconds: number
  }[]
}

// ログはプログラムが書いたままを、1 文字も変えずに出す（選んだ頁で絞ったり、
// 件数を書き換えたりしない。記録は 8 頁ぶんの実行なので）。
// 代わりに、各行がどの頁の処理で出たかを求め、選んだ頁の行に印を付ける。
// 頁ごとの行（"  saitan-0N.jpg"）と、その直後のエラー出力の塊を頁に紐づける。
function splitLog(text: string): string[] {
  const lines = text.split('\n')
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop()
  return lines
}

function logOwners(lines: string[]): (string | null)[] {
  const all = new Set(collection.items.map((i) => i.file))
  let current: string | null = null
  return lines.map((line) => {
    const m = line.match(/^\s+-?\s*(saitan-\d+\.jpg)/)
    if (m && all.has(m[1])) current = m[1]
    else if (/^(合計|出力|入力|対象画像)/.test(line) || line.trim() === '')
      current = null
    return current
  })
}

async function loadOcr(items: Item[]): Promise<{
  pages: OcrPage[]
  log: string[]
}> {
  const [summary, logText] = await Promise.all([
    fetch(`${RUN_BASE}/outputs/ocr-summary.json`).then(
      (r) => r.json() as Promise<OcrSummary>
    ),
    fetch(`${RUN_BASE}/logs.txt`).then((r) => r.text())
  ])
  const pages: OcrPage[] = []
  for (const item of items) {
    const s = summary.perFile.find((p) => p.file === item.file)
    let lines: OcrLine[] = []
    if (s?.ok) {
      const j = await fetch(`${RUN_BASE}/outputs/${stem(item.file)}.json`).then(
        (r) => r.json()
      )
      lines = ((j.contents?.[0] ?? []) as OcrRawLine[]).map(toLine)
    }
    pages.push({
      file: item.file,
      ok: Boolean(s?.ok),
      lines,
      characters: s?.characters ?? 0,
      seconds: s?.seconds ?? 0,
      width: item.width,
      height: item.height
    })
  }
  return { pages, log: splitLog(logText) }
}

// ---- 部品 ----

function RolesDiagram({ c, count }: { c: Content; count: number }) {
  return (
    <section className={styles.roles} aria-labelledby="sc-roles">
      <h2 id="sc-roles">{c.roles.heading}</h2>
      <div className={styles.flow}>
        <div className={`${styles.node} ${styles.nodeCustodian}`}>
          <strong>{c.roles.custodian}</strong>
          <span className={styles.stack} aria-hidden="true">
            {Array.from({ length: Math.min(count, 8) }).map((_, i) => (
              <i key={i} />
            ))}
          </span>
          <small>{c.roles.custodianNote}</small>
        </div>
        <div className={styles.arrow} aria-hidden="true">
          ←
        </div>
        <div className={styles.node}>
          <strong>{c.roles.analysis}</strong>
          <small>{c.roles.analysisNote}</small>
        </div>
        <div className={styles.arrow} aria-hidden="true">
          →
        </div>
        <div className={`${styles.node} ${styles.nodeResults}`}>
          <strong>{c.roles.results}</strong>
          <small>{c.roles.resultsNote}</small>
        </div>
      </div>
      <p className={styles.hint}>{c.roles.here}</p>
    </section>
  )
}

function OcrViewer({
  c,
  pages,
  noteFor
}: {
  c: Content
  pages: OcrPage[]
  noteFor: (file: string) => string
}) {
  const [file, setFile] = useState(pages[0]?.file)
  const [hot, setHot] = useState<number | null>(null)
  const page = pages.find((p) => p.file === file) ?? pages[0]
  if (!page) return null
  const item = collection.items.find((i) => i.file === page.file)
  return (
    <div className={styles.viewer}>
      <div className={styles.pageTabs} role="tablist">
        {pages.map((p) => (
          <button
            key={p.file}
            role="tab"
            aria-selected={p.file === page.file}
            className={p.file === page.file ? styles.tabOn : undefined}
            onClick={() => {
              setFile(p.file)
              setHot(null)
            }}
          >
            {c.step4.ocr.page}{' '}
            {collection.items.findIndex((i) => i.file === p.file) + 1}
            <small>
              {p.ok
                ? p.lines.length === 1
                  ? c.step4.ocr.line
                  : fill(c.step4.ocr.lines, { n: p.lines.length })
                : c.step4.ocr.failed}
            </small>
          </button>
        ))}
      </div>
      <div className={styles.viewerBody}>
        <figure className={styles.pageFigure}>
          <div className={styles.overlayWrap}>
            <img src={item?.path} alt={noteFor(page.file)} />
            <svg
              viewBox={`0 0 ${page.width} ${page.height}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {page.lines.map((l) => (
                <rect
                  key={l.id}
                  x={l.box.x}
                  y={l.box.y}
                  width={l.box.w}
                  height={l.box.h}
                  className={hot === l.id ? styles.boxHot : styles.box}
                />
              ))}
            </svg>
          </div>
          <figcaption>
            {page.file} · {noteFor(page.file)}
          </figcaption>
        </figure>
        <div className={styles.textCol}>
          {page.ok ? (
            <>
              <p className={styles.hint}>{c.step4.ocr.hover}</p>
              <ol className={styles.lines}>
                {page.lines.map((l) => (
                  <li
                    key={l.id}
                    tabIndex={0}
                    onMouseEnter={() => setHot(l.id)}
                    onFocus={() => setHot(l.id)}
                    onMouseLeave={() => setHot(null)}
                    onBlur={() => setHot(null)}
                    className={hot === l.id ? styles.lineHot : undefined}
                    title={
                      l.confidence !== undefined
                        ? fill(c.step4.ocr.confidence, {
                            c: l.confidence.toFixed(2)
                          })
                        : undefined
                    }
                  >
                    <span lang="ja">{l.text}</span>
                  </li>
                ))}
              </ol>
              <p className={styles.downloads}>
                {c.step4.ocr.downloads}:{' '}
                {['.txt', '_tei.xml', '.xml', '.json'].map((suffix) => (
                  <a
                    key={suffix}
                    href={`${RUN_BASE}/outputs/${stem(page.file)}${suffix}`}
                    download
                  >
                    {stem(page.file)}
                    {suffix}
                  </a>
                ))}
              </p>
            </>
          ) : (
            <div className={styles.failBox}>
              <strong>{c.step4.ocr.failHeading}</strong>
              <p>{c.step4.ocr.fail}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SampleCollection(): ReactElement {
  const c = useLocaleContent(contentEn, contentJa)
  const { items } = collection
  const [chosen, setChosen] = useState<Set<string>>(
    () => new Set(items.map((i) => i.file))
  )
  const [analysis, setAnalysis] = useState<Analysis>('fixity')
  const [running, setRunning] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [fixity, setFixity] = useState<FixityRow[] | null>(null)
  const [ocr, setOcr] = useState<OcrPage[] | null>(null)
  const [ranOn, setRanOn] = useState<Analysis | null>(null)

  const chosenItems = useMemo(
    () => items.filter((i) => chosen.has(i.file)),
    [items, chosen]
  )
  const noteFor = (file: string) =>
    c.step1.pageNotes[items.findIndex((i) => i.file === file)] ?? ''
  const recordedHash = useMemo(
    () => new Map(run.inputs.map((i) => [i.file, i.sha256])),
    []
  )

  function reset() {
    setLog([])
    setError(null)
    setFixity(null)
    setOcr(null)
    setRanOn(null)
  }

  function toggle(file: string) {
    const next = new Set(chosen)
    if (next.has(file)) next.delete(file)
    else next.add(file)
    setChosen(next)
    reset()
  }

  async function runFixity() {
    const lines = [fill(c.step3.fixityStart, { n: chosenItems.length })]
    setLog([...lines])
    const rows: FixityRow[] = []
    for (const item of chosenItems) {
      const r = await fixityOf(item)
      rows.push(r)
      lines.push(
        fill(c.step3.fixityLine, {
          file: r.file,
          bytes: r.bytes.toLocaleString(),
          w: r.width,
          h: r.height,
          hash: r.sha256.slice(0, 12),
          ms: r.ms
        })
      )
      setLog([...lines])
    }
    lines.push(c.step3.fixityEnd)
    setLog([...lines])
    setFixity(rows)
  }

  async function runOcr() {
    const { pages, log: recorded } = await loadOcr(chosenItems)
    // 記録を再生する。時間は短縮し、1 行ずつ出すだけ（秒数は記録の値を表示する）
    const shown: string[] = []
    for (const line of recorded) {
      shown.push(line)
      setLog([...shown])
      await new Promise((resolve) => setTimeout(resolve, 60))
    }
    setOcr(pages)
  }

  async function onRun() {
    if (!chosenItems.length) return
    reset()
    setRunning(true)
    try {
      if (analysis === 'fixity') await runFixity()
      else await runOcr()
      setRanOn(analysis)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  const ocrTotals = ocr && {
    n: ocr.length,
    ok: ocr.filter((p) => p.ok).length,
    lines: ocr.reduce((a, p) => a + p.lines.length, 0),
    chars: ocr.reduce((a, p) => a + p.characters, 0),
    seconds: ocr.reduce((a, p) => a + p.seconds, 0).toFixed(1)
  }
  const outputFiles =
    ranOn === 'fixity'
      ? ['fixity.csv']
      : ranOn === 'ocr' && ocr
      ? [
          'ocr-summary.json',
          ...ocr
            .filter((p) => p.ok)
            .flatMap((p) =>
              ['.json', '.txt', '.xml', '_tei.xml'].map((s) => stem(p.file) + s)
            )
        ]
      : []

  return (
    <div className={styles.page}>
      <div className={styles.intro}>
        <p>{c.intro}</p>
        <ul className={styles.safe}>
          {c.safe.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>

      <RolesDiagram c={c} count={chosenItems.length} />

      {/* 1. 資料群 */}
      <section className={styles.panel} aria-labelledby="sc-step1">
        <h2 id="sc-step1">{c.step1.heading}</h2>
        <p>{c.step1.lead}</p>
        <div className={styles.record}>
          <div>
            <span className={`${styles.badge} ${styles.source}`}>
              {c.step1.fromSource}
            </span>
            <dl className={styles.fields}>
              {FIELDS.map((f) => {
                const value = (
                  collection.source.metadata as Record<string, string>
                )[f]
                if (!value) return null
                const label = (c.step1.fields as Record<string, string>)[f] ?? f
                return (
                  <div key={f}>
                    <dt>{label}</dt>
                    <dd lang="ja">
                      {f === 'DOI' ? (
                        <a
                          href={`https://doi.org/${value}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {value}
                        </a>
                      ) : (
                        value
                      )}
                    </dd>
                  </div>
                )
              })}
              <div>
                <dt>{c.step1.fields.attribution}</dt>
                <dd>{collection.source.attribution}</dd>
              </div>
            </dl>
            <small className={styles.hint}>
              {fill(c.step1.fromSourceNote, { date: RETRIEVED })}{' '}
              <a
                href={collection.source.metadata.URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                {collection.source.metadata.URL}
              </a>
            </small>
          </div>
          <div>
            <strong className={styles.subhead}>{c.step1.copies}</strong>
            <p className={styles.hint}>
              {fill(c.step1.copiesNote, { date: RETRIEVED })}
            </p>
          </div>
        </div>

        <div className={styles.selectBar}>
          <strong>{c.step1.select}</strong>
          <button
            type="button"
            onClick={() => {
              setChosen(new Set(items.map((i) => i.file)))
              reset()
            }}
          >
            {c.step1.selectAll}
          </button>
          <button
            type="button"
            onClick={() => {
              setChosen(new Set())
              reset()
            }}
          >
            {c.step1.selectNone}
          </button>
          <span className={styles.hint}>
            {fill(c.step1.selected, {
              n: chosenItems.length,
              total: items.length
            })}
          </span>
          <span className={`${styles.badge} ${styles.ours}`}>
            {c.step1.pageNotesBadge}
          </span>
        </div>
        <ul className={styles.grid}>
          {items.map((item, i) => (
            <li key={item.file}>
              <label
                className={
                  chosen.has(item.file) ? styles.thumbOn : styles.thumb
                }
              >
                <input
                  type="checkbox"
                  checked={chosen.has(item.file)}
                  onChange={() => toggle(item.file)}
                />
                <img
                  src={item.path}
                  alt={c.step1.pageNotes[i]}
                  loading="lazy"
                />
                <span>
                  <b>{i + 1}</b> {c.step1.pageNotes[i]}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      {/* 2. 分析を選ぶ */}
      <section className={styles.panel} aria-labelledby="sc-step2">
        <h2 id="sc-step2">{c.step2.heading}</h2>
        <div className={styles.choices} role="radiogroup">
          {(['fixity', 'ocr'] as Analysis[]).map((a) => {
            const d = c.step2[a]
            return (
              <label
                key={a}
                className={analysis === a ? styles.choiceOn : styles.choice}
              >
                <input
                  type="radio"
                  name="analysis"
                  checked={analysis === a}
                  onChange={() => {
                    setAnalysis(a)
                    reset()
                  }}
                />
                <span className={styles.choiceHead}>
                  <strong>{d.name}</strong>
                  <span
                    className={`${styles.badge} ${
                      a === 'fixity' ? styles.live : styles.recorded
                    }`}
                  >
                    {d.mode}
                  </span>
                </span>
                <dl>
                  <dt>{c.step2.what}</dt>
                  <dd>{d.what}</dd>
                  <dt>{c.step2.returns}</dt>
                  <dd>{d.returns}</dd>
                  <dt>{c.step2.leaves}</dt>
                  <dd>{d.leaves}</dd>
                </dl>
              </label>
            )
          })}
        </div>
        {analysis === 'ocr' && (
          <div className={styles.recordNote}>
            <p>{fill(c.step2.ocr.recorded, { date: RUN_DATE })}</p>
            <dl className={styles.fields}>
              <div>
                <dt>{c.step3.container}</dt>
                <dd>
                  <code>{run.container.image}</code>
                  <br />
                  <code className={styles.digest}>{run.container.digest}</code>
                </dd>
              </div>
              <div>
                <dt>{c.step3.limits}</dt>
                <dd>{c.step3.limitsValue}</dd>
              </div>
            </dl>
          </div>
        )}
      </section>

      {/* 3. 実行 */}
      <section className={styles.panel} aria-labelledby="sc-step3">
        <h2 id="sc-step3">{c.step3.heading}</h2>
        <div className={styles.runBar}>
          <button
            type="button"
            className={styles.runButton}
            disabled={running || !chosenItems.length}
            onClick={onRun}
          >
            {running
              ? c.step3.running
              : ranOn === analysis
              ? c.step3.again
              : analysis === 'fixity'
              ? c.step3.runFixity
              : c.step3.runOcr}
          </button>
          {!chosenItems.length && (
            <span className={styles.hint}>{c.step3.none}</span>
          )}
        </div>
        {(log.length > 0 || error) && (
          <div className={styles.logBox}>
            <div className={styles.logHead}>
              <strong>{c.step3.log}</strong>
              <small>
                {analysis === 'fixity'
                  ? c.step3.logFixity
                  : fill(c.step3.logOcr, { date: RUN_DATE })}
              </small>
            </div>
            <pre aria-live="polite">
              {ranOn === 'ocr' || (running && analysis === 'ocr')
                ? (() => {
                    const owners = logOwners(log)
                    return log.map((line, i) => (
                      <span
                        key={i}
                        className={
                          owners[i] && chosen.has(owners[i] as string)
                            ? styles.logChosen
                            : undefined
                        }
                      >
                        {line}
                        {'\n'}
                      </span>
                    ))
                  })()
                : log.join('\n')}
              {error && `\n${error}`}
            </pre>
          </div>
        )}
      </section>

      {/* 4. 結果 */}
      {ranOn && (
        <section className={styles.panel} aria-labelledby="sc-step4">
          <h2 id="sc-step4">{c.step4.heading}</h2>
          <div className={styles.boundary}>
            <div>
              <strong>{c.step4.outputs}</strong>
              <ul className={styles.fileList}>
                {outputFiles.map((f) => (
                  <li key={f}>
                    <code>/data/outputs/{f}</code>
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.stayed}>
              <strong>{c.step4.notReturned}</strong>
              <p>{fill(c.step4.notReturnedValue, { n: chosenItems.length })}</p>
            </div>
          </div>

          {ranOn === 'fixity' && fixity && (
            <>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{c.step4.fixity.file}</th>
                      <th>{c.step4.fixity.bytes}</th>
                      <th>{c.step4.fixity.pixels}</th>
                      <th>{c.step4.fixity.sha256}</th>
                      <th>{c.step4.fixity.match}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fixity.map((r) => {
                      const same = recordedHash.get(r.file) === r.sha256
                      return (
                        <tr key={r.file}>
                          <td>{r.file}</td>
                          <td className={styles.num}>
                            {r.bytes.toLocaleString()}
                          </td>
                          <td className={styles.num}>
                            {r.width}×{r.height}
                          </td>
                          <td>
                            <code className={styles.hash}>{r.sha256}</code>
                          </td>
                          <td className={same ? styles.yes : styles.no}>
                            {same ? c.step4.fixity.yes : c.step4.fixity.no}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className={styles.hint}>{c.step4.fixity.matchNote}</p>
              <button
                type="button"
                className={styles.secondary}
                onClick={() =>
                  download('fixity.csv', fixityCSV(fixity), 'text/csv')
                }
              >
                {c.step4.fixity.download}
              </button>
            </>
          )}

          {ranOn === 'ocr' && ocr && ocrTotals && (
            <>
              <p className={styles.summary}>
                {fill(c.step4.ocr.summary, ocrTotals)}
              </p>
              <OcrViewer c={c} pages={ocr} noteFor={noteFor} />
              <div className={styles.draftBox}>
                <strong>{c.step4.ocr.draftHeading}</strong>
                <p>{c.step4.ocr.draft}</p>
              </div>
              <p className={styles.downloads}>
                {c.step4.ocr.downloads}:{' '}
                <a href={`${RUN_BASE}/outputs/ocr-summary.json`} download>
                  ocr-summary.json
                </a>
                <a href={`${RUN_BASE}/logs.txt`} download>
                  logs.txt
                </a>
                <a href={`${RUN_BASE}/run.json`} download>
                  run.json
                </a>
              </p>
            </>
          )}
        </section>
      )}

      {/* 5. 本番との違い */}
      <section className={styles.panel} aria-labelledby="sc-step5">
        <h2 id="sc-step5">{c.step5.heading}</h2>
        <ol className={styles.changes}>
          {c.step5.changes.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <p className={styles.same}>{c.step5.same}</p>
        <p className={styles.hint}>{c.step5.notOpen}</p>
      </section>

      <p className={styles.credit}>{c.credit}</p>
    </div>
  )
}
