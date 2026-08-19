import { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './index.module.css'
import {
  computeFootprint,
  formatEnergy,
  formatGCO2e,
  DataQuality
} from '@utils/computeFootprint'

// 【重要】ラベルを日本語で直書きしていたため、英語 UI でも日本語が出ていた。
// Victoria(UBC)向けのデモで露見(2026-08-12)。辞書は i18n の JSON に載せるのが
// 本筋だが、上流差分を増やさないためコンポーネント内に閉じた対訳表にしてある。
const L = {
  heading: ['Location and footprint', '所在地とフットプリント'],
  location: ['Processing location', '処理地'],
  jurisdiction: ['Jurisdiction', '法域'],
  grid: ['Grid intensity', '系統排出係数'],
  cost: ['Cost', '費用'],
  energy: ['Energy', 'エネルギー'],
  emissions: ['Emissions', '排出量'],
  pue: ['Energy efficiency (PUE)', 'PUE'],
  water: ['Water efficiency', '水効率'],
  undeclared: ['not declared', '未申告'],
  perHour: ['/hour', '/時'],
  measured: ['measured', '実測'],
  providerReported: ['provider-reported', '事業者申告'],
  portalEstimated: ['portal-estimated', 'ポータル推定'],
  unknown: ['cannot be established', '算出不可'],
  gridNote: ['Grid', '系統'],
  powerNote: ['Power', '電力'],
  reportedNote: ['Provider-reported values', '事業者申告値'],
  footer: [
    'location-based accounting · CPU energy not measured',
    'CPU 電力は非計測／排出量は location-based'
  ],
  pueReported: [' (provider-reported)', '（事業者申告）'],
  pueDefault: [
    ' (lower bound; facility overhead not counted)',
    '（未計上の下限値）'
  ]
}

function useL() {
  const { i18n } = useTranslation('common')
  const ja = (i18n?.language || 'en').startsWith('ja')
  return (k: keyof typeof L) => L[k][ja ? 1 : 0]
}

function QualityBadge({ quality }: { quality: DataQuality }): ReactElement {
  const cls =
    quality === 'measured'
      ? styles.measured
      : quality === 'portal-estimated' || quality === 'provider-reported'
      ? styles.estimated
      : styles.unknown
  const t = useL()
  const label =
    quality === 'measured'
      ? t('measured')
      : quality === 'provider-reported'
      ? t('providerReported')
      : quality === 'portal-estimated'
      ? t('portalEstimated')
      : t('unknown')
  return <span className={`${styles.badge} ${cls}`}>{label}</span>
}

function Row({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): ReactElement {
  return (
    <>
      <div className={styles.label}>{label}</div>
      <div className={styles.value}>{children}</div>
    </>
  )
}

/**
 * 実行環境の所在地・費用・カーボンフットプリントを表示する。
 *
 * Clio-X のモックアップ(2026-08-11, V. Lemieux)の語彙に合わせつつ、
 * モックに無かった以下を足している:
 *
 *   1. 系統排出係数 (gCO2e/kWh)
 *      モックは PUE と「Canadian sovereign compute = Verified」を並べる一方で
 *      系統の炭素強度を出していない。カナダは単一の系統ではなく、
 *      Alberta 335 / Quebec 34.5 / BC 14 と 20 倍以上の開きがある。
 *      これを出さないと「カナダだから低炭素」という誤読を招く。
 *
 *   2. gCO2e そのもの (カーボンクレジット換算ではなく)
 *      ISO/IEC 21031 (SCI) はオフセット計上を明示的に排除し、
 *      機能単位あたりの率を定義している。クレジットは相殺市場の単位であり、
 *      排出量の単位ではない。
 *
 * 意図的な仕様:
 *   - 所在地が申告されていない環境では、数字を出さずに「なぜ出せないか」を書く。
 *     Ocean の ComputeEnvironment に所在地の欄が存在しないという構造的欠落を
 *     可視化するためのもの。
 *   - すべての数値に 実測 / 事業者申告 / ポータル推定 のバッジを付ける。
 */
export default function ComputeFootprint({
  computeEnv,
  durationSeconds,
  pue
}: {
  computeEnv: Partial<Pick<ComputeEnvironmentExtended, 'id' | 'desc'>> & {
    description?: string
  }
  /** 見積もりに使う占有時間(秒)。実績が無ければ maxJobDuration を渡す */
  durationSeconds: number
  /** 明示指定が無ければ事業者申告 PUE、それも無ければ 1.0 */
  pue?: number
}): ReactElement {
  const t = useL()
  const fp = computeFootprint(computeEnv, durationSeconds, pue)
  const loc = fp.location

  return (
    <div className={styles.container}>
      <div className={styles.heading}>
        {t('heading')}
        <QualityBadge quality={fp.quality} />
      </div>

      <div className={styles.grid}>
        <Row label={t('location')}>
          {loc ? loc.processingLocation : t('undeclared')}
        </Row>
        {loc && <Row label={t('jurisdiction')}>{loc.jurisdiction}</Row>}
        {fp.grid && (
          <Row label={t('grid')}>
            {`${fp.grid.gCO2ePerKWh} gCO2e/kWh`}
            {` — ${fp.grid.label}`}
          </Row>
        )}
        {fp.usdCost != null && (
          <Row label={t('cost')}>
            {`$${fp.usdCost.toFixed(4)}`}
            {loc?.usdPerHour != null && (
              <> {`($${loc.usdPerHour}${t('perHour')})`}</>
            )}
          </Row>
        )}
        {fp.energyKWh != null && (
          <Row label={t('energy')}>{formatEnergy(fp.energyKWh)}</Row>
        )}
        {fp.gCO2e != null && (
          <Row label={t('emissions')}>{formatGCO2e(fp.gCO2e)}</Row>
        )}
        {loc?.reportedPUE != null && (
          <Row label={t('pue')}>
            {loc.reportedPUE}
            <QualityBadge quality="provider-reported" />
          </Row>
        )}
        {loc?.reportedWaterLPerKWh != null && (
          <Row label={t('water')}>
            {`${loc.reportedWaterLPerKWh} L/kWh`}
            <QualityBadge quality="provider-reported" />
          </Row>
        )}
      </div>

      {fp.reason && <p className={styles.reason}>{fp.reason}</p>}

      {(fp.grid || fp.power) && (
        <div className={styles.source}>
          {fp.grid && (
            <div>
              {t('gridNote')}: {fp.grid.source} ({fp.grid.asOf}, location-based)
            </div>
          )}
          {fp.power && (
            <div>
              {t('powerNote')}: {fp.power.source}
            </div>
          )}
          {loc?.reportedAsOf && (
            <div>
              {t('reportedNote')}: {loc.reportedAsOf}
            </div>
          )}
          <div>
            PUE {fp.pue}
            {loc?.reportedPUE != null
              ? t('pueReported')
              : t('pueDefault')} · {t('footer')}
          </div>
        </div>
      )}
    </div>
  )
}
