import { ReactElement } from 'react'
import { useRouter } from 'next/router'
import tourEn from '../../../content/firstRunTour.json'
import tourJa from '../../../content/firstRunTour.ja.json'
import useLocaleContent from '../../i18n/useLocaleContent'
import { useFirstRunTour } from './context'
import { isOnStepPage, tourSteps } from './steps'
import styles from './Launcher.module.css'

/** "Guide" in the header: opens the tour, resuming a paused one. */
export default function TourLauncher(): ReactElement {
  const tour = useFirstRunTour()
  const text = useLocaleContent(tourEn, tourJa)
  const router = useRouter()
  if (!tour) return null

  const resumable =
    tour.status === 'dismissed' &&
    tour.step > 0 &&
    tour.step < tourSteps.length - 1

  return (
    <button
      type="button"
      className={styles.launcher}
      title={text.launcherTitle}
      aria-label={text.launcherTitle}
      onClick={() => {
        const from = resumable ? tour.step : 0
        const step = tourSteps[from]
        if (step.path && !isOnStepPage(step, router.asPath))
          router.push(step.path)
        tour.start(from)
      }}
    >
      <span className={styles.icon} aria-hidden="true">
        ?
      </span>
      <span className={styles.label}>{text.launcher}</span>
    </button>
  )
}
