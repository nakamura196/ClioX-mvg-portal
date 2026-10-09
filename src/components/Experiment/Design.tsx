import { ReactElement } from 'react'
import trialsJson from '../../../content/experiment/trials.json'
import { TrialsFile, buildDesign, computeTrial } from '@utils/experiment'
import { download, num, pick } from './shared'
import styles from './index.module.css'

const TRIALS = trialsJson as unknown as TrialsFile

export default function ExperimentDesign({
  c,
  ja
}: {
  c: typeof import('../../../content/experiment.json')
  ja: boolean
}): ReactElement {
  const d = c.design
  return (
    <div className={styles.page}>
      <section className={styles.panel}>
        <h2>{d.heading}</h2>
        <p>{d.intro}</p>
        <p className={styles.note}>{d.correct}</p>
        <p className={styles.demo}>{pick(TRIALS.demoNotice, ja)}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.button}
            onClick={() =>
              download(
                'design.json',
                JSON.stringify(buildDesign(TRIALS), null, 2) + '\n',
                'application/json'
              )
            }
          >
            {d.download}
          </button>
        </div>
      </section>
      {TRIALS.trials.map((t) => {
        const { options, flags } = computeTrial(t)
        return (
          <section className={styles.panel} key={t.id}>
            <h2>
              {d.trial} {t.id}: {pick(t.job, ja)}
            </h2>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{d.option}</th>
                    <th>{d.cost}</th>
                    <th>{d.itEnergy}</th>
                    <th>{d.facilityEnergy}</th>
                    <th>{d.water}</th>
                    <th>{d.carbon}</th>
                    <th>{d.flags}</th>
                  </tr>
                </thead>
                <tbody>
                  {options.map(({ option: o, footprint: f }) => {
                    const marks = [
                      flags.energyLowestIds.includes(o.id) && d.flagEnergy,
                      flags.waterLowestIds.includes(o.id) && d.flagWater,
                      flags.carbonLowestIds.includes(o.id) && d.flagCarbon,
                      flags.costLowestIds.includes(o.id) && d.flagCost
                    ].filter(Boolean)
                    return (
                      <tr
                        key={o.id}
                        className={
                          flags.energyLowestIds.includes(o.id)
                            ? styles.lowest
                            : undefined
                        }
                      >
                        <td>
                          {o.id}: {o.provider} ({pick(o.location, ja)})
                        </td>
                        <td>{o.costUSD.toFixed(2)}</td>
                        <td>{num(f.itEnergy.value)}</td>
                        <td>{num(f.facilityEnergy.value)}</td>
                        <td>
                          {f.water.value !== undefined
                            ? num(f.water.value)
                            : c.quality.unknown}
                        </td>
                        <td>{num(f.carbon.value)}</td>
                        <td>{marks.join(', ')}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className={styles.note}>
              {d.energyWater}:{' '}
              {flags.energyWaterAgree === null
                ? d.unknownAgree
                : flags.energyWaterAgree
                ? d.agree
                : d.disagree}
            </p>
          </section>
        )
      })}
    </div>
  )
}
