import {
  buildCarbonReport,
  carbonReportToCSV,
  carbonReportToJSON,
  reasonCode
} from './carbonReport'

const line = (id: string, envKey: string, jobs = 40, minutesPerJob = 30) => ({
  id,
  label: id,
  envKey,
  jobs,
  minutesPerJob
})

// 引用符で囲んだカンマを分割しない、最小限の CSV 行パーサ
function parseRow(row: string): string[] {
  const out: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < row.length; i++) {
    const ch = row[i]
    if (q && ch === '"' && row[i + 1] === '"') {
      cur += '"'
      i++
    } else if (ch === '"') q = !q
    else if (ch === ',' && !q) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}

const now = new Date('2026-09-26T12:00:00Z')

describe('buildCarbonReport', () => {
  const report = buildCarbonReport({
    title: 't',
    purpose: 'p',
    preparedBy: '',
    now,
    lines: [
      line('sto', 'eu-north-1'),
      line('tyo', 'ap-northeast-1'),
      line('mdx', 'mdx')
    ]
  })

  it('ジョブ数 × 分 を占有時間にする', () => {
    expect(report.lines[0].durationSeconds).toBe(40 * 30 * 60)
  })

  it('Stockholm: 32.8 W × 20 h × 21.3 g/kWh', () => {
    expect(report.lines[0].footprint.gCO2e).toBeCloseTo(0.656 * 21.3, 6)
    expect(report.lines[0].footprint.usdCost).toBeCloseTo(0.558 * 20, 6)
  })

  it('算出できない行を 0 として合計に入れない', () => {
    const mdx = report.lines[2].footprint
    expect(mdx.gCO2e).toBeUndefined()
    expect(reasonCode(mdx)).toBe('no-power')
    expect(report.totals.carbonLines).toBe(2)
    expect(report.totals.lineCount).toBe(3)
    expect(report.totals.gCO2e).toBeCloseTo(
      report.lines[0].footprint.gCO2e + report.lines[1].footprint.gCO2e,
      6
    )
  })

  it('合計の品質は最も弱い行に引きずられる', () => {
    // Stockholm は実測、Tokyo は仕様からの推定
    expect(report.lines[0].footprint.quality).toBe('measured')
    expect(report.totals.quality).toBe('portal-estimated')
  })

  it('1 行も算出できなければ合計は undefined（0 ではない）', () => {
    const r = buildCarbonReport({
      title: '',
      purpose: '',
      preparedBy: '',
      now,
      lines: [line('mdx', 'mdx')]
    })
    expect(r.totals.gCO2e).toBeUndefined()
    expect(r.totals.usdCost).toBeUndefined()
    expect(r.totals.quality).toBe('unknown')
  })

  it('未知の key は所在地未申告として扱う', () => {
    const r = buildCarbonReport({
      title: '',
      purpose: '',
      preparedBy: '',
      now,
      lines: [line('x', 'nowhere')]
    })
    expect(reasonCode(r.lines[0].footprint)).toBe('no-location')
  })
})

describe('書き出し', () => {
  const report = buildCarbonReport({
    title: 'OCR, "test"',
    purpose: 'a,b',
    preparedBy: 'me',
    now,
    lines: [line('sto', 'eu-north-1'), line('mdx', 'mdx')]
  })

  it('CSV は算出できない値を空欄にする', () => {
    const csv = carbonReportToCSV(report)
    const rows = csv.replace('﻿', '').trim().split('\r\n')
    expect(rows).toHaveLength(3) // header + 2 lines, 合計行なし
    const header = parseRow(rows[0])
    const mdx = parseRow(rows[2])
    expect(mdx).toHaveLength(header.length)
    expect(mdx[header.indexOf('emissions_gCO2e')]).toBe('')
    expect(mdx[header.indexOf('quality')]).toBe('unknown')
  })

  it('CSV は英語の出典と所在地を使い、日本語版では日本語を使う', () => {
    expect(carbonReportToCSV(report)).toContain('Kashiwa II Campus')
    expect(carbonReportToCSV(report, { lang: 'ja' })).toContain('柏Ⅱキャンパス')
  })

  it('JSON に作成日時・計画段階であること・注記を残す', () => {
    const j = carbonReportToJSON(report) as any
    expect(j.generatedAtTime).toBe('2026-09-26T12:00:00.000Z')
    expect(j.reportType).toMatch(/planning estimate/)
    expect(j.lines[1].gCO2e).toBeUndefined()
    expect(j.lines[1].reason).toMatch(/not been measured/)
    expect(j.totals.note).toMatch(/not counted as zero/)
  })
})

describe('代替案モード', () => {
  it('JSON に合計を書かない（どれか 1 つしか実行しないので和に意味が無い）', () => {
    const r = buildCarbonReport({
      mode: 'alternatives',
      title: '',
      purpose: '',
      preparedBy: '',
      now,
      lines: [line('sto', 'eu-north-1'), line('tyo', 'ap-northeast-1')]
    })
    const j = carbonReportToJSON(r) as { totals?: unknown; mode: string }
    expect(j.totals).toBeUndefined()
    expect(j.mode).toMatch(/^alternatives/)
  })
})
