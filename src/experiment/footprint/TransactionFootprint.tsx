import { ReactElement } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import styles from './index.module.css'
import {
  TrialOption,
  optionFootprint
} from '@experiment/two-condition/lib/experiment'
import { Quantity } from './lib/transactionFootprint'
import { DataQuality } from './lib/computeFootprint'

// [prototype] 論文の図 1 のための表示（2026-11-04）。
// 計算環境の一覧で選んだ環境の下に、1 件の取引あたりの電力・水・炭素を出す。
// 値は /experiment の課題と同じ計算部品（computeTransaction）で出すので、
// 「計算を見る」で開く受領書の計算の画面（図 2）と数字が一致する。
const L = {
  heading: [
    'Location and footprint (this job)',
    '所在地とフットプリント（このジョブ）'
  ],
  location: ['Processing location', '処理地'],
  jurisdiction: ['Jurisdiction', '法域'],
  indigenous: ['Indigenous data', '先住民のデータ'],
  certifications: ['Certifications', '認証'],
  none: ['None', 'なし'],
  cost: ['Cost', '費用'],
  energy: ['Electricity', '電力'],
  water: ['Water', '水'],
  carbon: ['Carbon', '炭素'],
  pue: ['PUE', 'PUE'],
  wue: ['Water efficiency (WUE)', '水効率（WUE）'],
  view: ['View the calculation →', '計算を見る →'],
  note: [
    'Estimates for this one job. Each figure takes the weakest label of its inputs; missing inputs are shown as "cannot be established", not zero.',
    'このジョブ 1 件の見積もりです。各値は入力のうち最も弱いラベルを引き継ぎます。入力が無いときは 0 にせず「算出不可」と出します。'
  ],
  q: {
    measured: ['measured', '実測'],
    'provider-reported': ['provider-reported', '事業者申告'],
    'portal-estimated': ['estimated', '推定'],
    unknown: ['cannot be established', '算出不可']
  },
  // 見本の値なので、どのラベルにも「見本」と添える（実在の事業者の申告・実測と誤読されないように）
  illustrative: ['illustrative', '見本'],
  suit: {
    suitable: ['Suitable', '適している'],
    conditional: ['Conditional', '条件つき'],
    'not-suitable': ['Not suitable', '適していない'],
    unknown: ['Not stated', '記載なし']
  }
}

function num(v?: number): string {
  return v === undefined || !Number.isFinite(v)
    ? '—'
    : String(Number(v.toPrecision(3)))
}

export default function TransactionFootprint({
  option,
  sample
}: {
  option: TrialOption
  /** 受領書の画面で開く見本（例: t4a） */
  sample: string
}): ReactElement {
  const { i18n } = useTranslation('common')
  const ja = (i18n?.language || 'en').startsWith('ja')
  const i = ja ? 1 : 0
  const f = optionFootprint(option)

  const badge = (q: DataQuality) => (
    <span
      className={`${styles.badge} ${
        q === 'measured'
          ? styles.measured
          : q === 'unknown'
          ? styles.unknown
          : styles.estimated
      }`}
    >
      {q === 'unknown' ? L.q[q][i] : `${L.q[q][i]} · ${L.illustrative[i]}`}
    </span>
  )
  const qty = (label: string, q: Quantity, unit: string) => (
    <>
      <div className={styles.label}>{label}</div>
      <div className={styles.value}>
        {q.value !== undefined && `${num(q.value)} ${unit}`}
        {badge(q.quality)}
      </div>
    </>
  )
  const c = option.compute

  return (
    <div className={styles.container}>
      <div className={styles.heading}>{L.heading[i]}</div>
      <div className={styles.grid}>
        <div className={styles.label}>{L.location[i]}</div>
        <div className={styles.value}>{option.location[ja ? 'ja' : 'en']}</div>
        <div className={styles.label}>{L.jurisdiction[i]}</div>
        <div className={styles.value}>
          {option.jurisdiction[ja ? 'ja' : 'en']}
        </div>
        <div className={styles.label}>{L.indigenous[i]}</div>
        <div className={styles.value}>
          {L.suit[option.governance?.indigenousData || 'unknown'][i]}
        </div>
        <div className={styles.label}>{L.certifications[i]}</div>
        <div className={styles.value}>
          {option.certifications.length
            ? option.certifications.join(', ')
            : L.none[i]}
        </div>
        <div className={styles.label}>{L.cost[i]}</div>
        <div className={styles.value}>USD {option.costUSD.toFixed(2)}</div>
        {qty(L.energy[i], f.facilityEnergy, 'kWh')}
        {qty(L.water[i], f.water, 'L')}
        {qty(L.carbon[i], f.carbon, 'gCO2e')}
        {c.pue != null && (
          <>
            <div className={styles.label}>{L.pue[i]}</div>
            <div className={styles.value}>
              {c.pue}
              {badge(c.pueQuality ?? 'provider-reported')}
            </div>
          </>
        )}
        {c.water?.kind === 'wue' && (
          <>
            <div className={styles.label}>{L.wue[i]}</div>
            <div className={styles.value}>
              {`${c.water.value} L/kWh`}
              {badge(c.water.quality)}
            </div>
          </>
        )}
      </div>
      {f.water.value === undefined && f.water.reason && (
        <p className={styles.reason}>
          {L.water[i]}: {f.water.reason}
        </p>
      )}
      <p className={styles.source}>{L.note[i]}</p>
      <p className={styles.source}>
        <Link
          href={`/experiment/two-condition?view=receipt&sample=${sample}&steps=1`}
        >
          {L.view[i]}
        </Link>
      </p>
    </div>
  )
}
