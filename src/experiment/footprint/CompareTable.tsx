import { ReactElement } from 'react'
import { useRouter } from 'next/router'
import { useTranslation } from 'react-i18next'
import styles from './CompareTable.module.css'
import {
  TrialOption,
  optionFootprint
} from '@experiment/two-condition/lib/experiment'
import TransactionFootprint from './TransactionFootprint'
import {
  getDemoComputeEnvs,
  isComputeDemo,
  setDemoSelected,
  useDemoSelected
} from './demoEnvs'

// [prototype] 論文の図 1・デモ用（2026-11-04）。本番には配らない。
// 資料ページの情報カードの下に、計算環境を見比べる表を置く（?demo=1 のときだけ）。
// 右の箱は幅が狭く表が入らないため、幅のある左の列に置いた。
// 行 = 環境、列 = 場所・費用・電力・水・炭素。各列で最も小さい値を太字にする。
// 算出できない値は 0 にせず「—」。行を押すと右の箱の選択も替わる（demoEnvs の共有）。
// 電力・PUE・WUE とその出どころのラベルは、表の下の詳しい枠で見せる。

const L = {
  heading: ['Compare compute environments', '計算環境を比べる'],
  env: ['Environment', '計算環境'],
  location: ['Location', '処理地'],
  cost: ['Cost', '費用'],
  energy: ['Electricity', '電力'],
  water: ['Water', '水'],
  carbon: ['Carbon', '炭素'],
  note: [
    'Estimates for this one job. Bold = lowest in the column. — = cannot be established. Select a row to see where each figure comes from.',
    'このジョブ 1 件あたりの見積もり。太字は列で最小。— は算出不可。行を選ぶと、各値の出どころが下に出ます。'
  ]
}

function num(v?: number): string {
  return v === undefined || !Number.isFinite(v) ? '—' : v.toPrecision(3)
}

function minOf(values: (number | undefined)[]): number | undefined {
  const known = values.filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v)
  )
  return known.length ? Math.min(...known) : undefined
}

export default function CompareTable(): ReactElement {
  const router = useRouter()
  const selected = useDemoSelected()
  const { i18n } = useTranslation('common')
  if (!isComputeDemo(router.query)) return null

  const ja = (i18n?.language || 'en').startsWith('ja')
  const i = ja ? 1 : 0
  const envs = getDemoComputeEnvs() as {
    id: string
    trialOption: TrialOption
    sample: string
  }[]

  const rows = envs.map((env) => {
    const f = optionFootprint(env.trialOption)
    return {
      env,
      cost: env.trialOption.costUSD,
      energy: f.facilityEnergy.value,
      water: f.water.value,
      carbon: f.carbon.value
    }
  })
  const min = {
    cost: minOf(rows.map((r) => r.cost)),
    energy: minOf(rows.map((r) => r.energy)),
    water: minOf(rows.map((r) => r.water)),
    carbon: minOf(rows.map((r) => r.carbon))
  }
  const cell = (v: number | undefined, m: number | undefined, s: string) => (
    <td
      className={`${styles.num} ${
        v !== undefined && v === m ? styles.min : ''
      }`}
    >
      {s}
    </td>
  )
  const current = envs.find((e) => e.id === selected)

  return (
    <section className={styles.wrapper}>
      <h3 className={styles.heading}>{L.heading[i]}</h3>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{L.env[i]}</th>
            <th>{L.location[i]}</th>
            <th className={styles.num}>
              {L.cost[i]}
              <span className={styles.unit}>USD</span>
            </th>
            <th className={styles.num}>
              {L.energy[i]}
              <span className={styles.unit}>kWh</span>
            </th>
            <th className={styles.num}>
              {L.water[i]}
              <span className={styles.unit}>L</span>
            </th>
            <th className={styles.num}>
              {L.carbon[i]}
              <span className={styles.unit}>gCO2e</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ env, cost, energy, water, carbon }) => {
            const isSelected = env.id === selected
            return (
              <tr
                key={env.id}
                className={isSelected ? styles.selected : ''}
                onClick={() => setDemoSelected(env.id)}
              >
                <td>
                  <label className={styles.envCell}>
                    <input
                      className={styles.radio}
                      type="radio"
                      name="demo-compare"
                      checked={isSelected}
                      onChange={() => setDemoSelected(env.id)}
                    />
                    <span className={styles.name}>
                      {env.trialOption.provider}
                    </span>
                  </label>
                </td>
                <td className={styles.place}>
                  {env.trialOption.location[ja ? 'ja' : 'en']}
                </td>
                {cell(cost, min.cost, cost.toFixed(2))}
                {cell(energy, min.energy, num(energy))}
                {cell(water, min.water, num(water))}
                {cell(carbon, min.carbon, num(carbon))}
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className={styles.note}>{L.note[i]}</p>
      {current && (
        <TransactionFootprint
          option={current.trialOption}
          sample={current.sample}
        />
      )}
    </section>
  )
}
